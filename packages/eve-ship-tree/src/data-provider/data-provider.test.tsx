import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { identifiers as factions } from '../data/identifiers/shipTreeFactions'
import { lockedCaldariSkills, minimalShipTreeData, unlockedCaldariSkills } from './__fixtures__/minimal-data'
import { DataProvider } from './data-provider'
import { useDataStatus } from './use-data'
import { useProcessedData } from './use-processed-data'
import { identifiers as groups } from '../data/identifiers/shipTreeGroups'
import { SkillsProvider } from '../skills-provider'
import { renderWithShipTreeProviders } from '../test/render-with-ship-tree-providers'
import { MantineProvider } from '@mantine/core'

const ProcessedConsumer = () => {
  const { shipTreeGroups } = useProcessedData()

  return (
    <span data-testid="group-status">
      {shipTreeGroups[groups.frigate]?.factions[factions.caldariState]?.status ?? 'missing'}
    </span>
  )
}

describe('DataProvider', () => {
  it('serves processed data immediately for inline data', () => {
    renderWithShipTreeProviders(<ProcessedConsumer />, {
      data: minimalShipTreeData(),
      skills: unlockedCaldariSkills,
    })

    expect(screen.getByTestId('group-status')).toHaveTextContent('unlocked')
  })

  it('reflects updated unlock state when skills change', () => {
    const data = minimalShipTreeData()

    const { rerender } = render(
      <MantineProvider>
        <SkillsProvider skills={lockedCaldariSkills}>
          <DataProvider data={data}>
            <ProcessedConsumer />
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>,
    )

    expect(screen.getByTestId('group-status')).toHaveTextContent('locked')

    rerender(
      <MantineProvider>
        <SkillsProvider skills={unlockedCaldariSkills}>
          <DataProvider data={data}>
            <ProcessedConsumer />
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>,
    )

    expect(screen.getByTestId('group-status')).toHaveTextContent('unlocked')
  })

  it('keeps processed output stable across parent rerenders with identical data', () => {
    const data = minimalShipTreeData()
    const refs: unknown[] = []

    const RefProbe = () => {
      refs.push(useProcessedData())
      return null
    }

    const Parent = ({ token }: { token: number }) => (
      <>
        <span>{token}</span>
        <RefProbe />
      </>
    )

    const { rerender } = renderWithShipTreeProviders(<Parent token={1} />, {
      data,
      skills: unlockedCaldariSkills,
    })

    rerender(
      <MantineProvider>
        <SkillsProvider skills={unlockedCaldariSkills}>
          <DataProvider data={data}>
            <Parent token={2} />
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>,
    )

    expect(refs).toHaveLength(2)
    expect(refs[0]).toBe(refs[1])
  })

  it('loads data from baseUrl and exposes processed output', async () => {
    const fetchImpl = vi.fn(async () => new Response('\n', { status: 200 }))

    const StatusConsumer = () => {
      const { status } = useDataStatus()
      return <span data-testid="status">{status}</span>
    }

    renderWithShipTreeProviders(<StatusConsumer />, {
      baseUrl: '/ship-tree-data',
      fetch: fetchImpl as typeof fetch,
    })

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    })
  })

  it('ignores stale fetch responses when baseUrl changes quickly', async () => {
    let resolveFirst: ((value: Response) => void) | undefined
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('slow-base')) {
        return firstFetch
      }

      return Promise.resolve(new Response('\n', { status: 200 }))
    })

    const StatusConsumer = () => {
      const { status } = useDataStatus()
      return <span data-testid="status">{status}</span>
    }

    const { rerender } = renderWithShipTreeProviders(<StatusConsumer />, {
      baseUrl: '/slow-base',
      fetch: fetchImpl as typeof fetch,
    })

    rerender(
      <MantineProvider>
        <SkillsProvider skills={{}}>
          <DataProvider
            baseUrl="/fast-base"
            fetch={fetchImpl as typeof fetch}
          >
            <StatusConsumer />
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>,
    )

    resolveFirst?.(new Response('\n', { status: 200 }))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    })
  })
})
