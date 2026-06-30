import { empireLayout } from './empires'
import { type RootEntry } from './layoutsystem'
import { identifiers, names, type Identifier } from '../data/identifiers/shipTreeFactions'
import { guristasLayout } from './guristas'
import { sanshasLayout } from './sanshas'
import { bloodraidersLayout } from './bloodraiders'
import { angelLayout } from './angelcartel'
import { serpentisLayout } from './serpentis'
import { mordusLayout } from './mordus'
import { concordLayout } from './concord'
import { soeLayout } from './soe'
import { edencomLayout } from './edencom'
import { oreLayout } from './ore'
import { soctLayout } from './soct'
import { triglavianLayout } from './triglavian'
import { deathlessLayout } from './deathless'

export { FactionNode, Node, Root, calculateLayoutSize } from './layoutsystem'
export type { NodeEntry, RootEntry } from './layoutsystem'

export const hasFactionLayout = (faction: Identifier): boolean => factionLayouts[faction].links.length > 0

export const getFactionName = (faction: Identifier): string => names[faction]

export const factionLayouts: Record<Identifier, RootEntry> = {
  [identifiers.caldariState]: empireLayout(),
  [identifiers.minmatarRepublic]: empireLayout(),
  [identifiers.amarrEmpire]: empireLayout(),
  [identifiers.gallenteFederation]: empireLayout(),
  [identifiers.concordAssembly]: concordLayout(),
  [identifiers.guristasPirates]: guristasLayout(),
  [identifiers.angelCartel]: angelLayout(),
  [identifiers.bloodRaiderCovenant]: bloodraidersLayout(),
  [identifiers.ore]: oreLayout(),
  [identifiers.servantSistersOfEve]: soeLayout(),
  [identifiers.theSocietyOfConsciousThought]: soctLayout(),
  [identifiers.mordusLegionCommand]: mordusLayout(),
  [identifiers.sanshasNation]: sanshasLayout(),
  [identifiers.serpentis]: serpentisLayout(),
  [identifiers.triglavianCollective]: triglavianLayout(),
  [identifiers.edencom]: edencomLayout(),
  [identifiers.deathlessCircle]: deathlessLayout(),
}
