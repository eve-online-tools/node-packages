import { render, screen } from '@testing-library/react'

import { minimalShipTreeData } from '../../data-provider/__fixtures__/minimal-data'
import { identifiers as factions } from '../../data/identifiers/shipTreeFactions'
import { renderWithShipTreeProviders } from '../../test/render-with-ship-tree-providers'
import { ShipTree } from '../ship-tree'
import { formatBonusValue, parseBonusText, ShipTooltip } from './ship-tooltip'

const bantam = 582

const tooltipData = () => {
  const data = minimalShipTreeData()

  return {
    ...data,
    types: {
      ...data.types,
      [bantam]: { ...data.types[bantam], name: { en: 'Bantam' }, techLevel: 2 },
    },
    typeElements: {
      [bantam]: {
        elements: [
          { _key: 2, _value: 25 },
          { _key: 1, _value: 30 },
        ],
      },
    },
    shipTreeElements: { 25: { name: { en: 'Support' } }, 30: { name: { en: 'Small' } } },
    skills: { 3330: { name: { en: 'Caldari Frigate' } }, 28615: { name: { en: 'Electronic Attack Ships' } } },
    typeBonus: {
      [bantam]: {
        types: [
          {
            _key: 3330,
            _value: [
              {
                bonus: 10,
                bonusText: { en: 'reduction in <a href=showinfo:3422>Remote Shield Booster</a> activation cost' },
                importance: 2,
                unitID: 105,
              },
              {
                bonus: 12.5,
                bonusText: { en: 'bonus to <a href=showinfo:3422>Remote Shield Booster</a> amount' },
                importance: 1,
                unitID: 105,
              },
            ],
          },
          {
            _key: 28615,
            _value: [{ bonus: 5, bonusText: { en: 'bonus to ship capacitor capacity' }, importance: 1, unitID: 105 }],
          },
        ],
        roleBonuses: [
          { bonusText: { en: 'Can fit <a href=showinfo:47254>Assault Damage Controls</a>' }, importance: 1 },
        ],
      },
    },
  }
}

const renderShipTooltip = (props: { prices?: Record<number, number>; locale?: string } = {}) =>
  renderWithShipTreeProviders(
    <ShipTree
      faction={factions.caldariState}
      panZoom={false}
      {...props}
    >
      <ShipTooltip
        typeId={bantam}
        faction={factions.caldariState}
        renderUrl={(typeId) => `/renders/${typeId}.png`}
      />
    </ShipTree>,
    { data: tooltipData() },
  )

describe('formatBonusValue', () => {
  it('formats values with their unit in the given locale', () => {
    expect(formatBonusValue({ bonus: 12.5, unitID: 105 }, 'de')).toBe('12,5%')
    expect(formatBonusValue({ bonus: 5, unitID: 105 }, 'en')).toBe('5%')
    expect(formatBonusValue({ bonus: 5000, unitID: 1 }, 'en')).toBe('5,000 m')
    expect(formatBonusValue({ bonus: 5, unitID: 139 }, 'en')).toBe('+5')
    expect(formatBonusValue({ bonus: 2, unitID: 999 }, 'en')).toBe('2')
  })

  it('returns undefined without a value', () => {
    expect(formatBonusValue({ bonusText: { en: 'Can fit things' } })).toBeUndefined()
  })
})

describe('parseBonusText', () => {
  it('renders links and bold as strong and keeps other text', () => {
    const { container } = render(
      <p>{parseBonusText('bonus to <a href=showinfo:3422>Remote <i>Shield</i> Booster</a> <b>amount</b> & <x>')}</p>,
    )

    expect(container.innerHTML).toBe(
      '<p>bonus to <strong>Remote <em>Shield</em> Booster</strong> <strong>amount</strong> &amp; &lt;x&gt;</p>',
    )
  })

  it('closes unterminated tags', () => {
    const { container } = render(<p>{parseBonusText('<u>open')}</p>)

    expect(container.innerHTML).toBe('<p><u>open</u></p>')
  })
})

describe('ShipTooltip', () => {
  it('shows the render, badge, name, glyphs and bonus sections', () => {
    const { container } = renderShipTooltip({ locale: 'de' })

    expect(screen.getByText('Bantam')).toBeInTheDocument()
    expect(container.querySelector('img[src="/renders/582.png"]')).toBeInTheDocument()
    // Render and tech badge are decorative; glyphs follow element order.
    expect(container.querySelectorAll('img')).toHaveLength(4)
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual(['Small', 'Support'])

    const [classSection, skillSection, roleSection] = container.querySelectorAll('section')
    expect(classSection).toHaveTextContent('Electronic Attack Ships bonuses (per skill level):')
    expect(skillSection).toHaveTextContent('Caldari Frigate bonuses (per skill level):')
    expect([...skillSection!.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      '12,5%bonus to Remote Shield Booster amount',
      '10%reduction in Remote Shield Booster activation cost',
    ])
    expect(skillSection!.querySelector('strong')).toHaveTextContent('Remote Shield Booster')
    expect(roleSection).toHaveTextContent('Role Bonus:')
    expect(roleSection).toHaveTextContent('·Can fit Assault Damage Controls')
    expect(screen.queryByText(/Misc bonus/)).not.toBeInTheDocument()
  })

  it('shows the price only when one is given', () => {
    const { unmount } = renderShipTooltip({ locale: 'de' })
    expect(screen.queryByText(/ISK/)).not.toBeInTheDocument()
    unmount()

    renderShipTooltip({ locale: 'de', prices: { [bantam]: 148_000_000 } })
    expect(screen.getByText(/ISK/)).toHaveTextContent('148.000.000 ISK Est. price')
  })
})
