import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HorizontalSpriteStrip } from './horizontal-sprite-strip'

describe('HorizontalSpriteStrip', () => {
  it('renders left, middle, and right sprite segments', () => {
    const { container } = render(
      <svg>
        <HorizontalSpriteStrip
          x={10}
          y={20}
          width={100}
          height={3}
          sprite="/sprite.png"
          spriteWidth={12}
          capLeftWidth={4}
          capRightWidth={4}
        />
      </svg>,
    )

    expect(container.querySelectorAll('image')).toHaveLength(3)
  })

  it('omits the middle segment when width equals cap sizes', () => {
    const { container } = render(
      <svg>
        <HorizontalSpriteStrip
          x={0}
          y={0}
          width={8}
          height={3}
          sprite="/sprite.png"
          spriteWidth={12}
          capLeftWidth={4}
          capRightWidth={4}
        />
      </svg>,
    )

    expect(container.querySelectorAll('image')).toHaveLength(2)
  })
})
