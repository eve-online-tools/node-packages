export const buildTypeIdToSizeClass = (shipSizes: Record<number, { typeIDs: number[] }>): Record<number, number> => {
  const index: Record<number, number> = {}

  for (const [sizeClass, record] of Object.entries(shipSizes)) {
    for (const typeId of record.typeIDs) {
      index[typeId] = Number(sizeClass)
    }
  }

  return index
}
