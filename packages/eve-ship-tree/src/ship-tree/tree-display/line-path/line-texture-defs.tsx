import { lineSpriteHeight, lineSpriteWidth } from '../layout-constants'
import { getLineSegmentSprite, type LinePathStatus } from './sprites'

export const lineTexturePatternId = (status: LinePathStatus): string => `line-texture-${status}`

export const LineTextureDefs = () => (
  <>
    {(['locked', 'unlocked', 'mastered'] as const).map((status) => {
      const [sprite, spriteOpacity] = getLineSegmentSprite(status)

      return (
        <pattern
          key={status}
          id={lineTexturePatternId(status)}
          patternUnits="userSpaceOnUse"
          width={lineSpriteWidth}
          height={lineSpriteHeight}
        >
          <image
            href={sprite}
            width={lineSpriteWidth}
            height={lineSpriteHeight}
            preserveAspectRatio="none"
            opacity={spriteOpacity}
          />
        </pattern>
      )
    })}
  </>
)
