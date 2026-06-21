import masterySmall0 from 'res:/ui/texture/classes/mastery/masterysmall0.png'
import masterySmall1 from 'res:/ui/texture/classes/mastery/masterysmall1.png'
import masterySmall2 from 'res:/ui/texture/classes/mastery/masterysmall2.png'
import masterySmall3 from 'res:/ui/texture/classes/mastery/masterysmall3.png'
import masterySmall4 from 'res:/ui/texture/classes/mastery/masterysmall4.png'
import masterySmall5 from 'res:/ui/texture/classes/mastery/masterysmall5.png'

const masteryIcons = [masterySmall0, masterySmall1, masterySmall2, masterySmall3, masterySmall4, masterySmall5] as const

export const masteryIcon = (level: number): string => masteryIcons[Math.max(0, Math.min(5, Math.floor(level)))]!
