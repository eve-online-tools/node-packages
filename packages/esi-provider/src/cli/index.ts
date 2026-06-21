import { parseArgs } from 'node:util'

import { downloadSpec } from './commands/download-spec'
import { updateCompatibilityDate } from './commands/update-compatibility-date'

const COMMANDS = new Set(['update-compatibility-date', 'download-spec'])

const printUsage = (): void => {
  console.log(`Usage:
  esi-provider update-compatibility-date -o, --output <dir>
  esi-provider download-spec -o, --output <dir> [--update-only]`)
}

const main = async (): Promise<void> => {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    process.exit(command ? 0 : 1)
  }

  if (!COMMANDS.has(command)) {
    console.error(`Unknown command "${command}".`)
    printUsage()
    process.exit(1)
  }

  const { values } = parseArgs({
    args: rest,
    options: {
      output: { type: 'string', short: 'o' },
      'update-only': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })

  if (!values.output) {
    console.error(`Missing required option -o, --output for "${command}".`)
    printUsage()
    process.exit(1)
  }

  if (command === 'update-compatibility-date') {
    await updateCompatibilityDate(values.output)
    return
  }

  await downloadSpec({
    outputDir: values.output,
    updateOnly: values['update-only'],
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
