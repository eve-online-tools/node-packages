import { fieldPosition, indirect, readInt64, readString, readVector, type FbBuffer } from './bytes'
import { BaseType, type FbField, type FbObject, type FbSchema, type FbType } from './reflection'

export type FbRow = Record<string, unknown>

/** Decodes the table at a buffer position into a plain object. */
export type ObjectDecoder = (buf: FbBuffer, table: number) => FbRow

/** Reads a value stored inline at a position: a scalar, or a uoffset to a string, table or vector. */
type ValueReader = (buf: FbBuffer, pos: number) => unknown

const enumNameAttribute = 'sde_enum_name'
const enumValueNameAttribute = 'sde_name'

const isScalar = (baseType: BaseType): boolean => baseType >= BaseType.Bool && baseType <= BaseType.Double

const scalarSize: Partial<Record<BaseType, number>> = {
  [BaseType.Bool]: 1,
  [BaseType.Byte]: 1,
  [BaseType.UByte]: 1,
  [BaseType.Short]: 2,
  [BaseType.UShort]: 2,
  [BaseType.Int]: 4,
  [BaseType.UInt]: 4,
  [BaseType.Long]: 8,
  [BaseType.ULong]: 8,
  [BaseType.Float]: 4,
  [BaseType.Double]: 8,
}

const scalarReader = (baseType: BaseType): ValueReader => {
  switch (baseType) {
    case BaseType.Bool:
      return (buf, pos) => buf.view.getUint8(pos) !== 0
    case BaseType.Byte:
      return (buf, pos) => buf.view.getInt8(pos)
    case BaseType.UByte:
      return (buf, pos) => buf.view.getUint8(pos)
    case BaseType.Short:
      return (buf, pos) => buf.view.getInt16(pos, true)
    case BaseType.UShort:
      return (buf, pos) => buf.view.getUint16(pos, true)
    case BaseType.Int:
      return (buf, pos) => buf.view.getInt32(pos, true)
    case BaseType.UInt:
      return (buf, pos) => buf.view.getUint32(pos, true)
    case BaseType.Long:
      return (buf, pos) => readInt64(buf, pos, true)
    case BaseType.ULong:
      return (buf, pos) => readInt64(buf, pos, false)
    case BaseType.Float:
      return (buf, pos) => buf.view.getFloat32(pos, true)
    case BaseType.Double:
      return (buf, pos) => buf.view.getFloat64(pos, true)
    default:
      throw new Error(`Base type ${baseType} is not a scalar.`)
  }
}

/** Builds decoders for every object in a schema, compiled once per schema. */
export const createDecoders = (schema: FbSchema) => {
  const decoders = new Map<FbObject, ObjectDecoder>()

  const enumNames = (field: FbField): ReadonlyMap<number, string> => {
    const fbEnum = schema.enums[field.type.index]
    if (!fbEnum) {
      throw new Error(`Field "${field.name}" references unknown enum index ${field.type.index}.`)
    }

    return new Map(
      [...fbEnum.values].map(([value, { name, attributes }]) => [
        value,
        attributes.get(enumValueNameAttribute) ?? name,
      ]),
    )
  }

  const scalarFieldReader = (field: FbField, baseType: BaseType): ValueReader => {
    const read = scalarReader(baseType)
    if (!field.attributes.has(enumNameAttribute)) {
      return read
    }

    const names = enumNames(field)
    return (buf, pos) => {
      const value = read(buf, pos) as number
      const name = names.get(value)
      if (name === undefined) {
        throw new Error(`Field "${field.name}" has value ${value}, which is not a member of its enum.`)
      }

      return name
    }
  }

  const objectAt = (index: number, owner: string): FbObject => {
    const object = schema.objects[index]
    if (!object) {
      throw new Error(`"${owner}" references unknown object index ${index}.`)
    }

    if (object.isStruct) {
      throw new Error(`"${owner}" uses struct "${object.name}"; structs are not supported.`)
    }

    return object
  }

  const vectorElementReader = (field: FbField, type: FbType): { read: ValueReader; size: number } => {
    if (isScalar(type.element)) {
      return { read: scalarFieldReader(field, type.element), size: scalarSize[type.element]! }
    }

    if (type.element === BaseType.String) {
      return { read: readString, size: 4 }
    }

    if (type.element === BaseType.Obj) {
      const decode = decoderFor(objectAt(type.index, field.name))
      return { read: (buf, pos) => decode(buf, indirect(buf, pos)), size: 4 }
    }

    throw new Error(`Field "${field.name}" is a vector of unsupported base type ${type.element}.`)
  }

  const fieldReader = (field: FbField): ValueReader => {
    const { type } = field
    if (isScalar(type.baseType)) {
      return scalarFieldReader(field, type.baseType)
    }

    switch (type.baseType) {
      case BaseType.String:
        return readString
      case BaseType.Obj: {
        const decode = decoderFor(objectAt(type.index, field.name))
        return (buf, pos) => decode(buf, indirect(buf, pos))
      }
      case BaseType.Vector: {
        const element = vectorElementReader(field, type)
        return (buf, pos) => {
          const { length, start } = readVector(buf, pos)
          const values = new Array<unknown>(length)
          for (let i = 0; i < length; i++) {
            values[i] = element.read(buf, start + i * element.size)
          }
          return values
        }
      }
      default:
        throw new Error(`Field "${field.name}" has unsupported base type ${type.baseType}.`)
    }
  }

  /** Value of a scalar field omitted from the buffer because it equals the schema default. */
  const absentScalar = (field: FbField): unknown => {
    const { baseType } = field.type
    if (baseType === BaseType.Bool) {
      return field.defaultInteger !== 0
    }

    if (baseType === BaseType.Float || baseType === BaseType.Double) {
      return field.defaultReal
    }

    if (field.attributes.has(enumNameAttribute)) {
      return enumNames(field).get(field.defaultInteger)
    }

    return field.defaultInteger
  }

  const compileField = (field: FbField) => {
    const read = fieldReader(field)
    const hasDefault = isScalar(field.type.baseType) && !field.optional
    return {
      name: field.name,
      vtableOffset: field.vtableOffset,
      read,
      fallback: hasDefault ? absentScalar(field) : undefined,
      hasDefault,
    }
  }

  const compileObject = (object: FbObject, fieldNames?: ReadonlySet<string>): ObjectDecoder => {
    const fields = object.fields
      .filter((field) => !fieldNames || fieldNames.has(field.name))
      .map((field) => compileField(field))

    return (buf, table) => {
      const row: FbRow = {}
      for (const field of fields) {
        const pos = fieldPosition(buf, table, field.vtableOffset)
        if (pos !== 0) {
          row[field.name] = field.read(buf, pos)
        } else if (field.hasDefault) {
          row[field.name] = field.fallback
        }
      }
      return row
    }
  }

  // Lazy so recursive object graphs resolve without compiling the same object twice.
  const decoderFor = (object: FbObject): ObjectDecoder => {
    const existing = decoders.get(object)
    if (existing) {
      return existing
    }

    let compiled: ObjectDecoder | undefined
    const decoder: ObjectDecoder = (buf, table) => {
      compiled ??= compileObject(object)
      return compiled(buf, table)
    }
    decoders.set(object, decoder)
    return decoder
  }

  return {
    decoderFor,
    /** Decoder that only emits the given top-level fields. */
    projectedDecoderFor: (object: FbObject, fieldNames: ReadonlySet<string>): ObjectDecoder =>
      compileObject(object, fieldNames),
  }
}
