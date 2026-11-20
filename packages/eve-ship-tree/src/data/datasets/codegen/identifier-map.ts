import { toCamelCase } from './string'

export type IdentifierEntry = {
  id: number
  name: string
}

export type IdentifierModuleSpec = {
  entries: IdentifierEntry[]
  identifierVariableName: string
  nameVariableName?: string
  typeName?: string
  /** Use entry names directly as identifier keys instead of converting to camelCase. */
  preserveNames?: boolean
}

/**
 * Generates a module based off of a map of identifier and name mappings.
 *
 * Example usage:
 * ```ts
 * const module = generateIdentifierModule({
 *   entries: [
 *     { id: 1, name: "Test" },
 *   ],
 *   identifierVariableName: "identifiers",
 *
 *   nameVariableName: "names",
 *   typeName: "TestIdentifier",
 * });
 * ```
 *
 * This will generate the following module:
 * ```ts
 *
 * export const identifiers = {
 *   test: 1
 * } as const;
 *
 * export type TestIdentifier = (typeof identifiers)[number]
 *
 * export const names: Record<TestIdentifier, string> = {
 *   1: "Test"
 * } as const;
 * ```
 * @param spec The specification for the module
 * @returns A string containing the generated module
 */
export const generateIdentifierModule = ({
  entries,
  identifierVariableName,
  nameVariableName,
  typeName,
  preserveNames = false,
}: IdentifierModuleSpec): string => {
  const sortedEntries = [...entries].sort((left, right) => left.id - right.id)

  const identifierMap = new Map<string, number>()
  const nameMap = new Map<number, string>()

  for (const entry of sortedEntries) {
    const identifierKey = preserveNames ? entry.name : toCamelCase(entry.name)
    identifierMap.set(identifierKey, entry.id)
    nameMap.set(entry.id, entry.name)
  }

  const identifierLines = Array.from(identifierMap.entries()).map(([name, id]) => `  ${name}: ${id},`)
  const identifier = [`export const ${identifierVariableName} = {`, identifierLines.join('\n'), '} as const;'].join(
    '\n',
  )

  const nameLines = Array.from(nameMap.entries()).map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`)
  const names = [`export const ${nameVariableName} = {`, nameLines.join('\n'), '} as const;'].join('\n')

  const type = typeName
    ? [`export type ${typeName} = (typeof ${identifierVariableName})[keyof typeof ${identifierVariableName}];`]
    : []

  const module = [identifier, ...type, nameVariableName ? names : null].filter(Boolean).join('\n\n')

  return `${module}\n`
}
