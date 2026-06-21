import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import signale from 'signale'

const packageDir = process.env.MANTINE_PACKAGE_DIR ?? process.cwd()

function loadPackageJson(): Record<string, any> {
  const packageJsonPath = path.join(packageDir, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  return packageJson
}

function emitDeclarations(): void {
  const tsconfigBuildPath = path.join(packageDir, 'tsconfig.build.json')
  const typesDir = path.join(packageDir, 'dist/types')
  const indexDts = path.join(typesDir, 'index.d.ts')
  const indexDmts = path.join(typesDir, 'index.d.mts')

  execSync(`pnpm exec tsc --project ${JSON.stringify(tsconfigBuildPath)}`, {
    cwd: packageDir,
    stdio: 'inherit',
  })

  if (!fs.existsSync(indexDts)) {
    signale.error(`Declaration entry not found: ${indexDts}`)
    process.exit(1)
  }

  fs.copyFileSync(indexDts, indexDmts)
}

function prepareStyles(): void {
  const packageJson = loadPackageJson()
  if (!Object.keys(packageJson.exports).some((key) => key.endsWith('.css'))) {
    signale.info(`No styles.css export found in package.json for ${path.basename(packageDir)}`)
    return
  }
  const rollupCssFilePath = path.join(packageDir, 'dist/esm/index.css')

  if (!fs.existsSync(rollupCssFilePath)) {
    signale.error('CSS file not found at dist/esm/index.css. Ensure the package entry imports component CSS modules.')
    process.exit(1)
  }

  const content = fs.readFileSync(rollupCssFilePath, 'utf-8')

  if (!content.trim()) {
    signale.error('Extracted CSS is empty.')
    process.exit(1)
  }

  fs.writeFileSync(path.join(packageDir, 'dist/styles.css'), content)
  fs.writeFileSync(path.join(packageDir, 'dist/styles.layer.css'), `@layer mantine {${content}}`)

  fs.rmSync(rollupCssFilePath)
  fs.rmSync(path.join(packageDir, 'dist/cjs/index.css'))
}

async function postBuild(): Promise<void> {
  try {
    emitDeclarations()
    prepareStyles()
    signale.success(`Post-build complete for ${path.basename(packageDir)}`)
  } catch (err) {
    signale.error('Mantine package post-build failed')
    signale.error(err)
    process.exit(1)
  }
}

void postBuild()
