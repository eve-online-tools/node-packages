import { useRef, type KeyboardEvent } from 'react'

import { logo } from '../data/icons/factionslogo'
import { names, type Identifier } from '../data/identifiers/shipTreeFactions'
import { createGetStyles, cx, type StylesApiProps } from '../ship-tree/styles-api'
import classes from './faction-selector.module.css'
import { shipTreeFactionOrder } from './factions'

export type FactionSelectorStylesNames = 'root' | 'option' | 'logo' | 'select'

export interface FactionSelectorProps extends StylesApiProps<FactionSelectorStylesNames> {
  value: Identifier
  onChange: (faction: Identifier) => void
  /** Defaults to all ship tree factions in client order. */
  factions?: readonly Identifier[]
  /** `compact` renders a native select for narrow layouts. */
  variant?: 'grid' | 'compact'
  /** Accessible name of the group. */
  label?: string
}

const keySteps: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }

export const FactionSelector = ({
  value,
  onChange,
  factions = shipTreeFactionOrder,
  variant = 'grid',
  label = 'Faction',
  className,
  style,
  classNames,
  styles,
}: FactionSelectorProps) => {
  const getStyles = createGetStyles<FactionSelectorStylesNames>(classes, { className, style, classNames, styles })
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (variant === 'compact') {
    const rootStyles = getStyles('root')
    const selectStyles = getStyles('select')

    return (
      <select
        aria-label={label}
        className={cx(rootStyles.className, selectStyles.className)}
        style={{ ...rootStyles.style, ...selectStyles.style }}
        data-variant="compact"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as Identifier)}
      >
        {factions.map((faction) => (
          <option
            key={faction}
            value={faction}
          >
            {names[faction]}
          </option>
        ))}
      </select>
    )
  }

  const selectedIndex = factions.indexOf(value)
  // Keep one option tabbable when value is not in the list.
  const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = keySteps[event.key]
    let next: number | undefined

    if (step !== undefined) {
      next = (tabbableIndex + step + factions.length) % factions.length
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = factions.length - 1
    }

    if (next === undefined) {
      return
    }

    event.preventDefault()
    onChange(factions[next]!)
    optionRefs.current[next]?.focus()
  }

  return (
    <div
      {...getStyles('root')}
      role="radiogroup"
      aria-label={label}
      data-variant="grid"
      onKeyDown={onKeyDown}
    >
      {factions.map((faction, index) => {
        const selected = faction === value

        return (
          <button
            key={faction}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            {...getStyles('option')}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={names[faction]}
            title={names[faction]}
            tabIndex={index === tabbableIndex ? 0 : -1}
            data-faction={faction}
            data-selected={selected || undefined}
            onClick={() => onChange(faction)}
          >
            <img
              {...getStyles('logo')}
              src={logo[faction]}
              alt=""
              draggable={false}
            />
          </button>
        )
      })}
    </div>
  )
}

FactionSelector.displayName = '@eve-online-tools/eve-ship-tree/FactionSelector'
