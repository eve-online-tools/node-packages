import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

const skillsJsonlPath = 'generated/skills.jsonl'

type ShipTreeGroupRow = {
  preReqSkills?: Array<{ skills?: Array<{ _key: number }> }>
}

type TypeBonusRow = {
  types?: Array<{ _key: number }>
}

type RequiredSkillsRow = {
  requiredSkills?: Record<string, number>
}

export const collectReferencedSkillIds = ({
  shipTreeGroups,
  typeBonus,
  requiredSkills,
}: {
  shipTreeGroups: Iterable<ShipTreeGroupRow>
  typeBonus: Iterable<TypeBonusRow>
  requiredSkills: Iterable<RequiredSkillsRow>
}): Set<number> => {
  const ids = new Set<number>()

  for (const group of shipTreeGroups) {
    for (const faction of group.preReqSkills ?? []) {
      for (const skill of faction.skills ?? []) {
        ids.add(skill._key)
      }
    }
  }

  for (const bonus of typeBonus) {
    for (const entry of bonus.types ?? []) {
      ids.add(entry._key)
    }
  }

  for (const row of requiredSkills) {
    for (const skillId of Object.keys(row.requiredSkills ?? {})) {
      ids.add(Number(skillId))
    }
  }

  return ids
}

const collectRows = async <T>(stream: AsyncIterable<unknown>): Promise<T[]> => {
  const rows: T[] = []

  for await (const row of stream) {
    rows.push(row as T)
  }

  return rows
}

/** Names of the skills referenced by ship tree groups, ship bonuses and ship requirements. */
export const skillsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'skills',
  version: [...keepLanguages].sort().join(','),
  run: async ({ generatedStream, loadStream, streamJson }) => {
    const skillIds = collectReferencedSkillIds({
      shipTreeGroups: await collectRows<ShipTreeGroupRow>(generatedStream('shipTreeGroups')),
      typeBonus: await collectRows<TypeBonusRow>(generatedStream('typeBonus')),
      requiredSkills: await collectRows<RequiredSkillsRow>(generatedStream('shipTypeRequirements')),
    })

    const out = await streamJson(skillsJsonlPath)

    for await (const record of loadStream('types')) {
      if (!skillIds.has(record.key as number)) {
        continue
      }

      const { name } = record.value as { name?: unknown }
      const stripped = applyStripFields({ name }, { keepLanguages, fallbackLanguage })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
