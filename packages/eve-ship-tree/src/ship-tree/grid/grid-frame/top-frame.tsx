import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import topFrameLeft from 'res:/ui/texture/classes/shiptree/frame/topleft.png'
import topFrameLine from 'res:/ui/texture/classes/shiptree/frame/topright.png'

import { HorizontalSpriteStrip } from './horizontal-sprite-strip'
import classes from './top-frame.module.css'
import { createGetStyles, type StylesApiProps } from '../../styles-api'

export type TopFrameStylesNames = 'root' | 'left' | 'middle' | 'label' | 'line'

export interface TopFrameProps
  extends StylesApiProps<TopFrameStylesNames>, Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> {
  label?: string
}

export const TopFrame = forwardRef<HTMLDivElement, TopFrameProps>(
  ({ classNames, className, style, styles, label = 'Ship Tree', ...others }, ref) => {
    const getStyles = createGetStyles<TopFrameStylesNames>(classes, { className, style, classNames, styles })

    return (
      <div
        ref={ref}
        {...getStyles('root')}
        {...others}
      >
        <img
          {...getStyles('left')}
          src={topFrameLeft}
          alt=""
        />
        <div {...getStyles('middle')}>
          <span {...getStyles('label')}>{label}</span>
        </div>
        <HorizontalSpriteStrip
          {...getStyles('line')}
          sprite={topFrameLine}
          spriteWidth={49}
          capLeftWidth={40}
          capRightWidth={4}
          height={26}
        />
      </div>
    )
  },
)

TopFrame.displayName = '@eve-online-tools/eve-ship-tree/TopFrame'

export namespace TopFrame {
  export type Props = TopFrameProps
  export type StylesNames = TopFrameStylesNames
}
