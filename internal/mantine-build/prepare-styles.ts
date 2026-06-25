/** Rebases asset URLs when extracted CSS is moved from dist/esm/index.css to dist/styles.css. */
export const rebaseStylesCssUrls = (content: string): string => content.replaceAll('../assets/', './assets/')
