import { rebaseStylesCssUrls } from './prepare-styles'

describe('rebaseStylesCssUrls', () => {
  it('rewrites ../assets/ to ./assets/ for dist/styles.css', () => {
    expect(rebaseStylesCssUrls('.icon { background: url("../assets/icon-abc.png"); }')).toBe(
      '.icon { background: url("./assets/icon-abc.png"); }',
    )
  })

  it('leaves other urls unchanged', () => {
    const input = '.icon { background: url("./local.png"); }'
    expect(rebaseStylesCssUrls(input)).toBe(input)
  })
})
