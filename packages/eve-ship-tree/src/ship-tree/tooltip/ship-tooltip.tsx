import { createElement, type ReactNode } from 'react'

import elementIcons from '../../data/icons/shipTreeElements/icons'
import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { useData, useProcessedData } from '../../data-provider'
import type { TypeBonusEntry } from '../../data-provider/schema'
import { useShipTreeTheme, type ShipPrices } from '../theme-provider'
import { getTechLevelIcon } from '../tree-display/ship-group/sprites'
import { localize } from './group-tooltip'
import classes from './ship-tooltip.module.css'

export type ShipTooltipProps = {
  typeId: number
  faction: ShipTreeFactionId
  /** Ship render URL. Defaults to `defaultShipRenderUrl`. */
  renderUrl?: (typeId: number) => string
}

export const defaultShipRenderUrl = (typeId: number): string =>
  `https://images.evetech.net/types/${typeId}/render?size=128`

const unitFormats: Record<number, (value: string) => string> = {
  1: (value) => `${value} m`,
  104: (value) => `${value}x`,
  105: (value) => `${value}%`,
  139: (value) => `+${value}`,
  144: (value) => `${value} AU/s`,
}

/** Bonus value with its unit, for example `12,5%` in a German locale. `undefined` when the bonus has no value. */
export const formatBonusValue = (entry: TypeBonusEntry, locale?: string): string | undefined => {
  if (entry.bonus === undefined) {
    return undefined
  }

  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(entry.bonus)
  const format = entry.unitID === undefined ? undefined : unitFormats[entry.unitID]

  return format ? format(value) : value
}

type MarkupTag = 'a' | 'b' | 'i' | 'u'

const markupPattern = /<(\/?)(a|b|i|u)\b[^>]*>/gi

// Links become bold text; the tree has no info window to open.
const markupElements: Record<MarkupTag, string> = { a: 'strong', b: 'strong', i: 'em', u: 'u' }

/** Renders the `<a>`, `<b>`, `<i>` and `<u>` markup in bonus text as elements. Other text is left as is. */
export const parseBonusText = (text: string): ReactNode[] => {
  const root: ReactNode[] = []
  const stack: Array<{ tag: MarkupTag; children: ReactNode[] }> = []
  const current = () => stack[stack.length - 1]?.children ?? root
  let key = 0
  let lastIndex = 0

  const closeUntil = (depth: number) => {
    while (stack.length > depth) {
      const entry = stack.pop()!
      current().push(createElement(markupElements[entry.tag], { key: key++ }, ...entry.children))
    }
  }

  for (const match of text.matchAll(markupPattern)) {
    if (match.index > lastIndex) {
      current().push(text.slice(lastIndex, match.index))
    }
    lastIndex = match.index + match[0].length

    const tag = match[2]!.toLowerCase() as MarkupTag

    if (match[1] === '') {
      stack.push({ tag, children: [] })
      continue
    }

    const depth = stack.map((entry) => entry.tag).lastIndexOf(tag)
    if (depth !== -1) {
      closeUntil(depth)
    }
  }

  if (lastIndex < text.length) {
    current().push(text.slice(lastIndex))
  }
  closeUntil(0)

  return root
}

const resolvePrice = (prices: ShipPrices | undefined, typeId: number): number | undefined =>
  typeof prices === 'function' ? prices(typeId) : prices?.[typeId]

const byImportance = (a: TypeBonusEntry, b: TypeBonusEntry) => (a.importance ?? 0) - (b.importance ?? 0)

type BonusSection = { key: string; heading: string; bonuses: TypeBonusEntry[] }

/** Ship render, name, element glyphs and price, then the ship's bonuses per skill, role and misc. */
export const ShipTooltip = ({ typeId, renderUrl = defaultShipRenderUrl }: ShipTooltipProps) => {
  const { data } = useData()
  const { shipTypes } = useProcessedData()
  const { prices, locale } = useShipTreeTheme()

  const name = localize(data?.types[typeId]?.name) ?? `Ship ${typeId}`
  const badge = getTechLevelIcon(shipTypes[typeId]?.techLevel)
  const elements = [...(data?.typeElements?.[typeId]?.elements ?? [])]
    .sort((a, b) => a._key - b._key)
    .map((entry) => entry._value)
  const price = resolvePrice(prices, typeId)
  const bonus = data?.typeBonus?.[typeId]

  const sections: BonusSection[] = [
    // Class skills (Interceptors) have higher ids than racial hull skills (Minmatar Frigate); the client lists them first.
    ...[...(bonus?.types ?? [])]
      .sort((a, b) => b._key - a._key)
      .map((entry) => ({
        key: `skill-${entry._key}`,
        heading: `${localize(data?.skills?.[entry._key]?.name) ?? `Skill ${entry._key}`} bonuses (per skill level):`,
        bonuses: entry._value,
      })),
    { key: 'role', heading: 'Role Bonus:', bonuses: bonus?.roleBonuses ?? [] },
    { key: 'misc', heading: 'Misc bonus:', bonuses: bonus?.miscBonuses ?? [] },
  ].filter((section) => section.bonuses.length > 0)

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.render}>
          <img
            className={classes.renderImage}
            src={renderUrl(typeId)}
            alt=""
            width={100}
            height={100}
          />
          {badge ? (
            <img
              className={classes.badge}
              src={badge}
              alt=""
            />
          ) : null}
        </div>
        <div className={classes.heading}>
          <p className={classes.name}>{name}</p>
          {elements.length > 0 ? (
            <div className={classes.glyphs}>
              {elements.map((elementId) => {
                const src = elementIcons[elementId as keyof typeof elementIcons]

                return src ? (
                  <img
                    key={elementId}
                    className={classes.glyph}
                    src={src}
                    alt={localize(data?.shipTreeElements?.[elementId]?.name) ?? ''}
                  />
                ) : null
              })}
            </div>
          ) : null}
          {price === undefined ? null : (
            <p className={classes.price}>
              {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} ISK{' '}
              <span className={classes.priceLabel}>Est. price</span>
            </p>
          )}
        </div>
      </div>
      {sections.length > 0 ? (
        <div className={classes.bonuses}>
          {sections.map((section) => (
            <section
              key={section.key}
              className={classes.section}
            >
              <p className={classes.sectionHeading}>{section.heading}</p>
              <ul className={classes.list}>
                {[...section.bonuses].sort(byImportance).map((entry, index) => {
                  const value = formatBonusValue(entry, locale)

                  return (
                    <li
                      key={index}
                      className={classes.bonus}
                    >
                      <span
                        className={classes.value}
                        data-bullet={value === undefined}
                      >
                        {value ?? '·'}
                      </span>
                      <span className={classes.text}>{parseBonusText(localize(entry.bonusText) ?? '')}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

ShipTooltip.displayName = '@eve-online-tools/eve-ship-tree/ShipTooltip'
