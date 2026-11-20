import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { createSde } from '../core/sde'
import { fixture } from '../sources/embedded'
import { createFakeSde } from '../test-utils/fake-sde'
import { connectQueryClient, sdeQueries } from './index'

const rifter = { typeID: 587, groupID: 25, name: { en: 'Rifter' } }
const slasher = { typeID: 585, groupID: 25, name: { en: 'Slasher' } }

describe('sdeQueries', () => {
  const queries = sdeQueries(createSde({ sources: [fixture({ types: [rifter, slasher] })], updates: 'off' }))

  it('fetches a row, or null when missing', async () => {
    const client = new QueryClient()
    expect(queries.row('types', 587).queryKey).toEqual(['eve-sde', 'types', 587])
    expect(await client.fetchQuery(queries.row('types', 587))).toEqual(rifter)
    expect(await client.fetchQuery(queries.row('types', 1))).toBeNull()
  })

  it('fetches existing rows in key order', async () => {
    const client = new QueryClient()
    expect(await client.fetchQuery(queries.rows('types', [587, 1, 585]))).toEqual([rifter, slasher])
  })
})

describe('connectQueryClient', () => {
  it('invalidates queries of changed tables so they refetch', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter] })
    const sde = createSde({ fetch: fake.fetch, updates: 'off' })
    const client = new QueryClient()
    const disconnect = connectQueryClient(sde, client)
    const TypeName = () => <p>{useSuspenseQuery(sdeQueries(sde).row('types', 587)).data?.name?.en}</p>
    render(
      <QueryClientProvider client={client}>
        <Suspense fallback={<p>loading</p>}>
          <TypeName />
        </Suspense>
      </QueryClientProvider>,
    )
    await screen.findByText('Rifter')

    fake.publish('20261119T000000Z', { types: [{ ...rifter, name: { en: 'Rifter II' } }] })
    await act(() => sde.checkForUpdates())

    expect(await screen.findByText('Rifter II')).toBeTruthy()
    disconnect()
  })
})
