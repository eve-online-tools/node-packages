/**
 * Generates a simple barrel file export module.
 *
 * Example usage:
 * ```ts
 * const module = generateBarrelExportModule(["icons", "types"]);
 * ```
 *
 * This will generate the following module:
 * ```ts
 * export * from "./icons";
 * export * from "./types";
 * ```
 *
 * @param exports The files to export from
 * @returns A string containing the generated module
 */
export const generateBarrelExportModule = (exports: string[]): string => {
  const exportLines = exports.map((exportName) => `export * from "./${exportName}";`)

  return `${exportLines.join('\n')}\n`
}
