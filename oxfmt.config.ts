import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  proseWrap: 'always',
  endOfLine: 'lf',
  semi: false,
  singleAttributePerLine: true,
  ignorePatterns: ['**/*.{cjs,js,d.ts,d.mts}', '**/dist', '.turbo'],
})
