import type { CSSProperties } from 'react'

import arrowUpIcon from 'res:/ui/texture/eveicon/system_icons/arrow_up_16px.png'
import elementIcons from '../../data/icons/shipTreeElements/icons'
import { iconLarge } from '../../data/icons/shipTreeGroups'
import { names as groupNames, type Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { useData } from '../../data-provider'
import type { LocalizedString } from '../../data-provider/schema'
import { useSkills, useSkillTraining } from '../../skills-provider'
import type { SkillLevel, SkillTraining } from '../../skills-provider/context'
import classes from './group-tooltip.module.css'

export type GroupTooltipProps = {
  groupId: GroupIdentifier
  faction: ShipTreeFactionId
}

export type SkillLevelState = 'untrained' | 'trained' | 'training'

const maxLevel = 5

export const localize = (value: LocalizedString | undefined, language = 'en'): string | undefined =>
  value?.[language] ?? (value === undefined ? undefined : Object.values(value)[0])

export const resolveSkillLevelStates = (
  skillId: number,
  level: number,
  training: SkillTraining | undefined,
): SkillLevelState[] =>
  Array.from({ length: maxLevel }, (_, index) => {
    const boxLevel = index + 1

    if (level >= boxLevel) {
      return 'trained'
    }

    return training?.skillId === skillId && training.level === boxLevel ? 'training' : 'untrained'
  })

const describeLevels = (level: SkillLevel, states: SkillLevelState[]): string => {
  const trainingLevel = states.indexOf('training') + 1
  const trained = `Level ${level} of ${maxLevel}`

  return trainingLevel > 0 ? `${trained}, training level ${trainingLevel}` : trained
}

/** Group name, elements, description and the faction's bonus skills with the character's progress. */
export const GroupTooltip = ({ groupId, faction }: GroupTooltipProps) => {
  const { data } = useData()
  const skills = useSkills()
  const training = useSkillTraining()

  const group = data?.shipTreeGroups[groupId]
  const name = localize(group?.name) ?? groupNames[groupId as keyof typeof groupNames]
  const description = localize(group?.description)
  const elements = [...(group?.elements ?? [])].sort((a, b) => a._key - b._key).map((entry) => entry._value)
  const bonusSkills =
    group?.preReqSkills?.find((entry) => entry._key === faction)?.skills.filter((skill) => skill.display) ?? []
  const icon = iconLarge[groupId as keyof typeof iconLarge]

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.icon}>
          {icon ? (
            <div
              className={classes.iconGlyph}
              style={{ '--ship-tree-tooltip-icon': `url("${icon}")` } as CSSProperties}
            />
          ) : null}
        </div>
        <div>
          <p className={classes.name}>{name}</p>
          {elements.length > 0 ? (
            <div className={classes.elements}>
              {elements.map((elementId) => {
                const src = elementIcons[elementId as keyof typeof elementIcons]

                return src ? (
                  <img
                    key={elementId}
                    className={classes.element}
                    src={src}
                    alt={localize(data?.shipTreeElements?.[elementId]?.name) ?? ''}
                  />
                ) : null
              })}
            </div>
          ) : null}
        </div>
      </div>
      {description ? <p className={classes.description}>{description}</p> : null}
      {bonusSkills.length > 0 ? (
        <>
          <div>
            <p className={classes.skillsHeading}>Ship group bonus skills:</p>
            <ul className={classes.skills}>
              {bonusSkills.map((skill) => {
                const level = skills[skill._key] ?? 0
                const states = resolveSkillLevelStates(skill._key, level, training)

                return (
                  <li
                    key={skill._key}
                    className={classes.skill}
                  >
                    <span>{localize(data?.skills?.[skill._key]?.name) ?? `Skill ${skill._key}`}</span>
                    <span
                      className={classes.levels}
                      role="img"
                      aria-label={describeLevels(level, states)}
                    >
                      {states.map((state, index) => (
                        <span
                          key={index}
                          className={classes.level}
                          data-state={state}
                        />
                      ))}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className={classes.hint}>
            <span
              className={classes.hintGlyph}
              style={{ '--ship-tree-tooltip-hint-icon': `url("${arrowUpIcon}")` } as CSSProperties}
            />
            <span>
              {bonusSkills.length === 1 ? 'Train this skill' : 'Train these skills'} to gain unique bonuses to the ships
              in this group.
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}

GroupTooltip.displayName = '@eve-online-tools/eve-ship-tree/GroupTooltip'
