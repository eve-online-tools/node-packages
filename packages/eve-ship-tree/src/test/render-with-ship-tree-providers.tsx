import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

import { filenames } from '../data/generated'
import { DataProvider, type Data } from '../data-provider'
import { SkillsProvider, type SkillsInput } from '../skills-provider'

export const emptyData = (): Data =>
  Object.fromEntries(filenames.map((fileName) => [fileName.replace(/\.jsonl$/, ''), {}])) as Data

export type RenderWithShipTreeProvidersOptions = {
  skills?: SkillsInput
  data?: Data
  baseUrl?: string
  fetch?: typeof fetch
} & Omit<RenderOptions, 'wrapper'>

export const renderWithShipTreeProviders = (
  ui: ReactElement,
  { skills = {}, data = emptyData(), baseUrl, fetch, ...options }: RenderWithShipTreeProvidersOptions = {},
): RenderResult =>
  render(
    <MantineProvider>
      <SkillsProvider skills={skills}>
        {baseUrl !== undefined ? (
          <DataProvider
            baseUrl={baseUrl}
            fetch={fetch}
          >
            {ui}
          </DataProvider>
        ) : (
          <DataProvider data={data}>{ui}</DataProvider>
        )}
      </SkillsProvider>
    </MantineProvider>,
    options,
  )
