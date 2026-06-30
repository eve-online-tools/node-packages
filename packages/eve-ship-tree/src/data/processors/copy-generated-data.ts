import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'rollup'
import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { generateCssImportModule } from './utils'

const sourceDir = 'src/data/generated'
const targetDir = 'dist/data/generated'
const generatedDir = 'generated'
const iconsDir = 'icons'
const manifestFileName = 'staticDataFiles.jsonl'
const indexFileName = 'index.ts'
const iconsIndexFileName = 'index.css'
const extensions = ['.jsonl'] as const

const scanGeneratedFilenames = (directoryPath: string): string[] =>
  readdirSync(directoryPath)
    .filter((fileName) => {
      if (fileName === manifestFileName) {
        return false
      }

      if (!extensions.some((extension) => fileName.endsWith(extension))) {
        return false
      }

      return statSync(path.join(directoryPath, fileName)).isFile()
    })
    .sort()

const scanIconCssFilenames = (directoryPath: string, relativePrefix = ''): string[] => {
  const results: string[] = []

  for (const fileName of readdirSync(directoryPath).sort()) {
    const absolutePath = path.join(directoryPath, fileName)
    const relativePath = relativePrefix ? `${relativePrefix}/${fileName}` : fileName

    if (statSync(absolutePath).isDirectory()) {
      results.push(...scanIconCssFilenames(absolutePath, relativePath))
      continue
    }

    if (!fileName.endsWith('.css')) {
      continue
    }

    if (relativePath === iconsIndexFileName) {
      continue
    }

    results.push(`./${relativePath}`)
  }

  return results.sort()
}

const generateFilenamesModule = (variableName: string, filenames: readonly string[]): string => {
  const lines = filenames.map((filename) => `  ${JSON.stringify(filename)},`)

  return [`export const ${variableName} = [`, lines.join('\n'), '] as const;', ''].join('\n')
}

export const staticDataFilesProcessor = (): SdeProcessor => ({
  id: 'staticDataFiles',
  version: extensions.join(','),
  run: async ({ resolve, streamJson, writeText }) => {
    const generatedPath = resolve(generatedDir)
    const filenames = scanGeneratedFilenames(generatedPath)

    const out = await streamJson(`${generatedDir}/${manifestFileName}`)

    for (const [index, filename] of filenames.entries()) {
      await out.write({ _key: index, filename })
    }

    await out.close()

    await writeText(`${generatedDir}/${indexFileName}`, generateFilenamesModule('filenames', filenames))

    const iconsPath = resolve(iconsDir)

    if (existsSync(iconsPath)) {
      const cssImports = scanIconCssFilenames(iconsPath)

      await writeText(`${iconsDir}/${iconsIndexFileName}`, generateCssImportModule(cssImports))
    }
  },
})

export const copyGeneratedDataPlugin = (packageDir: string): Plugin => {
  const sourcePath = path.join(packageDir, sourceDir)
  const targetPath = path.join(packageDir, targetDir)

  return {
    name: 'copy-generated-data',
    closeBundle() {
      if (!existsSync(sourcePath)) {
        this.error(`Generated data source directory not found: ${sourcePath}`)
        return
      }

      mkdirSync(targetPath, { recursive: true })

      for (const fileName of readdirSync(sourcePath)) {
        if (!extensions.some((extension) => fileName.endsWith(extension))) {
          continue
        }

        copyFileSync(path.join(sourcePath, fileName), path.join(targetPath, fileName))
      }
    },
  }
}
