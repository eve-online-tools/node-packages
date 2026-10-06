import { useContext } from 'react'

import { icons as elementIcons } from '../data/icons/shipTreeElements'
import { logo } from '../data/icons/factionslogo'
import { names, type Identifier } from '../data/identifiers/shipTreeFactions'
import { DataContext } from '../data-provider/context'
import type { PreloadedData } from '../data-provider/types'
import { createGetStyles, type StylesApiProps } from '../ship-tree/styles-api'
import classes from './faction-summary.module.css'

export type FactionSummaryStylesNames = 'root' | 'header' | 'logo' | 'name' | 'elements' | 'element' | 'description'

type LocalizedText = { en?: string }

type FactionRecord = {
  description?: LocalizedText
  elements?: Array<{ _key: number; _value: number }>
}

type ElementRecord = { name?: LocalizedText }

export type FactionSummaryData = Pick<Partial<PreloadedData>, 'shipTreeFactions' | 'shipTreeElements'>

export interface FactionSummaryProps extends StylesApiProps<FactionSummaryStylesNames> {
  faction: Identifier
  /** Defaults to the tables of the nearest `DataProvider`. Without them only logo and name show. */
  data?: FactionSummaryData
}

export const FactionSummary = ({ faction, data, className, style, classNames, styles }: FactionSummaryProps) => {
  const getStyles = createGetStyles<FactionSummaryStylesNames>(classes, { className, style, classNames, styles })
  const contextData = useContext(DataContext)?.data
  const tables = data ?? contextData ?? {}

  const record = tables.shipTreeFactions?.[faction] as FactionRecord | undefined
  const elementTable = tables.shipTreeElements as Record<number, ElementRecord> | undefined
  const elements = [...(record?.elements ?? [])]
    .sort((a, b) => a._key - b._key)
    .map(({ _value: id }) => ({
      id,
      name: elementTable?.[id]?.name?.en,
      icon: elementIcons[id as keyof typeof elementIcons],
    }))
    .filter((element) => element.icon)
  const description = record?.description?.en

  return (
    <section
      {...getStyles('root')}
      aria-label={names[faction]}
      data-faction={faction}
    >
      <div {...getStyles('header')}>
        <img
          {...getStyles('logo')}
          src={logo[faction]}
          alt=""
          draggable={false}
        />
        <div>
          <h2 {...getStyles('name')}>{names[faction]}</h2>
          {elements.length > 0 && (
            <ul {...getStyles('elements')}>
              {elements.map(({ id, name, icon }) => (
                <li key={id}>
                  <img
                    {...getStyles('element')}
                    src={icon}
                    alt={name ?? ''}
                    title={name}
                    data-element={id}
                    draggable={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {description && <p {...getStyles('description')}>{description}</p>}
    </section>
  )
}

FactionSummary.displayName = '@eve-online-tools/eve-ship-tree/FactionSummary'
