import postcss from 'postcss'

import { createResfileBuildContext, cssPlaceholderToken } from '../context'
import { createResfilePostcssPlugin } from './plugin'

describe('postcss plugin', () => {
  it('rewrites url(res:/…) declarations to placeholders', async () => {
    const ctx = createResfileBuildContext({ root: '/tmp' }, '/tmp')
    const result = await postcss([createResfilePostcssPlugin(ctx)]).process(
      '.icon { background-image: url("res:/icons/64/icon.png"); }',
      { from: undefined },
    )

    expect(result.css).not.toContain('res:/icons/64/icon.png')
    expect(result.css).toMatch(/url\(__EVE_RESFILE_[a-f0-9]+__\)/)
    expect(ctx.cssPlaceholders.size).toBe(1)
    expect([...ctx.cssPlaceholders.values()]).toEqual(['res:/icons/64/icon.png'])
  })

  it('deduplicates placeholders for repeated res paths', async () => {
    const ctx = createResfileBuildContext({ root: '/tmp' }, '/tmp')
    const result = await postcss([createResfilePostcssPlugin(ctx)]).process(
      `.a { background: url('res:/icons/64/icon.png'); }
       .b { background: url('res:/icons/64/icon.png'); }`,
      { from: undefined },
    )

    const matches = result.css.match(/__EVE_RESFILE_[a-f0-9]+__/g)
    expect(matches).toHaveLength(2)
    expect(new Set(matches).size).toBe(1)
    expect(ctx.cssPlaceholders.size).toBe(1)
    expect(ctx.cssPlaceholderByResPath.size).toBe(1)
  })

  it('leaves non-res urls unchanged', async () => {
    const ctx = createResfileBuildContext({ root: '/tmp' }, '/tmp')
    const input = '.icon { background-image: url("./local.png"); }'
    const result = await postcss([createResfilePostcssPlugin(ctx)]).process(input, { from: undefined })

    expect(result.css).toBe(input)
    expect(ctx.cssPlaceholders.size).toBe(0)
  })

  it('rewrites url(res:/…) declarations to dev proxy urls', async () => {
    const ctx = createResfileBuildContext({ root: '/tmp' }, '/tmp')
    const result = await postcss([createResfilePostcssPlugin(ctx, { target: 'dev-proxy' })]).process(
      '.icon { background-image: url("res:/icons/64/icon.png"); }',
      { from: undefined },
    )

    expect(result.css).toBe('.icon { background-image: url(/__eve_res__/icons%2F64%2Ficon.png); }')
    expect(ctx.cssPlaceholders.size).toBe(0)
  })
})

describe('cssPlaceholderToken', () => {
  it('wraps ids in stable markers', () => {
    expect(cssPlaceholderToken('abc123')).toBe('__EVE_RESFILE_abc123__')
  })
})
