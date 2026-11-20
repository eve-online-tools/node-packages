#!/usr/bin/env node
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { build, check, fetchBlobs, types, update } from './commands'
import { loadConfig } from './config'

const usage = `Usage: eve-sde <command> [options]

Commands:
  update   Lock the latest SDE release and report changed build tables
  check    Exit with code 1 when the latest release changes build tables, 2 on errors
  fetch    Download locked FlatBuffers files into the cache (--all for every table)
  build    Run datasets without a bundler (--out <dir>, default .eve-sde/datasets)
  types    Write row types for the locked release to the configured dts file

Options:
  --root <dir>  Project root holding eve-sde.config.ts (default: current directory)`

const log = (line: string): void => {
  process.stdout.write(`${line}\n`)
}

const main = async (): Promise<number> => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      out: { type: 'string' },
      all: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const [command] = positionals
  if (values.help || !command) {
    log(usage)
    return command || values.help ? 0 : 1
  }

  const root = resolve(values.root ?? process.cwd())
  const config = await loadConfig(root)
  switch (command) {
    case 'update':
      await update({ config, log })
      return 0
    case 'check':
      return (await check({ config, log })).changed.length > 0 ? 1 : 0
    case 'fetch':
      await fetchBlobs({ config, log, all: values.all })
      return 0
    case 'build':
      await build({ config, log, outDir: resolve(root, values.out ?? '.eve-sde/datasets') })
      return 0
    case 'types':
      await types({ config, log })
      return 0
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${usage}\n`)
      return 1
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    // Distinct from `check`'s "changes available".
    process.exitCode = 2
  },
)
