import { normalizeResPath } from './codegen'

// Glyphs not in category_icons, keyed by SDE icon name.
const elementIconFolders: Record<string, string> = {
  explorer: 'career_icons',
}

export const elementIconPath = (iconName: string): string =>
  normalizeResPath(`res:/ui/texture/eveicon/${elementIconFolders[iconName] ?? 'category_icons'}/${iconName}_32px.png`)

// The client ships these 256px files as a shared red-square placeholder; the 264px variants hold the real logo.
const placeholder256Logos = new Set(['concord_logo', 'edencom_logo', 'triglavian_logo', 'upwell_logo'])

export const factionLogoPath = (logoName: string): string =>
  `res:/ui/texture/eveicon/faction_logos/${logoName}_${placeholder256Logos.has(logoName) ? 264 : 256}px.png`

export const holoIconPath = (graphic: { iconFolder: string; sofHullName: string }): string =>
  normalizeResPath(`${graphic.iconFolder}/${graphic.sofHullName}_isis.png`)
