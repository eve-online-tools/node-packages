import { screen } from '@testing-library/react'

import { minimalShipTreeData } from '../../data-provider/__fixtures__/minimal-data'
import { identifiers as factions } from '../../data/identifiers/shipTreeFactions'
import { identifiers as groups } from '../../data/identifiers/shipTreeGroups'
import { renderWithShipTreeProviders } from '../../test/render-with-ship-tree-providers'
import { GroupTooltip, resolveSkillLevelStates } from './group-tooltip'

const tooltipData = () => {
  const data = minimalShipTreeData()

  return {
    ...data,
    shipTreeGroups: {
      [groups.frigate]: {
        ...data.shipTreeGroups[groups.frigate],
        name: { en: 'Frigate' },
        description: { en: 'Small, fast but fragile vessels.' },
        preReqSkills: [
          {
            _key: factions.caldariState,
            skills: [
              { _key: 3330, display: true, level: 1 },
              { _key: 3327, display: false, level: 1 },
            ],
          },
          {
            _key: factions.guristasPirates,
            skills: [
              { _key: 3328, display: true, level: 3 },
              { _key: 3330, display: true, level: 3 },
            ],
          },
        ],
      },
    },
    shipTreeElements: { 30: { name: { en: 'Small' } } },
    skills: {
      3327: { name: { en: 'Spaceship Command' } },
      3328: { name: { en: 'Gallente Frigate' } },
      3330: { name: { en: 'Caldari Frigate' } },
    },
  }
}

describe('resolveSkillLevelStates', () => {
  it('marks trained levels and the level in training', () => {
    expect(resolveSkillLevelStates(3330, 2, { skillId: 3330, level: 3 })).toEqual([
      'trained',
      'trained',
      'training',
      'untrained',
      'untrained',
    ])
  })

  it('ignores training of other skills', () => {
    expect(resolveSkillLevelStates(3330, 0, { skillId: 3328, level: 1 })).toEqual(Array(5).fill('untrained'))
  })
})

describe('GroupTooltip', () => {
  it('shows name, elements, description and displayed bonus skills', () => {
    renderWithShipTreeProviders(
      <GroupTooltip
        groupId={groups.frigate}
        faction={factions.caldariState}
      />,
      { data: tooltipData(), skills: { 3330: 4 } },
    )

    expect(screen.getByText('Frigate')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Small' })).toBeInTheDocument()
    expect(screen.getByText('Small, fast but fragile vessels.')).toBeInTheDocument()
    expect(screen.getByText('Caldari Frigate')).toBeInTheDocument()
    expect(screen.queryByText('Spaceship Command')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Level 4 of 5' })).toBeInTheDocument()
    expect(screen.getByText(/Train this skill to gain/)).toBeInTheDocument()
  })

  it('uses the plural hint and shows the level in training', () => {
    renderWithShipTreeProviders(
      <GroupTooltip
        groupId={groups.frigate}
        faction={factions.guristasPirates}
      />,
      { data: tooltipData(), skills: { 3328: 4 }, training: { skillId: 3328, level: 5 } },
    )

    expect(screen.getByRole('img', { name: 'Level 4 of 5, training level 5' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Level 0 of 5' })).toBeInTheDocument()
    expect(screen.getByText(/Train these skills to gain/)).toBeInTheDocument()
  })
})
