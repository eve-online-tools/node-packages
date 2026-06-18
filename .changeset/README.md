# Changesets

This monorepo uses [Changesets](https://github.com/changesets/changesets) for independent versioning of `@eve-online-tools/*` packages.

## Adding a changeset

When a PR changes a publishable package under `packages/`, add a changeset:

```bash
pnpm changeset
```

Follow the prompts: pick packages, choose bump type (`patch` / `minor` / `major`), write a short summary for the changelog.

Commit the generated file in `.changeset/`.

## Release flow (CI)

1. Merge PRs to `main` with changeset files.
2. GitHub Actions opens or updates a **Version packages** PR (version bumps + changelogs).
3. Merge the Version packages PR.
4. CI builds, publishes changed packages to npm, and creates git tags.

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) from `.github/workflows/release.yml` — no `NPM_TOKEN` secret. Each package needs a trusted publisher configured on npm; see the README **Trusted publishing** section.

## Local commands

| Command | Description |
|---------|-------------|
| `pnpm changeset` | Create a new changeset |
| `pnpm version-packages` | Apply changesets locally (usually done by CI) |
| `pnpm release` | Build and publish (CI only — needs npm auth) |

Private workspace packages (`apps/*`, `internal/@repo/*`) are ignored by Changesets.
