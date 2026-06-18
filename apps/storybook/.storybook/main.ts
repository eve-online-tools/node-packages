import type { StorybookConfig } from "@storybook/react-vite";
import { createWorkspaceAliases } from "../../../internal/vite-config/workspace-aliases";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(storybookDir, "../../../");

function getAbsolutePath(value: string): string {
  return path.dirname(require.resolve(path.join(value, "package.json")));
}

const config: StorybookConfig = {
  stories: ["../../../packages/*/src/**/*.story.@(js|jsx|mjs|ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-essentials")],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  docs: {
    autodocs: false,
  },
  async viteFinal(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      ...createWorkspaceAliases(monorepoRoot),
    };

    return config;
  },
};

export default config;
