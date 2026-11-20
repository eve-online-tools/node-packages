import {
  createFbBuffer,
  fieldPosition,
  indirect,
  readFileIdentifier,
  readInt64,
  readString,
  readVector,
  rootTable,
  type FbBuffer,
} from './bytes'

// Values of reflection.fbs `BaseType`: https://github.com/google/flatbuffers/blob/master/reflection/reflection.fbs
export const BaseType = {
  None: 0,
  UType: 1,
  Bool: 2,
  Byte: 3,
  UByte: 4,
  Short: 5,
  UShort: 6,
  Int: 7,
  UInt: 8,
  Long: 9,
  ULong: 10,
  Float: 11,
  Double: 12,
  String: 13,
  Vector: 14,
  Obj: 15,
  Union: 16,
  Array: 17,
  Vector64: 18,
} as const

export type BaseType = (typeof BaseType)[keyof typeof BaseType]

export type FbType = {
  baseType: BaseType
  element: BaseType
  /** Object index for `Obj` (or vector of `Obj`), enum index for enum-typed scalars, otherwise -1. */
  index: number
}

export type FbField = {
  name: string
  type: FbType
  id: number
  vtableOffset: number
  defaultInteger: number
  defaultReal: number
  required: boolean
  key: boolean
  optional: boolean
  attributes: ReadonlyMap<string, string>
}

export type FbObject = {
  name: string
  /** Sorted by field id, which is declaration order. */
  fields: FbField[]
  isStruct: boolean
}

export type FbEnum = {
  name: string
  values: ReadonlyMap<number, { name: string; attributes: ReadonlyMap<string, string> }>
}

export type FbSchema = {
  objects: FbObject[]
  enums: FbEnum[]
  rootTable: FbObject
}

// Vtable offsets of reflection.fbs fields: 4 + 2 * field id.
const vt = (id: number): number => 4 + 2 * id

const tableAt = (buf: FbBuffer, table: number, id: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? 0 : indirect(buf, pos)
}

const stringAt = (buf: FbBuffer, table: number, id: number): string | undefined => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? undefined : readString(buf, pos)
}

const requiredStringAt = (buf: FbBuffer, table: number, id: number, what: string): string => {
  const value = stringAt(buf, table, id)
  if (value === undefined) {
    throw new Error(`Invalid binary schema: ${what} is missing its name.`)
  }

  return value
}

const tablesAt = (buf: FbBuffer, table: number, id: number): number[] => {
  const pos = fieldPosition(buf, table, vt(id))
  if (pos === 0) {
    return []
  }

  const { length, start } = readVector(buf, pos)
  return Array.from({ length }, (_, i) => indirect(buf, start + i * 4))
}

const uint8At = (buf: FbBuffer, table: number, id: number, fallback: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? fallback : buf.view.getUint8(pos)
}

const uint16At = (buf: FbBuffer, table: number, id: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? 0 : buf.view.getUint16(pos, true)
}

const int32At = (buf: FbBuffer, table: number, id: number, fallback: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? fallback : buf.view.getInt32(pos, true)
}

const int64At = (buf: FbBuffer, table: number, id: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? 0 : readInt64(buf, pos, true)
}

const float64At = (buf: FbBuffer, table: number, id: number): number => {
  const pos = fieldPosition(buf, table, vt(id))
  return pos === 0 ? 0 : buf.view.getFloat64(pos, true)
}

const boolAt = (buf: FbBuffer, table: number, id: number): boolean => uint8At(buf, table, id, 0) !== 0

const attributesAt = (buf: FbBuffer, table: number, id: number): ReadonlyMap<string, string> =>
  new Map(
    tablesAt(buf, table, id).map((keyValue) => [
      requiredStringAt(buf, keyValue, 0, 'attribute'),
      stringAt(buf, keyValue, 1) ?? '',
    ]),
  )

const parseType = (buf: FbBuffer, table: number): FbType => ({
  baseType: uint8At(buf, table, 0, BaseType.None) as BaseType,
  element: uint8At(buf, table, 1, BaseType.None) as BaseType,
  index: int32At(buf, table, 2, -1),
})

// reflection.fbs Field: name 0, type 1, id 2, offset 3, default_integer 4, default_real 5, deprecated 6,
// required 7, key 8, attributes 9, documentation 10, optional 11
const parseField = (buf: FbBuffer, table: number): FbField => ({
  name: requiredStringAt(buf, table, 0, 'field'),
  type: parseType(buf, tableAt(buf, table, 1)),
  id: uint16At(buf, table, 2),
  vtableOffset: uint16At(buf, table, 3),
  defaultInteger: int64At(buf, table, 4),
  defaultReal: float64At(buf, table, 5),
  required: boolAt(buf, table, 7),
  key: boolAt(buf, table, 8),
  optional: boolAt(buf, table, 11),
  attributes: attributesAt(buf, table, 9),
})

// reflection.fbs Object: name 0, fields 1, is_struct 2
const parseObject = (buf: FbBuffer, table: number): FbObject => ({
  name: requiredStringAt(buf, table, 0, 'object'),
  fields: tablesAt(buf, table, 1)
    .map((field) => parseField(buf, field))
    .sort((left, right) => left.id - right.id),
  isStruct: boolAt(buf, table, 2),
})

// reflection.fbs Enum: name 0, values 1. EnumVal: name 0, value 1, attributes 5
const parseEnum = (buf: FbBuffer, table: number): FbEnum => {
  const name = requiredStringAt(buf, table, 0, 'enum')
  return {
    name,
    values: new Map(
      tablesAt(buf, table, 1).map((value) => [
        int64At(buf, value, 1),
        { name: requiredStringAt(buf, value, 0, `enum value of ${name}`), attributes: attributesAt(buf, value, 5) },
      ]),
    ),
  }
}

/** Parses a binary FlatBuffers schema (`.bfbs`). */
export const parseBinarySchema = (bytes: Uint8Array): FbSchema => {
  const buf = createFbBuffer(bytes)
  const identifier = readFileIdentifier(buf)
  if (identifier !== 'BFBS') {
    throw new Error(`Invalid binary schema: expected file identifier "BFBS", got "${identifier}".`)
  }

  // reflection.fbs Schema: objects 0, enums 1, root_table 4
  const schema = rootTable(buf)
  const objects = tablesAt(buf, schema, 0).map((table) => parseObject(buf, table))
  const rootTableRef = tableAt(buf, schema, 4)
  if (rootTableRef === 0) {
    throw new Error('Invalid binary schema: root_table is missing.')
  }

  const rootName = requiredStringAt(buf, rootTableRef, 0, 'root_table')
  const root = objects.find((object) => object.name === rootName)
  if (!root) {
    throw new Error(`Invalid binary schema: root_table "${rootName}" is not one of the schema objects.`)
  }

  return {
    objects,
    enums: tablesAt(buf, schema, 1).map((table) => parseEnum(buf, table)),
    rootTable: root,
  }
}
