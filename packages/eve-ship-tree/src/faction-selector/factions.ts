import { identifiers as f, names, type Identifier } from '../data/identifiers/shipTreeFactions'

/** Ship tree factions in the order of the client's faction box. */
export const shipTreeFactionOrder: readonly Identifier[] = [
  f.amarrEmpire,
  f.caldariState,
  f.gallenteFederation,
  f.minmatarRepublic,
  f.ore,
  f.guristasPirates,
  f.sanshasNation,
  f.bloodRaiderCovenant,
  f.angelCartel,
  f.serpentis,
  f.servantSistersOfEve,
  f.mordusLegionCommand,
  f.triglavianCollective,
  f.edencom,
  f.concordAssembly,
  f.theSocietyOfConsciousThought,
  f.deathlessCircle,
]

export { f as shipTreeFactionIdentifiers, names as shipTreeFactionNames }
