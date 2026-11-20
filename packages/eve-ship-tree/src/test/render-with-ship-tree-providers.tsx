import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

import { DataProvider, type Data, type ShipTreeDataSource } from '../data-provider'
import { SkillsProvider, type SkillsInput, type SkillTraining } from '../skills-provider'

export const emptyData = (): Data => ({
  types: {},
  requiredSkills: {},
  certificates: {},
  masteries: {},
  cloneGrades: {},
  shipTreeGroups: {},
  shipSizes: {},
  skills: {},
  shipTreeElements: {},
  shipTreeFactions: {},
  typeBonus: {},
  typeElements: {},
})

export type RenderWithShipTreeProvidersOptions = {
  skills?: SkillsInput
  training?: SkillTraining
  data?: Data
  dataset?: ShipTreeDataSource
  fetch?: typeof fetch
} & Omit<RenderOptions, 'wrapper'>

export const renderWithShipTreeProviders = (
  ui: ReactElement,
  { skills = {}, training, data = emptyData(), dataset, fetch, ...options }: RenderWithShipTreeProvidersOptions = {},
): RenderResult =>
  render(
    <SkillsProvider
      skills={skills}
      training={training}
    >
      {dataset !== undefined ? (
        <DataProvider
          dataset={dataset}
          fetch={fetch}
        >
          {ui}
        </DataProvider>
      ) : (
        <DataProvider data={data}>{ui}</DataProvider>
      )}
    </SkillsProvider>,
    options,
  )
