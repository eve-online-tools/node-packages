export const formatJson = (data: unknown, jsonSpace?: number): string =>
  jsonSpace === undefined ? `${JSON.stringify(data)}\n` : `${JSON.stringify(data, null, jsonSpace)}\n`
