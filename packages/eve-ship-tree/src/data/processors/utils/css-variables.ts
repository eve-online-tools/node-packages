import { normalizeResPath } from './path'
import { toKebabCase } from './string'

export type CssVariablesSpec = {
  dataAttribute: string
  prefix: string
  entries: Array<{
    id: number
    variables: Record<string, string>
  }>
}

export type ResfileCssMapSpec = {
  exportName: string
  entries: Array<{ key: number; resPath: string }>
}

export type ResfileCssSpec = {
  dataAttribute: string
  prefix: string
  maps: ResfileCssMapSpec[]
}

const cssUrlValue = (resPath: string): string => `url("${normalizeResPath(resPath)}")`

const cssVariableName = (prefix: string, name: string): string => `--${prefix}-${toKebabCase(name)}`

/**
 * Generates a CSS module with data-attribute-scoped custom properties.
 *
 * Example usage:
 * ```ts
 * const module = generateCssVariablesModule({
 *   dataAttribute: "faction",
 *   prefix: "factions",
 *   entries: [
 *     {
 *       id: 500001,
 *       variables: { flatLogo: 'url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png")' },
 *     },
 *   ],
 * });
 * ```
 *
 * This will generate:
 * ```css
 * [data-faction="500001"] {
 *   --factions-flat-logo: url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png");
 * }
 * ```
 */
export const generateCssVariablesModule = ({ dataAttribute, prefix, entries }: CssVariablesSpec): string => {
  const sortedEntries = [...entries].sort((left, right) => left.id - right.id)

  const blocks = sortedEntries.map(({ id, variables }) => {
    const lines = Object.keys(variables)
      .sort()
      .map((name) => `  ${cssVariableName(prefix, name)}: ${variables[name]};`)

    return [`[data-${dataAttribute}="${id}"] {`, ...lines, '}'].join('\n')
  })

  return `${blocks.join('\n\n')}\n`
}

/**
 * Generates a CSS module from resource path maps, mirroring generateResfileMapModule.
 */
export const generateResfileCssModule = ({ dataAttribute, prefix, maps }: ResfileCssSpec): string => {
  const variablesByKey = new Map<number, Record<string, string>>()

  for (const map of maps) {
    for (const entry of map.entries) {
      const variables = variablesByKey.get(entry.key) ?? {}
      variables[map.exportName] = cssUrlValue(entry.resPath)
      variablesByKey.set(entry.key, variables)
    }
  }

  const entries = [...variablesByKey.entries()].map(([id, variables]) => ({
    id,
    variables,
  }))

  return generateCssVariablesModule({ dataAttribute, prefix, entries })
}

/**
 * Generates a CSS barrel file that imports other CSS modules.
 */
export const generateCssImportModule = (imports: string[]): string => {
  const importLines = imports.map((importPath) => `@import "${importPath}";`)

  return `${importLines.join('\n')}\n`
}
