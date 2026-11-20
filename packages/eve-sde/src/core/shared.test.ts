// Each dynamic import after resetModules is a separate copy of the package, as when Vite SSR loads a library's copy
// from node_modules next to the app's bundled one.
const loadCopy = async () => {
  vi.resetModules()
  const [global, core] = await Promise.all([import('../global'), import('./sde')])
  return { sde: global.sde, getInternals: core.getInternals, createSde: core.createSde }
}

describe('package copies', () => {
  it('share the default instance and its internals', async () => {
    const first = await loadCopy()
    const second = await loadCopy()

    expect(first.sde).not.toBe(second.sde)
    expect(first.sde.scope().parent).toBe(second.sde.scope().parent)
    expect(() => second.getInternals(first.createSde({ updates: 'off' }))).not.toThrow()
  })

  it('replace the default instance when the generated config is reloaded', async () => {
    const config = '@eve-online-tools/eve-sde/config'
    vi.doMock(config, () => ({ default: () => ({ updates: 'off' }) }))
    const before = (await loadCopy()).sde.scope().parent
    vi.doMock(config, () => ({ default: () => ({ updates: 'off' }) }))
    const after = (await loadCopy()).sde.scope().parent
    vi.doUnmock(config)

    expect(after).not.toBe(before)
  })
})
