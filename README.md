# node-packages monorepo

pnpm + Turborepo monorepo for `@eve-online-tools/*` packages: Mantine component libraries and pure TypeScript utilities.

## Structure

```text
apps/
  demo/          Vite showcase for components
  storybook/     Storybook for component development
packages/
  eve-resfile/   resfile index loader for Vite and Rollup
internal/
  mantine-build/ Shared Rollup + post-build pipeline (@repo/mantine-build)
  tsconfig/      Shared TypeScript configs (@repo/tsconfig)
  vite-config/   Workspace source aliases for Vite dev HMR (@repo/vite-config)
```

Shared dependency versions are defined in `pnpm-workspace.yaml` (`catalog`).

## Get started

```bash
cd node-packages
nvm use
pnpm install
pnpm build
pnpm test
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev:demo` | Vite demo at http://localhost:9281 |
| `pnpm storybook` | Storybook at http://localhost:8271 |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Full quality gate (syncpack, format, typecheck, lint, tests) |
| `pnpm create-package` | Scaffold a new `ts` or `mantine` package |

Stories live next to components: `packages/*/src/**/*.story.tsx`.

Vite and Storybook alias workspace packages to `packages/*/src` for HMR. Subpath exports like `styles.css` still resolve from `dist/` — run `pnpm build` once before first dev session if you rely on aggregated CSS files.

## Adding packages

### Scaffold (recommended)

```bash
pnpm create-package ts my-utils
pnpm create-package mantine market-ui
pnpm install
pnpm build
```

Then add `workspace:*` dependencies in `apps/demo` and `apps/storybook` as needed.

## Releasing packages

Uses [Changesets](https://github.com/changesets/changesets) for independent `@eve-online-tools/*` versions.

### Day to day

1. Change code in `packages/*`.
2. Run `pnpm changeset` and commit the file in `.changeset/`.
3. Open a PR — CI runs `pnpm test`.

### Release train (on merge to `main`)

1. CI opens or updates a **Version packages** PR (version bumps + changelogs).
2. Merge that PR.
3. CI builds, publishes changed packages to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC — no `NPM_TOKEN`), and creates git tags plus GitHub releases.

Each publishable package must have a trusted publisher configured on npm before its first CI release (see below).

See [.changeset/README.md](.changeset/README.md). To keep a package internal, set `"private": true` and add it to `ignore` in `.changeset/config.json`.

### Trusted publishing (new packages)

CI publishes with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers): GitHub Actions proves its identity via OIDC, so no long-lived npm token is stored in repository secrets. Provenance attestations are generated automatically.

For each new `@eve-online-tools/*` package:

1. **Publish once manually** — the package must already exist on npm before you can configure a trusted publisher. From the package directory, after a changeset has bumped its version:
   ```bash
   pnpm build
   npm publish --access public
   ```
2. **Add a trusted publisher** on [npmjs.com](https://www.npmjs.com) → Packages → *your package* → Settings → Trusted publishing → GitHub Actions:
   - **Organization or user:** `eve-online-tools`
   - **Repository:** `node-packages`
   - **Workflow filename:** `release.yml`
3. **Restrict token publishing (recommended)** — on the same package settings page, set Publishing access to **Require two-factor authentication and disallow tokens**. Trusted publishing continues to work; automation tokens no longer can.

Ensure `repository.url` in the package `package.json` matches `https://github.com/eve-online-tools/node-packages.git` (the scaffolder templates already set this). npm rejects OIDC publishes when the URL does not match the GitHub repository.

After setup, all subsequent releases are handled by the release train — merge the Version packages PR and CI publishes automatically.
