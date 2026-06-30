import { normalizeResPath } from './path'
import { toCamelCase } from './string'

export type ResfileMapSpec = {
  exportName: string
  exportDefault?: boolean
  entries: Array<{ key: number; resPath: string }>
}

/**
 * Generates a module based off of a map of resource path identifiers.
 *
 * Example usage:
 * ```ts
 * const module = generateResfileMapModule([
 *   { exportName: "icons", entries: [{ key: 1, resPath: "res:/ui/texture/icons/icon.png" }] },
 * ]);
 * ```
 *
 * This will generate the following module:
 * ```ts
 * import resUiTextureIconsIconPng from "res:/ui/texture/icons/icon.png";
 *
 * export const icons = {
 *   1: resUiTextureIconsIconPng,
 * } as const;
 * ```
 *
 * Up to 1 map can be marked as the default export.
 *
 * @param maps The maps to generate the module for
 * @returns A string containing the generated module
 */
export const generateResfileMapModule = (maps: ResfileMapSpec[]): string => {
  const pathToIdentifier = new Map<string, string>()

  let hasDefault: string | undefined

  for (const map of maps) {
    if (map.exportDefault) {
      if (hasDefault) {
        throw new Error('Multiple default exports found')
      }
      hasDefault = map.exportName
    }
    for (const entry of map.entries) {
      const normalizedPath = normalizeResPath(entry.resPath)

      if (!pathToIdentifier.has(normalizedPath)) {
        pathToIdentifier.set(normalizedPath, toCamelCase(normalizedPath))
      }
    }
  }

  const importLines = [...pathToIdentifier.entries()]
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([resPath, identifier]) => `import ${identifier} from ${JSON.stringify(resPath)};`)

  const exportBlocks = maps.map((map) => {
    const lines = map.entries
      .sort((left, right) => left.key - right.key)
      .map((entry) => {
        const normalizedPath = normalizeResPath(entry.resPath)
        const identifier = pathToIdentifier.get(normalizedPath)!

        return `  ${entry.key}: ${identifier},`
      })

    return `export const ${map.exportName} = {\n${lines.join('\n')}\n} as const;`
  })

  const defaultExport = hasDefault ? `\n\nexport default ${hasDefault};\n` : ''

  return `${importLines.join('\n')}\n\n${exportBlocks.join('\n\n')}\n${defaultExport}`
}
