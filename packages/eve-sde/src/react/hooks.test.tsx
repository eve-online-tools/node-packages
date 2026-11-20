import { act, render, screen } from '@testing-library/react'
import { Suspense, type ReactNode } from 'react'
import { dehydrate } from '../core/hydration'
import { createSde, type Sde, type SdeScope } from '../core/sde'
import { fixture } from '../sources/embedded'
import { createFakeSde } from '../test-utils/fake-sde'
import { SdeProvider } from './context'
import { useSdeRow, useSdeRows } from './hooks'

const rifter = { typeID: 587, groupID: 25, name: { en: 'Rifter' } }
const slasher = { typeID: 585, groupID: 25, name: { en: 'Slasher' } }

const fixtureSde = () => createSde({ sources: [fixture({ types: [rifter, slasher] })], updates: 'off' })

const TypeName = ({ typeID }: { typeID: number }) => {
  const row = useSdeRow('types', typeID)
  return <p>{row ? row.name?.en : `missing ${typeID}`}</p>
}

const TypeNames = ({ typeIDs }: { typeIDs: number[] }) => {
  const rows = useSdeRows('types', typeIDs)
  return <p>{[...rows.values()].map((row) => row.name?.en).join(', ')}</p>
}

const wrap = (sde: Sde | SdeScope, ui: ReactNode) => (
  <SdeProvider sde={sde}>
    <Suspense fallback={<p>loading</p>}>{ui}</Suspense>
  </SdeProvider>
)

// React 19 only retries suspended `use()` renders inside an awaited act scope.
const renderWith = (sde: Sde | SdeScope, ui: ReactNode) => act(async () => render(wrap(sde, ui)))

describe('preloaded rows', () => {
  it('render without suspending', async () => {
    const sde = fixtureSde()
    await sde.table('types').preload()
    render(
      wrap(
        sde,
        <>
          <TypeName typeID={587} />
          <TypeName typeID={1} />
          <TypeNames typeIDs={[587, 585]} />
        </>,
      ),
    )
    expect(screen.queryByText('loading')).toBeNull()
    expect(screen.getByText('Rifter')).toBeTruthy()
    expect(screen.getByText('missing 1')).toBeTruthy()
    expect(screen.getByText('Rifter, Slasher')).toBeTruthy()
  })
})

describe('useSdeRow', () => {
  it('suspends, then renders the row', async () => {
    const view = render(wrap(fixtureSde(), <TypeName typeID={587} />))
    expect(screen.getByText('loading')).toBeTruthy()
    view.unmount()

    await renderWith(fixtureSde(), <TypeName typeID={587} />)
    expect(screen.getByText('Rifter')).toBeTruthy()
  })

  it('returns undefined for a missing key', async () => {
    await renderWith(fixtureSde(), <TypeName typeID={1} />)
    expect(screen.getByText('missing 1')).toBeTruthy()
  })

  it('records reads on a scope so dehydrate includes rendered rows', async () => {
    const scope = fixtureSde().scope()
    await renderWith(
      scope,
      <>
        <TypeName typeID={587} />
        <TypeName typeID={1} />
      </>,
    )
    expect((await dehydrate(scope)).rows).toEqual({
      types: [
        [587, rifter],
        [1, null],
      ],
    })
    expect(scope.reads()).toHaveLength(2)
  })

  it('re-renders with the new release after a change event', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter] })
    const sde = createSde({ fetch: fake.fetch, updates: 'off' })
    await renderWith(sde, <TypeName typeID={587} />)
    expect(screen.getByText('Rifter')).toBeTruthy()

    fake.publish('20261119T000000Z', { types: [{ ...rifter, name: { en: 'Rifter II' } }] })
    await act(() => sde.checkForUpdates())

    expect(await screen.findByText('Rifter II')).toBeTruthy()
  })
})

describe('useSdeRows', () => {
  it('renders existing rows and skips missing keys', async () => {
    await renderWith(fixtureSde(), <TypeNames typeIDs={[585, 1, 587]} />)
    expect(screen.getByText('Slasher, Rifter')).toBeTruthy()
  })

  it('re-renders with the new release after a change event', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter, slasher] })
    const sde = createSde({ fetch: fake.fetch, updates: 'off' })
    await renderWith(sde, <TypeNames typeIDs={[587, 585]} />)
    expect(screen.getByText('Rifter, Slasher')).toBeTruthy()

    fake.publish('20261119T000000Z', { types: [{ ...rifter, name: { en: 'Rifter II' } }, slasher] })
    await act(() => sde.checkForUpdates())

    expect(await screen.findByText('Rifter II, Slasher')).toBeTruthy()
  })

  it('returns the same map for the same keys', async () => {
    const maps: Map<number, unknown>[] = []
    const Probe = ({ typeIDs }: { typeIDs: number[] }) => {
      maps.push(useSdeRows('types', typeIDs))
      return <p>rendered</p>
    }
    const sde = fixtureSde()
    const { rerender } = await renderWith(sde, <Probe typeIDs={[587]} />)
    rerender(wrap(sde, <Probe typeIDs={[587]} />))

    expect(maps.length).toBeGreaterThan(1)
    expect(maps.at(-1)).toBe(maps.at(-2))
  })
})
