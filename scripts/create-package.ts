#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templatesDir = path.join(monorepoRoot, 'scripts/package-templates')

const [type, name] = process.argv.slice(2)

if (!type || !name) {
  console.error('Usage: pnpm create-package <ts|mantine> <package-name>')
  console.error('Example: pnpm create-package mantine market-ui')
  process.exit(1)
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Package name must be lowercase alphanumeric with hyphens.')
  process.exit(1)
}

const templateDir = path.join(templatesDir, type)

if (!fs.existsSync(templateDir)) {
  console.error(`Unknown package type "${type}". Use "ts" or "mantine".`)
  process.exit(1)
}

const targetDir = path.join(monorepoRoot, 'packages', name)

if (fs.existsSync(targetDir)) {
  console.error(`Package directory already exists: packages/${name}`)
  process.exit(1)
}

const packageName = `@eve-online-tools/${name}`
const cssPrefix = type === 'mantine' ? name.replace(/-/g, '').slice(0, 6) : ''

function renderTemplate(content: string): string {
  return content
    .replaceAll('__PACKAGE_NAME__', packageName)
    .replaceAll('__PACKAGE_SLUG__', name)
    .replaceAll('__CSS_PREFIX__', cssPrefix)
}

function copyTemplate(src: string): void {
  if (fs.statSync(src).isDirectory()) {
    for (const entry of fs.readdirSync(src)) {
      copyTemplate(path.join(src, entry))
    }

    return
  }

  const relativePath = path.relative(templateDir, src)
  const outputPath = path.join(targetDir, relativePath.replace(/\.template$/, ''))
  const content = fs.readFileSync(src, 'utf8')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, renderTemplate(content))
}

copyTemplate(templateDir)

console.log(`Created packages/${name} (${type}) as ${packageName}`)
if (type === 'mantine') {
  console.log(`Mantine cssPrefix: ${cssPrefix}`)
}
console.log('Next steps:')
console.log('  1. pnpm install')
console.log(`  2. Add "${packageName}": "workspace:*" to apps/demo and apps/storybook if needed`)
console.log('  3. pnpm build')
