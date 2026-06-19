import fs from "node:fs";
import path from "node:path";
import type { Alias, AliasOptions } from "vite";

/**
 * Vite aliases for workspace packages.
 * - Exact package imports resolve to source for HMR.
 * - styles.css subpaths resolve to built dist files.
 */
export function createWorkspaceAliases(monorepoRoot: string): Alias[] {
  const packagesDir = path.join(monorepoRoot, "packages");
  const aliases: Alias[] = [];

  if (!fs.existsSync(packagesDir)) {
    return aliases;
  }

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };
    const srcDir = path.join(packageDir, "src");
    const indexFile = path.join(srcDir, "index.ts");

    if (!packageJson.name || !fs.existsSync(indexFile)) {
      continue;
    }

    aliases.push({
      find: packageJson.name,
      replacement: indexFile,
    });

    const stylesPath = path.join(packageDir, "dist/styles.css");
    const stylesLayerPath = path.join(packageDir, "dist/styles.layer.css");

    if (fs.existsSync(stylesPath)) {
      aliases.push({
        find: `${packageJson.name}/styles.css`,
        replacement: stylesPath,
      });
    }

    if (fs.existsSync(stylesLayerPath)) {
      aliases.push({
        find: `${packageJson.name}/styles.layer.css`,
        replacement: stylesLayerPath,
      });
    }
  }

  return aliases;
}

export function mergeAliases(...groups: (AliasOptions | undefined)[]): Alias[] {
  const merged: Alias[] = [];

  for (const group of groups) {
    if (!group) {
      continue;
    }

    if (Array.isArray(group)) {
      merged.push(...group);
      continue;
    }

    for (const [find, replacement] of Object.entries(group)) {
      merged.push({ find, replacement });
    }
  }

  return merged;
}

export function resolveMonorepoRoot(fromDir: string, depth = 2): string {
  return path.resolve(fromDir, "../".repeat(depth));
}
