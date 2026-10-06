import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { identifiers as f, type Identifier } from '../data/identifiers/shipTreeFactions'
import { DataProvider } from '../data-provider'
import { minimalShipTreeData } from '../data-provider/__fixtures__/minimal-data'
import { SkillsProvider } from '../skills-provider'
import { FactionSelector } from './faction-selector'
import { FactionSummary } from './faction-summary'
import { shipTreeFactionOrder } from './factions'

const ControlledSelector = ({ initial = f.minmatarRepublic }: { initial?: Identifier }) => {
  const [value, setValue] = useState<Identifier>(initial)

  return (
    <>
      <FactionSelector
        value={value}
        onChange={setValue}
      />
      <output>{value}</output>
    </>
  )
}

describe('FactionSelector', () => {
  it('renders all 17 factions in client order as radios', () => {
    render(
      <FactionSelector
        value={f.minmatarRepublic}
        onChange={() => {}}
      />,
    )

    const radios = screen.getAllByRole('radio')

    expect(shipTreeFactionOrder).toHaveLength(17)
    expect(radios.map((radio) => radio.getAttribute('data-faction'))).toEqual(shipTreeFactionOrder.map(String))
    expect(screen.getByRole('radio', { name: 'Minmatar Republic' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Amarr Empire' })).toHaveAttribute('aria-checked', 'false')
  })

  it('selects on click', async () => {
    render(<ControlledSelector />)

    await userEvent.click(screen.getByRole('radio', { name: 'Caldari State' }))

    expect(screen.getByRole('status')).toHaveTextContent(String(f.caldariState))
  })

  it('moves selection and focus with arrow keys, Home and End', async () => {
    render(<ControlledSelector />)

    const minmatar = screen.getByRole('radio', { name: 'Minmatar Republic' })
    expect(minmatar).toHaveAttribute('tabindex', '0')

    minmatar.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'ORE' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'ORE' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('radio', { name: 'Minmatar Republic' })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Deathless Circle' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Amarr Empire' })).toHaveAttribute('aria-checked', 'true')
  })

  it('limits options to the factions prop', () => {
    render(
      <FactionSelector
        value={f.caldariState}
        onChange={() => {}}
        factions={[f.caldariState, f.amarrEmpire]}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('renders a native select in the compact variant', async () => {
    const onChange = vi.fn()
    render(
      <FactionSelector
        value={f.caldariState}
        onChange={onChange}
        variant="compact"
      />,
    )

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Faction' }), 'EDENCOM')

    expect(onChange).toHaveBeenCalledWith(f.edencom)
  })
})

describe('FactionSummary', () => {
  it('shows name only without faction tables', () => {
    render(<FactionSummary faction={f.minmatarRepublic} />)

    expect(screen.getByRole('heading', { name: 'Minmatar Republic' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows element glyphs in order and description from the data prop', () => {
    render(
      <FactionSummary
        faction={f.minmatarRepublic}
        data={{
          shipTreeFactions: {
            [f.minmatarRepublic]: {
              description: { en: 'Prefer Projectile Turrets.' },
              elements: [
                { _key: 2, _value: 9 },
                { _key: 1, _value: 10 },
              ],
            },
          },
          shipTreeElements: { 9: { name: { en: 'Missiles' } }, 10: { name: { en: 'Projectile Turrets' } } },
        }}
      />,
    )

    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Projectile Turrets', 'Missiles'])
    expect(screen.getByText('Prefer Projectile Turrets.')).toBeInTheDocument()
  })

  it('reads tables from DataProvider', () => {
    render(
      <SkillsProvider skills={{}}>
        <DataProvider
          data={{
            ...minimalShipTreeData(),
            shipTreeFactions: { [f.caldariState]: { description: { en: 'Favor missiles.' } } },
          }}
        >
          <FactionSummary faction={f.caldariState} />
        </DataProvider>
      </SkillsProvider>,
    )

    expect(screen.getByText('Favor missiles.')).toBeInTheDocument()
  })
})
