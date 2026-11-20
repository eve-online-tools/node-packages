import {
  createFbBuffer,
  fieldPosition,
  indirect,
  readInt64,
  readStringBytes,
  readVector,
  rootTable,
  type FbBuffer,
} from './bytes'
import { createDecoders, type FbRow, type ObjectDecoder } from './decode'
import { BaseType, parseBinarySchema, type FbField, type FbObject } from './reflection'

export type FbKey = number | string

/** Top-level fields to decode. `fields` and `omit` are mutually exclusive. */
export type FbProjection = {
  fields?: readonly string[]
  omit?: readonly string[]
}

/** One SDE table backed by its `.fb` data and `.bfbs` schema. */
export type FbTable = {
  /** Name of the key field, e.g. `typeID`. */
  readonly keyField: string
  readonly size: number
  /** Binary search on the key; rows are stored sorted by key. */
  get: (key: FbKey, projection?: FbProjection) => FbRow | undefined
  rows: (projection?: FbProjection) => IterableIterator<FbRow>
}

const rowsFieldName = 'rows'
const utf8 = new TextEncoder()

const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  const length = Math.min(left.length, right.length)
  for (let i = 0; i < length; i++) {
    if (left[i] !== right[i]) {
      return left[i]! - right[i]!
    }
  }
  return left.length - right.length
}

const findRowsField = (root: FbObject): FbField => {
  const field = root.fields.find((candidate) => candidate.name === rowsFieldName)
  if (!field || field.type.baseType !== BaseType.Vector || field.type.element !== BaseType.Obj) {
    throw new Error(`Root table "${root.name}" has no "${rowsFieldName}" vector of tables.`)
  }

  return field
}

const findKeyField = (row: FbObject): FbField => {
  const keys = row.fields.filter((field) => field.key)
  if (keys.length !== 1) {
    throw new Error(`Row table "${row.name}" must have exactly one key field, found ${keys.length}.`)
  }

  return keys[0]!
}

const projectionFields = (row: FbObject, projection: FbProjection): ReadonlySet<string> | undefined => {
  if (projection.fields && projection.omit) {
    throw new Error('Set either "fields" or "omit", not both.')
  }

  const names = projection.fields ?? projection.omit
  if (!names) {
    return undefined
  }

  const known = new Set(row.fields.map((field) => field.name))
  const unknown = names.filter((name) => !known.has(name))
  if (unknown.length > 0) {
    throw new Error(`Unknown field(s) for "${row.name}": ${unknown.join(', ')}.`)
  }

  if (projection.fields) {
    return new Set(projection.fields)
  }

  const omitted = new Set(names)
  return new Set([...known].filter((name) => !omitted.has(name)))
}

/** Opens an SDE table from its `.fb` data and `.bfbs` schema. */
export const openFbTable = (data: Uint8Array, binarySchema: Uint8Array): FbTable => {
  const schema = parseBinarySchema(binarySchema)
  const rowsField = findRowsField(schema.rootTable)
  const rowObject = schema.objects[rowsField.type.index]
  if (!rowObject) {
    throw new Error(`"${rowsField.name}" references unknown object index ${rowsField.type.index}.`)
  }

  const keyField = findKeyField(rowObject)
  const decoders = createDecoders(schema)
  const fullDecoder = decoders.decoderFor(rowObject)
  const buf = createFbBuffer(data)

  const rowsPosition = fieldPosition(buf, rootTable(buf), rowsField.vtableOffset)
  const { length: size, start } = rowsPosition === 0 ? { length: 0, start: 0 } : readVector(buf, rowsPosition)
  const rowAt = (index: number): number => indirect(buf, start + index * 4)

  const decoderFor = (projection?: FbProjection): ObjectDecoder => {
    const fields = projection ? projectionFields(rowObject, projection) : undefined
    return fields ? decoders.projectedDecoderFor(rowObject, fields) : fullDecoder
  }

  const compareKeyAt = createKeyComparator(buf, keyField)

  return {
    keyField: keyField.name,
    size,
    get: (key, projection) => {
      const compare = compareKeyAt(key)
      let low = 0
      let high = size - 1
      while (low <= high) {
        const middle = (low + high) >>> 1
        const table = rowAt(middle)
        const order = compare(table)
        if (order === 0) {
          return decoderFor(projection)(buf, table)
        }
        if (order < 0) {
          low = middle + 1
        } else {
          high = middle - 1
        }
      }
      return undefined
    },
    rows: function* (projection) {
      const decode = decoderFor(projection)
      for (let i = 0; i < size; i++) {
        yield decode(buf, rowAt(i))
      }
    },
  }
}

/** Returns `(key) => (table) => order` where order < 0 means the row's key sorts before `key`. */
const createKeyComparator = (buf: FbBuffer, keyField: FbField) => {
  const { baseType } = keyField.type
  const positionOf = (table: number): number => {
    const pos = fieldPosition(buf, table, keyField.vtableOffset)
    if (pos === 0 && baseType === BaseType.String) {
      throw new Error(`Row is missing its string key "${keyField.name}".`)
    }
    return pos
  }

  if (baseType === BaseType.String) {
    return (key: FbKey) => {
      if (typeof key !== 'string') {
        throw new TypeError(`Key "${keyField.name}" is a string, got ${typeof key}.`)
      }
      const target = utf8.encode(key)
      return (table: number) => compareBytes(readStringBytes(buf, positionOf(table)), target)
    }
  }

  const read = (table: number): number => {
    const pos = positionOf(table)
    if (pos === 0) {
      return keyField.defaultInteger
    }

    switch (baseType) {
      case BaseType.Int:
        return buf.view.getInt32(pos, true)
      case BaseType.UInt:
        return buf.view.getUint32(pos, true)
      case BaseType.Long:
        return readInt64(buf, pos, true)
      case BaseType.ULong:
        return readInt64(buf, pos, false)
      default:
        throw new Error(`Key "${keyField.name}" has unsupported base type ${baseType}.`)
    }
  }

  return (key: FbKey) => {
    if (typeof key !== 'number') {
      throw new TypeError(`Key "${keyField.name}" is numeric, got ${typeof key}.`)
    }
    return (table: number) => read(table) - key
  }
}
