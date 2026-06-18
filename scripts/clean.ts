#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ephemeralDirs = new Set([".turbo", "dist", "coverage", "storybook-static", ".cache"]);
const ephemeralFiles = new Set([".stylelintcache"]);

function remove(relativePath: string): void {
  const absolutePath = path.join(monorepoRoot, relativePath);
  fs.rmSync(absolutePath, { recursive: true, force: true });
  console.log(`Removed ${relativePath}`);
}

function cleanDirectory(directory: string): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }

      if (ephemeralDirs.has(entry.name)) {
        remove(path.relative(monorepoRoot, absolutePath));
        continue;
      }

      cleanDirectory(absolutePath);
      continue;
    }

    if (ephemeralFiles.has(entry.name) || entry.name.endsWith(".tsbuildinfo")) {
      remove(path.relative(monorepoRoot, absolutePath));
    }
  }
}

cleanDirectory(monorepoRoot);
