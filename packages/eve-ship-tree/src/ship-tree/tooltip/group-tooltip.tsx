import type { CSSProperties } from 'react'

import auraIcon from 'res:/ui/texture/classes/careerportal/aura/aura_icon_16x16.png'
import groupIconFrame from 'res:/ui/texture/classes/shiptree/groups/groupiconframe.png'
import omegaLockedIcon from 'res:/ui/texture/classes/skillbar/omegalocked.png'
import partiallyTrainedIcon from 'res:/ui/texture/classes/skillbar/partiallytrained.png'
import requirementMetIcon from 'res:/ui/texture/classes/skills/skillrequirementmet.png'
import requirementNotMetIcon from 'res:/ui/texture/classes/skills/skillrequirementnotmet.png'
import elementIcons from '../../data/icons/shipTreeElements/icons'
import { iconLarge } from '../../data/icons/shipTreeGroups'
import { names as groupNames, type Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { useData, useProcessedData } from '../../data-provider'
import type { LocalizedString } from '../../data-provider/schema'
import { useSkills, useSkillTraining } from '../../skills-provider'
import type { SkillTraining } from '../../skills-provider/context'
import { useShipTreeTheme } from '../theme-provider'
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

const describeLevels = (level: number, states: SkillLevelState[]): string => {
  const trainingLevel = states.indexOf('training') + 1
  const trained = `Level ${level} of ${maxLevel}`

  return trainingLevel > 0 ? `${trained}, training level ${trainingLevel}` : trained
}

const maskStyle = (icon: string): CSSProperties => ({ '--ship-tree-tooltip-mask': `url("${icon}")` }) as CSSProperties

type SkillEntryProps = {
  skillId: number
  name: string
  requiredLevel: number
  showLevel: boolean
}

const SkillEntry = ({ skillId, name, requiredLevel, showLevel }: SkillEntryProps) => {
  const skills = useSkills()
  const training = useSkillTraining()
  const { alphaSkills } = useProcessedData()
  const { isOmega = false } = useShipTreeTheme()

  const level = skills[skillId] ?? 0
  const states = resolveSkillLevelStates(skillId, level, training)
  const met = level >= requiredLevel
  const target = showLevel ? requiredLevel : maxLevel
  const omegaLocked = !isOmega && level < target && (alphaSkills[skillId] ?? 0) < target

  return (
    <li
      className={classes.skill}
      data-met={met}
    >
      <span className={classes.skillName}>
        {name}
        {showLevel ? <span className={classes.skillLevel}> Level {requiredLevel}</span> : null}
      </span>
      {states.includes('training') ? (
        <span
          className={classes.partiallyTrained}
          style={maskStyle(partiallyTrainedIcon)}
          aria-hidden
        />
      ) : null}
      {omegaLocked ? (
        <span
          className={classes.omegaLocked}
          style={maskStyle(omegaLockedIcon)}
          role="img"
          aria-label="Requires Omega"
        />
      ) : null}
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
      <span
        className={classes.status}
        style={maskStyle(met ? requirementMetIcon : requirementNotMetIcon)}
        role="img"
        aria-label={met ? 'Requirement met' : 'Requirement not met'}
      />
    </li>
  )
}

/** Group name, traits and description, then the skills to unlock it or the skills that improve its ships. */
export const GroupTooltip = ({ groupId, faction }: GroupTooltipProps) => {
  const { data } = useData()
  const { shipTreeGroups } = useProcessedData()

  const group = data?.shipTreeGroups[groupId]
  const name = localize(group?.name) ?? groupNames[groupId as keyof typeof groupNames]
  const description = localize(group?.description)
  const elements = [...(group?.elements ?? [])].sort((a, b) => a._key - b._key).map((entry) => entry._value)
  const factionSkills = group?.preReqSkills?.find((entry) => entry._key === faction)?.skills ?? []
  const locked = shipTreeGroups[groupId]?.factions[faction]?.status === 'locked'
  const listedSkills = locked ? factionSkills : factionSkills.filter((skill) => skill.display)
  const icon = iconLarge[groupId as keyof typeof iconLarge]

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.icon}>
          <img
            className={classes.iconFrame}
            src={groupIconFrame}
            alt=""
          />
          {icon ? (
            <span
              className={classes.iconGlyph}
              style={maskStyle(icon)}
            />
          ) : null}
        </div>
        <div className={classes.heading}>
          <p className={classes.name}>{name}</p>
          {elements.length > 0 ? (
            <div className={classes.traits}>
              {elements.map((elementId, index) => {
                const src = elementIcons[elementId as keyof typeof elementIcons]

                return src ? (
                  <img
                    key={elementId}
                    className={classes.trait}
                    style={{ '--ship-tree-tooltip-trait-index': index } as CSSProperties}
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
      {listedSkills.length > 0 ? (
        <div>
          <p
            className={classes.skillsHeading}
            data-locked={locked}
          >
            {locked ? 'Skills required to unlock' : 'Ship group bonus skills:'}
          </p>
          <ul className={classes.skills}>
            {listedSkills.map((skill) => (
              <SkillEntry
                key={skill._key}
                skillId={skill._key}
                name={localize(data?.skills?.[skill._key]?.name) ?? `Skill ${skill._key}`}
                requiredLevel={skill.level}
                showLevel={locked}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {!locked && listedSkills.length > 0 ? (
        <div className={classes.hint}>
          <span
            className={classes.hintIcon}
            style={maskStyle(auraIcon)}
          />
          <span>
            {listedSkills.length === 1 ? 'Train this skill' : 'Train these skills'} to gain unique bonuses to the ships
            in this group.
          </span>
        </div>
      ) : null}
    </div>
  )
}

GroupTooltip.displayName = '@eve-online-tools/eve-ship-tree/GroupTooltip'
