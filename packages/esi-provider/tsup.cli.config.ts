import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli/index.ts" },
  format: ["esm"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  banner: { js: "#!/usr/bin/env node" },
  clean: false,
  external: ["openapi-typescript"],
});
