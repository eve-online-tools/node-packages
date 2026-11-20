export type JsonSchema = {
  $schema?: string
  $defs?: Record<string, JsonSchema>
  $ref?: string
  type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean'
  format?: string
  enum?: (string | number)[]
  'x-enum-varnames'?: string[]
  'x-sde-key'?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
}

export type TableSchema = { table: string; schema: JsonSchema }

const draft202012 = 'https://json-schema.org/draft/2020-12/schema'

const allowedKeys: Record<string, string[]> = {
  ref: ['$ref'],
  object: ['type', 'properties', 'required', 'additionalProperties', 'x-sde-key'],
  root: ['$schema', '$defs', 'type', 'properties', 'required', 'additionalProperties', 'x-sde-key'],
  array: ['type', 'items'],
  string: ['type', 'enum'],
  integer: ['type', 'format', 'enum', 'x-enum-varnames'],
  number: ['type', 'format'],
  boolean: ['type'],
}

const allowedFormats: Record<string, (string | undefined)[]> = {
  integer: ['int32', 'int64'],
  number: ['double'],
}

// A def named like a global (freelanceJobSchemas has `Boolean`) would shadow it in the generated module.
const globalTypeNames = new Set([
  'Array',
  'Boolean',
  'Date',
  'Error',
  'Function',
  'Map',
  'Number',
  'Object',
  'Promise',
  'Record',
  'Set',
  'String',
  'Symbol',
])

const identifier = /^[A-Za-z_$][\w$]*$/

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const fail = (path: string, message: string): never => {
  throw new Error(`Unsupported JSON Schema at ${path}: ${message}`)
}

// `_sde` and friends are SDE metadata tables; `Meta` keeps them distinct from a possible future `sde` table.
export const pascalTableName = (table: string) => {
  const match = /^(_?)([a-z][A-Za-z0-9]*)$/.exec(table)
  if (!match) {
    throw new Error(`Unsupported table name: ${table}`)
  }
  const stem = match[2]!
  return `${match[1] ? 'Meta' : ''}${stem[0]!.toUpperCase()}${stem.slice(1)}`
}

const refName = (ref: string, path: string) => {
  const match = /^#\/\$defs\/([A-Z][A-Za-z0-9]*)$/.exec(ref)
  return match ? match[1]! : fail(path, `unsupported $ref ${ref}`)
}

const assertKeys = (node: JsonSchema, kind: string, path: string) => {
  for (const key of Object.keys(node)) {
    if (!allowedKeys[kind]!.includes(key)) {
      fail(path, `keyword "${key}" on ${kind}`)
    }
  }
}

const knownKeys = new Set(Object.values(allowedKeys).flat())

const validate = (node: JsonSchema, path: string, defs: Record<string, JsonSchema>, isRoot = false): void => {
  const unknownKey = Object.keys(node).find((key) => !knownKeys.has(key))
  if (unknownKey !== undefined) {
    fail(path, `keyword "${unknownKey}"`)
  }
  if (node.$ref !== undefined) {
    assertKeys(node, 'ref', path)
    const name = refName(node.$ref, path)
    if (!Object.hasOwn(defs, name)) {
      fail(path, `$ref to missing definition ${name}`)
    }
    return
  }
  const type = node.type
  if (type === undefined || !Object.hasOwn(allowedKeys, type)) {
    return fail(path, `type ${JSON.stringify(type)}`)
  }
  assertKeys(node, isRoot ? 'root' : type, path)
  if (node.format !== undefined && !allowedFormats[type]?.includes(node.format)) {
    fail(path, `format "${node.format}" on ${type}`)
  }
  if (node.enum !== undefined) {
    const expected = type === 'string' ? 'string' : 'number'
    if (node.enum.length === 0 || node.enum.some((value) => typeof value !== expected)) {
      fail(path, `enum values must be non-empty ${expected}s`)
    }
  }
  const varnames = node['x-enum-varnames']
  if (varnames !== undefined && varnames.length !== node.enum?.length) {
    fail(path, 'x-enum-varnames must match enum length')
  }
  if (type === 'array') {
    if (node.items === undefined) {
      fail(path, 'array without items')
    }
    validate(node.items!, `${path}/items`, defs)
  }
  if (type === 'object') {
    validateObject(node, path, defs)
  }
}

const validateObject = (node: JsonSchema, path: string, defs: Record<string, JsonSchema>) => {
  if (node.additionalProperties !== false) {
    fail(path, 'objects must set additionalProperties: false')
  }
  const properties = node.properties ?? fail(path, 'object without properties')
  for (const name of node.required ?? []) {
    if (!Object.hasOwn(properties, name)) {
      fail(path, `required property ${name} is not defined`)
    }
  }
  const key = node['x-sde-key']
  if (key !== undefined && !node.required?.includes(key)) {
    fail(path, `x-sde-key ${key} is not a required property`)
  }
  for (const [name, property] of Object.entries(properties)) {
    validate(property, `${path}/properties/${name}`, defs)
  }
}

const validateTable = ({ table, schema }: TableSchema) => {
  const path = `${table}#`
  if (schema.$schema !== draft202012) {
    fail(path, `$schema ${JSON.stringify(schema.$schema)}`)
  }
  if (schema.type !== 'object') {
    fail(path, 'root must be an object')
  }
  if (schema['x-sde-key'] === undefined) {
    fail(path, 'root without x-sde-key')
  }
  const defs = schema.$defs ?? {}
  validate(schema, path, defs, true)
  for (const [name, def] of Object.entries(defs)) {
    refName(`#/$defs/${name}`, `${path}/$defs`)
    validate(def, `${path}/$defs/${name}`, defs)
  }
}

// Structural identity must look through $refs: two tables can share a def name and body while their refs point at
// differently shaped defs.
const inlineRefs = (node: JsonSchema, defs: Record<string, JsonSchema>, seen: string[]): unknown => {
  if (node.$ref !== undefined) {
    const name = refName(node.$ref, '')
    if (seen.includes(name)) {
      throw new Error(`Recursive $defs are not supported: ${[...seen, name].join(' -> ')}`)
    }
    return inlineRefs(defs[name]!, defs, [...seen, name])
  }
  return {
    ...node,
    properties: node.properties
      ? Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, inlineRefs(v, defs, seen)]))
      : undefined,
    items: node.items ? inlineRefs(node.items, defs, seen) : undefined,
  }
}

type DefNames = Map<string, Map<string, string>>

const resolveDefNames = (tables: TableSchema[]): DefNames => {
  const variants = new Map<string, Map<string, string[]>>()
  for (const { table, schema } of tables) {
    const defs = schema.$defs ?? {}
    for (const [name, def] of Object.entries(defs)) {
      const fingerprint = JSON.stringify(inlineRefs(def, defs, [name]))
      const byShape = variants.get(name) ?? new Map<string, string[]>()
      variants.set(name, byShape.set(fingerprint, [...(byShape.get(fingerprint) ?? []), table]))
    }
  }
  const names: DefNames = new Map(tables.map(({ table }) => [table, new Map()]))
  const owners = new Map<string, string>()
  for (const [name, byShape] of variants) {
    for (const [fingerprint, sharingTables] of byShape) {
      const emitted =
        byShape.size === 1 && !globalTypeNames.has(name) ? name : `${pascalTableName(sharingTables[0]!)}${name}`
      const owner = `${name}:${fingerprint}`
      if ((owners.get(emitted) ?? owner) !== owner) {
        throw new Error(`Generated type name collision: ${emitted}`)
      }
      owners.set(emitted, owner)
      for (const table of sharingTables) {
        names.get(table)!.set(name, emitted)
      }
    }
  }
  return names
}

const indent = (depth: number) => '  '.repeat(depth)

const renderType = (node: JsonSchema, refs: Map<string, string>, depth: number): string => {
  if (node.$ref !== undefined) {
    return refs.get(refName(node.$ref, ''))!
  }
  if (node.enum !== undefined) {
    return node.enum.map((value) => JSON.stringify(value)).join(' | ')
  }
  switch (node.type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array': {
      const item = renderType(node.items!, refs, depth)
      return item.includes(' | ') ? `(${item})[]` : `${item}[]`
    }
    case 'object':
      return renderObject(node, refs, depth)
    default:
      throw new Error(`Unreachable type ${JSON.stringify(node.type)}`)
  }
}

const renderObject = (node: JsonSchema, refs: Map<string, string>, depth: number) => {
  const key = node['x-sde-key']
  const names = Object.keys(node.properties!)
  const ordered = key === undefined ? names : [key, ...names.filter((name) => name !== key)]
  const lines = ordered.map((name) => {
    const optional = node.required?.includes(name) ? '' : '?'
    const label = identifier.test(name) ? name : JSON.stringify(name)
    return `${indent(depth + 1)}${label}${optional}: ${renderType(node.properties![name]!, refs, depth + 1)}`
  })
  return `{\n${lines.join('\n')}\n${indent(depth)}}`
}

export type GenerateOptions = {
  /**
   * Emit a declaration file for a project instead of the package's shipped module: no runtime values, and an
   * augmentation of this module's `SdeTypeRegistry` so the generated tables replace the shipped ones.
   */
  augmentModule?: string
  header?: string
}

// The release is left out of the output so regenerating against unchanged schemas produces no diff.
export const generateTableTypes = (tables: TableSchema[], options: GenerateOptions = {}) => {
  const sorted = [...tables].sort((a, b) => compare(a.table, b.table))
  sorted.forEach(validateTable)

  const defNames = resolveDefNames(sorted)
  const declarations = new Map<string, string>()
  const declare = (name: string, body: string) => {
    if (declarations.has(name)) {
      throw new Error(`Generated type name collision: ${name}`)
    }
    declarations.set(name, `export type ${name} = ${body}`)
  }

  for (const { table, schema } of sorted) {
    const refs = defNames.get(table)!
    for (const [name, def] of Object.entries(schema.$defs ?? {})) {
      const emitted = refs.get(name)!
      if (!declarations.has(emitted)) {
        declare(emitted, renderType(def, refs, 0))
      }
    }
  }
  const defBlocks = [...declarations.keys()].sort(compare).map((name) => declarations.get(name)!)

  const rowBlocks = sorted.map(({ table, schema }) => {
    const name = `${pascalTableName(table)}Row`
    declare(name, renderObject(schema, defNames.get(table)!, 0))
    return declarations.get(name)!
  })

  const registry = sorted.map(({ table, schema }) => {
    const keySchema = schema.properties![schema['x-sde-key']!]!
    const keyType = renderType(keySchema, defNames.get(table)!, 1)
    return `  ${table}: { row: ${pascalTableName(table)}Row; key: ${keyType} }`
  })
  const keys = sorted.map(({ table, schema }) => `  ${table}: ${JSON.stringify(schema['x-sde-key'])},`)

  const footer = options.augmentModule
    ? [
        `declare module ${JSON.stringify(options.augmentModule)} {\n  interface SdeTypeRegistry {\n    tables: SdeTables\n  }\n}`,
      ]
    : [`export const sdeTableKeys = {\n${keys.join('\n')}\n} as const`]

  return [
    options.header ?? '// Generated by scripts/generate-types.ts from the SDE record schemas. Do not edit.',
    ...defBlocks,
    ...rowBlocks,
    `export interface SdeTables {\n${registry.join('\n')}\n}`,
    ...footer,
  ].join('\n\n')
}
