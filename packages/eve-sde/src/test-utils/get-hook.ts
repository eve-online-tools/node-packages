export const getHook = <T extends (...args: never[]) => unknown>(
  hook: T | { handler: T } | undefined,
): T | undefined => {
  if (!hook) {
    return undefined
  }
  if (typeof hook === 'function') {
    return hook
  }
  return hook.handler
}
