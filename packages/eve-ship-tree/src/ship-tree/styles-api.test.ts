import { createGetStyles, cx } from './styles-api'

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', undefined, false, 'b')).toBe('a b')
  })

  it('returns undefined when empty', () => {
    expect(cx(undefined, false)).toBeUndefined()
  })
})

describe('createGetStyles', () => {
  const classes = { root: 'root-class', inner: 'inner-class' }

  it('applies className, style and root styles to root only', () => {
    const getStyles = createGetStyles<'root' | 'inner'>(
      classes,
      { className: 'custom', style: { color: 'red' } },
      { margin: 1 },
    )

    expect(getStyles('root')).toEqual({ className: 'root-class custom', style: { margin: 1, color: 'red' } })
    expect(getStyles('inner')).toEqual({ className: 'inner-class', style: undefined })
  })

  it('merges classNames and styles per slot', () => {
    const getStyles = createGetStyles<'root' | 'inner'>(classes, {
      classNames: { inner: 'extra' },
      styles: { inner: { padding: 2 } },
    })

    expect(getStyles('inner')).toEqual({ className: 'inner-class extra', style: { padding: 2 } })
  })

  it('lets style override styles.root', () => {
    const getStyles = createGetStyles<'root'>(classes, { style: { color: 'red' }, styles: { root: { color: 'blue' } } })

    expect(getStyles('root').style).toEqual({ color: 'red' })
  })
})
