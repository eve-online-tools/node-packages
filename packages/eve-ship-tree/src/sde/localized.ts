import type { Localized } from '@eve-online-tools/eve-sde'

import type { LocalizedString } from '../data-provider/schema'

/** The ship tree shows English text only, so other languages are left out of the data. */
export const english = (value: Localized): LocalizedString => ({ en: value.en })

export const optionalEnglish = (value: Localized | undefined): LocalizedString | undefined =>
  value === undefined ? undefined : english(value)
