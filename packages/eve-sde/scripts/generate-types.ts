import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateTableTypes, type JsonSchema, type TableSchema } from '../src/codegen/json-schema-to-ts'

type Manifest = {
  release: string
  tables: Record<string, { jsonl: { recordSchemaUrl: string } }>
}

const manifestUrl = 'https://sde.evetech.net/tranquility/latest/'
const concurrency = 8
const outFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/schema/generated/tables.ts')

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

const manifest = await fetchJson<Manifest>(manifestUrl)
const tables = await mapLimit(
  Object.entries(manifest.tables),
  concurrency,
  async ([table, info]): Promise<TableSchema> => ({
    table,
    schema: await fetchJson<JsonSchema>(info.jsonl.recordSchemaUrl),
  }),
)

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${generateTableTypes(tables)}\n`)
execFileSync('pnpm', ['--workspace-root', 'exec', 'oxfmt', '--write', outFile], { stdio: 'inherit' })
console.log(
  `Wrote ${tables.length} tables from release ${manifest.release} to ${path.relative(process.cwd(), outFile)}`,
)
