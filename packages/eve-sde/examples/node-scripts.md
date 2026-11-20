# Node scripts and servers

Without a bundler, create an instance yourself.

## Latest release over HTTP

```ts
import { sde } from '@eve-online-tools/eve-sde'

const rifter = await sde.table('types').get(587)
```

The shared `sde` reads every table from the latest release, one request per row. For many lookups in one table, download
the table once:

```ts
import { createSde, remote } from '@eve-online-tools/eve-sde'

const local = createSde({ sources: [remote({ get: 'bulk' })] })
```

## Locked release from local files

For reproducible output, pin a release with the lockfile and read the FlatBuffers files from the cache:

```bash
pnpm exec eve-sde update # writes eve-sde.lock.json
pnpm exec eve-sde fetch --all # optional: download every table up front
```

```ts
import { createSde } from '@eve-online-tools/eve-sde'
import { files, lockfileManifest, readLockfile } from '@eve-online-tools/eve-sde/node'

const lockfile = await readLockfile('eve-sde.lock.json')
if (!lockfile) {
  throw new Error('Run `eve-sde update` first.')
}

const local = createSde({
  release: lockfileManifest(lockfile), // no request to resolve the release
  sources: [files({ lockfile, cacheDir: '.cache/eve-sde' })],
  updates: 'off',
})

for await (const group of local.table('groups').list({ fields: ['groupID', 'name'] })) {
  console.log(group.groupID, group.name.en)
}
```

`files` downloads missing tables on first use and checks them against the locked hashes. Pass `download: false` on
servers that must not reach the network.

Without a config file, `eve-sde update` writes `eve-sde.lock.json` in the current directory. `createLockfile` and
`writeLockfile` from `/node` do the same in code.

## CI

```yaml
- uses: actions/cache@v4
  with:
    path: .cache/eve-sde
    key: eve-sde-${{ hashFiles('eve-sde.lock.json') }}
- run: pnpm exec eve-sde check # fails when the latest release changes build tables
```

`eve-sde check` exits with code 1 when a newer release changes a table used by `embed`, `files` or a dataset, and with
code 2 on errors such as a missing lockfile. Run it on
a schedule to get notified, then run `eve-sde update` locally and commit the lockfile.
