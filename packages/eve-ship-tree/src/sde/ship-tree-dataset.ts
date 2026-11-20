import { defineDataset, type DatasetAsset } from '@eve-online-tools/eve-sde'

import type { TypeBonusEntry } from '../data-provider/schema'
import type { Data } from '../data-provider/types'
import { english, optionalEnglish } from './localized'
import { shipsDataset } from './ships'

/** Bump when the dataset output changes for the same inputs. */
const REVISION = 1

type SdeBonus = { bonus?: number; bonusText: { en: string }; importance?: number; unitID?: number }

const bonusEntry = ({ bonus, bonusText, importance, unitID }: SdeBonus): TypeBonusEntry => ({
  bonus,
  bonusText: english(bonusText),
  importance,
  unitID,
})

/**
 * Builds the ship tree data tables for the ships in the tree. Importing `eve-sde:dataset/eve-ship-tree:data` yields
 * `{ url }`, the emitted JSON file for `ShipTree.Root`, `DataProvider` or `loadShipTreeData`.
 */
export const shipTreeDataset = () =>
  defineDataset({
    id: 'eve-ship-tree:data',
    version: String(REVISION),
    tables: [
      'certificates',
      'cloneGrades',
      'masteries',
      'shipTreeElements',
      'shipTreeFactions',
      'shipTreeGroups',
      'typeBonus',
      'typeElements',
      'types',
    ],
    dependsOn: [shipsDataset],
    build: async ({ table, dataset, emit }): Promise<{ url: DatasetAsset }> => {
      const ships = Object.entries(dataset(shipsDataset))
        .map(([typeId, ship]) => ({ ...ship, typeID: Number(typeId) }))
        .filter((ship) => ship.shipTreeGroupID !== undefined)
      const typeIds = ships.map((ship) => ship.typeID)

      const data: Data = {
        types: {},
        requiredSkills: {},
        shipSizes: {},
        masteries: {},
        certificates: {},
        cloneGrades: {},
        shipTreeGroups: {},
        shipTreeElements: {},
        shipTreeFactions: {},
        typeBonus: {},
        typeElements: {},
        skills: {},
      }
      const skillIds = new Set<number>()

      for (const ship of ships) {
        const { typeID, name, shipTreeGroupID, factionID, metaGroupID, techLevel, requiredSkills, rigSize } = ship
        data.types[typeID] = { name: { en: name }, shipTreeGroupID, factionID, metaGroupID, techLevel }
        data.requiredSkills[typeID] = { requiredSkills }
        ;(data.shipSizes[rigSize] ??= { typeIDs: [] }).typeIDs.push(typeID)
        Object.keys(requiredSkills).forEach((skillId) => skillIds.add(Number(skillId)))
      }
      for (const size of Object.values(data.shipSizes)) {
        size.typeIDs.sort((a, b) => a - b)
      }

      const certificateIds = new Set<number>()
      for (const [typeId, { levels }] of await table('masteries').getMany(typeIds)) {
        data.masteries[typeId] = { levels }
        levels.forEach((level) => level.certificateIDs.forEach((id) => certificateIds.add(id)))
      }
      for (const [certificateId, { skillTypes }] of await table('certificates').getMany(certificateIds)) {
        data.certificates[certificateId] = { skillTypes }
      }

      for await (const { cloneGradeID, skills } of table('cloneGrades').list({ fields: ['cloneGradeID', 'skills'] })) {
        data.cloneGrades[cloneGradeID] = { skills }
      }

      for await (const group of table('shipTreeGroups').list({
        fields: ['groupID', 'name', 'description', 'elements', 'preReqSkills'],
      })) {
        data.shipTreeGroups[group.groupID] = {
          name: english(group.name),
          description: optionalEnglish(group.description),
          elements: group.elements,
          preReqSkills: group.preReqSkills,
        }
        group.preReqSkills.forEach(({ skills }) => skills.forEach(({ skillTypeID }) => skillIds.add(skillTypeID)))
      }

      for await (const element of table('shipTreeElements').list({ fields: ['elementID', 'name', 'description'] })) {
        data.shipTreeElements[element.elementID] = {
          name: english(element.name),
          description: english(element.description),
        }
      }

      for await (const faction of table('shipTreeFactions').list({
        fields: ['factionID', 'description', 'elements'],
      })) {
        data.shipTreeFactions[faction.factionID] = {
          description: english(faction.description),
          elements: faction.elements,
        }
      }

      for (const [typeId, bonus] of await table('typeBonus').getMany(typeIds)) {
        data.typeBonus[typeId] = {
          types: bonus.types?.map(({ typeID, bonuses }) => ({ typeID, bonuses: bonuses.map(bonusEntry) })),
          roleBonuses: bonus.roleBonuses?.map(bonusEntry),
          miscBonuses: bonus.miscBonuses?.map(bonusEntry),
        }
        bonus.types?.forEach(({ typeID }) => skillIds.add(typeID))
      }

      for (const [typeId, { elements }] of await table('typeElements').getMany(typeIds)) {
        data.typeElements[typeId] = { elements }
      }

      for (const [skillId, skill] of await table('types').getMany(skillIds)) {
        data.skills[skillId] = { name: english(skill.name) }
      }

      return { url: emit('ship-tree-data.json', JSON.stringify(data)) }
    },
  })
