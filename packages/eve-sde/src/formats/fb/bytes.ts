const utf8 = new TextDecoder('utf-8', { fatal: true })

/** Little-endian view over a FlatBuffers buffer. Positions are byte offsets from the buffer start. */
export type FbBuffer = {
  bytes: Uint8Array
  view: DataView
}

export const createFbBuffer = (bytes: Uint8Array): FbBuffer => ({
  bytes,
  view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
})

export const readFileIdentifier = (buf: FbBuffer): string => String.fromCharCode(...buf.bytes.subarray(4, 8))

export const rootTable = (buf: FbBuffer): number => buf.view.getUint32(0, true)

/** Follows a uoffset stored at `pos`. */
export const indirect = (buf: FbBuffer, pos: number): number => pos + buf.view.getUint32(pos, true)

/** Position of a table field's data, or 0 when the field is absent. `vtableOffset` is the reflection `Field.offset`. */
export const fieldPosition = (buf: FbBuffer, table: number, vtableOffset: number): number => {
  const vtable = table - buf.view.getInt32(table, true)
  if (vtableOffset >= buf.view.getUint16(vtable, true)) {
    return 0
  }

  const offset = buf.view.getUint16(vtable + vtableOffset, true)
  return offset === 0 ? 0 : table + offset
}

/** String referenced by the uoffset at `pos`. */
export const readString = (buf: FbBuffer, pos: number): string => {
  const start = indirect(buf, pos)
  const length = buf.view.getUint32(start, true)
  return utf8.decode(buf.bytes.subarray(start + 4, start + 4 + length))
}

/** Raw UTF-8 bytes of the string referenced at `pos`, for byte-wise key comparison. */
export const readStringBytes = (buf: FbBuffer, pos: number): Uint8Array => {
  const start = indirect(buf, pos)
  const length = buf.view.getUint32(start, true)
  return buf.bytes.subarray(start + 4, start + 4 + length)
}

/** Length and first element position of the vector referenced by the uoffset at `pos`. */
export const readVector = (buf: FbBuffer, pos: number): { length: number; start: number } => {
  const vector = indirect(buf, pos)
  return { length: buf.view.getUint32(vector, true), start: vector + 4 }
}

export const readInt64 = (buf: FbBuffer, pos: number, signed: boolean): number => {
  const value = signed ? buf.view.getBigInt64(pos, true) : buf.view.getBigUint64(pos, true)
  const result = Number(value)
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`64-bit integer ${value} at byte ${pos} exceeds Number.MAX_SAFE_INTEGER.`)
  }

  return result
}
