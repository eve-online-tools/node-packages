import { zipSync } from 'fflate'

export const createFixtureArchive = (tables: Record<string, string>): Buffer => {
  const files: Record<string, Uint8Array> = {}

  for (const [tableName, content] of Object.entries(tables)) {
    files[`${tableName}.jsonl`] = new TextEncoder().encode(content)
  }

  return Buffer.from(zipSync(files))
}
