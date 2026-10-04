import fs from 'node:fs'
import path from 'node:path'
import type { Alias, AliasOptions } from 'vite'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Vite aliases for workspace packages.
 * - Exact package imports resolve to source for HMR.
 * - Subpath exports with a `src/<subpath>/index.ts` resolve to source.
 * - styles.css subpaths resolve to built dist files.
 */
export function createWorkspaceAliases(monorepoRoot: string): Alias[] {
  const packagesDir = path.join(monorepoRoot, 'packages')
  const aliases: Alias[] = []

  if (!fs.existsSync(packagesDir)) {
    return aliases
  }

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageDir = path.join(packagesDir, entry.name)
    const packageJsonPath = path.join(packageDir, 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      continue
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      exports?: Record<string, unknown>
    }
    const srcDir = path.join(packageDir, 'src')
    const indexFile = path.join(srcDir, 'index.ts')

    if (!packageJson.name || !fs.existsSync(indexFile)) {
      continue
    }

    // Subpath entries (e.g. `pkg/react`) that have a matching `src/<subpath>/index.ts`
    for (const subpath of Object.keys(packageJson.exports ?? {})) {
      const subpathIndex = path.join(srcDir, subpath, 'index.ts')
      if (subpath.startsWith('./') && !subpath.includes('*') && fs.existsSync(subpathIndex)) {
        aliases.push({
          find: new RegExp(`^${escapeRegExp(`${packageJson.name}/${subpath.slice(2)}`)}$`),
          replacement: subpathIndex,
        })
      }
    }

    aliases.push({
      find: `${packageJson.name}$`,
      replacement: indexFile,
    })

    const stylesPath = path.join(packageDir, 'dist/styles.css')
    const stylesLayerPath = path.join(packageDir, 'dist/styles.layer.css')

    if (fs.existsSync(stylesPath)) {
      aliases.push({
        find: `${packageJson.name}/styles.css`,
        replacement: stylesPath,
      })
    }

    if (fs.existsSync(stylesLayerPath)) {
      aliases.push({
        find: `${packageJson.name}/styles.layer.css`,
        replacement: stylesLayerPath,
      })
    }
  }

  return aliases
}

export function mergeAliases(...groups: (AliasOptions | undefined)[]): Alias[] {
  const merged: Alias[] = []

  for (const group of groups) {
    if (!group) {
      continue
    }

    if (Array.isArray(group)) {
      merged.push(...group)
      continue
    }

    for (const [find, replacement] of Object.entries(group)) {
      merged.push({ find, replacement })
    }
  }

  return merged
}

export function resolveMonorepoRoot(fromDir: string, depth = 2): string {
  return path.resolve(fromDir, '../'.repeat(depth))
}
