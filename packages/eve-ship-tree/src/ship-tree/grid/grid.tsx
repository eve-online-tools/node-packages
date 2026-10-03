import { forwardRef, type ComponentPropsWithoutRef } from 'react'

import { BottomFrame, type BottomFrameLabel } from './grid-frame/bottom-frame'
import { TopFrame } from './grid-frame/top-frame'
import classes from './grid.module.css'
import { createGetStyles, type StylesApiProps } from '../styles-api'

export type GridStylesNames = 'root' | 'inner' | 'header' | 'content' | 'footer'

export interface GridProps
  extends StylesApiProps<GridStylesNames>, Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> {
  topLabel?: string
  versionLabel?: string
  bottomLabel?: BottomFrameLabel | null
  disclaimer?: string | null
}

const GridBase = forwardRef<HTMLDivElement, GridProps>(
  (
    { classNames, className, style, styles, children, topLabel, versionLabel, bottomLabel, disclaimer, ...others },
    ref,
  ) => {
    const getStyles = createGetStyles<GridStylesNames>(classes, { className, style, classNames, styles })

    return (
      <div
        ref={ref}
        {...getStyles('root')}
        {...others}
      >
        <div {...getStyles('inner')}>
          <div {...getStyles('header')}>
            <TopFrame label={topLabel} />
          </div>
          <div
            {...getStyles('content')}
            data-testid="grid-content"
          >
            {children}
          </div>
          <div {...getStyles('footer')}>
            <BottomFrame
              versionLabel={versionLabel}
              label={bottomLabel}
              disclaimer={disclaimer}
            />
          </div>
        </div>
      </div>
    )
  },
)

GridBase.displayName = '@eve-online-tools/eve-ship-tree/Grid'

export const Grid = Object.assign(GridBase, { TopFrame, BottomFrame })

export namespace Grid {
  export type Props = GridProps
  export type StylesNames = GridStylesNames
}
