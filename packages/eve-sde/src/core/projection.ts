import type { AnyRow, Projection } from './types'

/** Applies a projection to an already decoded row. */
export const projectRow = (row: AnyRow, projection: Projection | undefined): AnyRow => {
  if (!projection) {
    return row
  }
  if (projection.fields) {
    return Object.fromEntries(
      projection.fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]),
    )
  }
  const omitted = new Set(projection.omit)
  return Object.fromEntries(Object.entries(row).filter(([field]) => !omitted.has(field)))
}
