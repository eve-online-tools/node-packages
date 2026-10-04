import omega from 'res:/ui/texture/classes/clonegrade/omega_64.png'
import mastery0 from 'res:/ui/texture/classes/mastery/masterysmall0.png'
import mastery1 from 'res:/ui/texture/classes/mastery/masterysmall1.png'
import mastery2 from 'res:/ui/texture/classes/mastery/masterysmall2.png'
import mastery3 from 'res:/ui/texture/classes/mastery/masterysmall3.png'
import mastery4 from 'res:/ui/texture/classes/mastery/masterysmall4.png'
import mastery5 from 'res:/ui/texture/classes/mastery/masterysmall5.png'
import bottomLeft from 'res:/ui/texture/classes/shiptree/frame/bottomleft.png'
import bottomLine from 'res:/ui/texture/classes/shiptree/frame/bottomline.png'
import bottomSeperator from 'res:/ui/texture/classes/shiptree/frame/bottomseperator.png'
import topLeft from 'res:/ui/texture/classes/shiptree/frame/topleft.png'
import topRight from 'res:/ui/texture/classes/shiptree/frame/topright.png'
import bgFill from 'res:/ui/texture/classes/shiptree/groups/bgfill.png'
import bgVignette from 'res:/ui/texture/classes/shiptree/groups/bgvignette.png'
import frameElite from 'res:/ui/texture/classes/shiptree/groups/frameelite.png'
import frameLocked from 'res:/ui/texture/classes/shiptree/groups/framelocked.png'
import frameLower from 'res:/ui/texture/classes/shiptree/groups/framelower.png'
import frameUnlocked from 'res:/ui/texture/classes/shiptree/groups/frameunlocked.png'
import frameUpper from 'res:/ui/texture/classes/shiptree/groups/frameupper.png'
import groupIconFrame from 'res:/ui/texture/classes/shiptree/groups/groupiconframe.png'
import lineElite from 'res:/ui/texture/classes/shiptree/lines/elite.png'
import lineLocked from 'res:/ui/texture/classes/shiptree/lines/locked.png'
import lineUnlocked from 'res:/ui/texture/classes/shiptree/lines/unlocked.png'
import navy from 'res:/ui/texture/classes/shiptree/tech/navy.png'
import tech2 from 'res:/ui/texture/classes/shiptree/tech/tech2.png'
import tech3 from 'res:/ui/texture/classes/shiptree/tech/tech3.png'

/** URLs of every sprite the tree can render, including those only shown for some skill states. */
export const shipTreeSprites: readonly string[] = [
  omega,
  mastery0,
  mastery1,
  mastery2,
  mastery3,
  mastery4,
  mastery5,
  bottomLeft,
  bottomLine,
  bottomSeperator,
  topLeft,
  topRight,
  bgFill,
  bgVignette,
  frameElite,
  frameLocked,
  frameLower,
  frameUnlocked,
  frameUpper,
  groupIconFrame,
  lineElite,
  lineLocked,
  lineUnlocked,
  navy,
  tech2,
  tech3,
]

let preloading: Promise<void> | undefined

/** Fetches and decodes all ship tree sprites once, so status changes do not pop in. Never rejects. */
export const preloadShipTreeSprites = (): Promise<void> => {
  if (typeof Image === 'undefined') {
    return Promise.resolve()
  }
  preloading ??= Promise.all(
    shipTreeSprites.map((src) => {
      const image = new Image()
      image.src = src
      if (typeof image.decode === 'function') {
        return image.decode().catch(() => undefined)
      }
      return new Promise<void>((resolve) => {
        image.onload = () => resolve()
        image.onerror = () => resolve()
      })
    }),
  ).then(() => undefined)
  return preloading
}
