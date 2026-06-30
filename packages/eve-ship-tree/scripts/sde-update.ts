import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sdeLatestUrl } from '../../eve-sde/src/constants'
import { fetchText } from '../../eve-sde/src/fetch'

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rollupConfigPath = path.join(packageDir, 'rollup.config.ts')
const buildNumberPattern = /const SDE_BUILD_NUMBER = '(\d+)'/

type LatestSdeRecord = {
  _key?: string
  buildNumber?: number | string
}

const readPinnedBuildNumber = (): string | null => {
  const content = readFileSync(rollupConfigPath, 'utf8')
  const match = content.match(buildNumberPattern)
  return match?.[1] ?? null
}

const fetchLatestBuildNumber = async (): Promise<string> => {
  const latestText = await fetchText(sdeLatestUrl)
  const records = latestText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LatestSdeRecord)

  const sdeRecord = records.find((record) => record._key === 'sde')
  if (!sdeRecord?.buildNumber) {
    throw new Error(`Missing SDE buildNumber in ${sdeLatestUrl}.`)
  }

  return String(sdeRecord.buildNumber)
}

const resolveTargetBuildNumber = async (argument?: string): Promise<string> => {
  if (argument === undefined) {
    return fetchLatestBuildNumber()
  }

  if (!/^\d+$/.test(argument)) {
    throw new Error(`Expected numeric SDE build number, received "${argument}".`)
  }

  return argument
}

const updatePinnedBuildNumber = (buildNumber: string): boolean => {
  const content = readFileSync(rollupConfigPath, 'utf8')
  const updated = content.replace(buildNumberPattern, `const SDE_BUILD_NUMBER = '${buildNumber}'`)

  if (!buildNumberPattern.test(content)) {
    throw new Error(`Could not find SDE_BUILD_NUMBER in ${rollupConfigPath}.`)
  }

  if (updated === content) {
    return false
  }

  writeFileSync(rollupConfigPath, updated)
  return true
}

const main = async (): Promise<void> => {
  const targetBuildNumber = await resolveTargetBuildNumber(process.argv[2])
  const pinnedBuildNumber = readPinnedBuildNumber()

  if (pinnedBuildNumber === targetBuildNumber) {
    console.log(`SDE build already pinned to ${targetBuildNumber}. Running build...`)
  } else {
    console.log(`Updating SDE build ${pinnedBuildNumber ?? 'unknown'} → ${targetBuildNumber}`)
    updatePinnedBuildNumber(targetBuildNumber)
  }

  execSync('pnpm run build', { cwd: packageDir, stdio: 'inherit' })
  console.log(`SDE data regenerated for build ${targetBuildNumber}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
