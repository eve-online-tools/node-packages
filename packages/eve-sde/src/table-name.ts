const extensionPattern = /\.[^./\\]+$/

export const assertBareTableName = (name: string): string => {
  const extensionMatch = extensionPattern.exec(name)
  if (extensionMatch) {
    const bareName = name.slice(0, -extensionMatch[0].length)
    throw new Error(`Invalid table name "${name}": specify bare table names without extension (e.g. "${bareName}").`)
  }

  return name
}

export const tableFileName = (name: string): string => {
  assertBareTableName(name)
  return `${name}.jsonl`
}
