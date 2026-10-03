import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import bottomFrameLeft from 'res:/ui/texture/classes/shiptree/frame/bottomleft.png'
import bottomFrameLine from 'res:/ui/texture/classes/shiptree/frame/bottomline.png'
import bottomFrameSeparator from 'res:/ui/texture/classes/shiptree/frame/bottomseperator.png'

import { HorizontalSpriteStrip } from './horizontal-sprite-strip'
import classes from './bottom-frame.module.css'
import { createGetStyles, type StylesApiProps } from '../../styles-api'

export type BottomFrameLabel = readonly [string, string]

export type BottomFrameStylesNames =
  | 'root'
  | 'leftSection'
  | 'left'
  | 'versionLabel'
  | 'label'
  | 'labelLine'
  | 'separator'
  | 'line'
  | 'disclaimer'

export interface BottomFrameProps
  extends StylesApiProps<BottomFrameStylesNames>, Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> {
  versionLabel?: string
  label?: BottomFrameLabel | null
  disclaimer?: string | null
}

const defaultLabel: BottomFrameLabel = ['Showing', 'Military and industrial vessels']

export const BottomFrame = forwardRef<HTMLDivElement, BottomFrameProps>(
  (
    {
      classNames,
      className,
      style,
      styles,
      versionLabel = 'V1.569.496',
      label = defaultLabel,
      disclaimer = 'Courtesy of Kaalakiota Corporation',
      ...others
    },
    ref,
  ) => {
    const getStyles = createGetStyles<BottomFrameStylesNames>(classes, { className, style, classNames, styles })

    return (
      <div
        ref={ref}
        {...getStyles('root')}
        {...others}
      >
        <div {...getStyles('leftSection')}>
          <img
            {...getStyles('left')}
            src={bottomFrameLeft}
            alt=""
          />
          {versionLabel ? <span {...getStyles('versionLabel')}>{versionLabel}</span> : null}
        </div>
        {label ? (
          <>
            <div {...getStyles('label')}>
              <span {...getStyles('labelLine')}>{label[0]}</span>
              <span {...getStyles('labelLine')}>{label[1]}</span>
            </div>
            <img
              {...getStyles('separator')}
              src={bottomFrameSeparator}
              alt=""
              aria-hidden
            />
          </>
        ) : null}
        <HorizontalSpriteStrip
          {...getStyles('line')}
          sprite={bottomFrameLine}
          spriteWidth={40}
          capLeftWidth={2}
          capRightWidth={2}
          height={2}
        />
        {disclaimer ? (
          <>
            <img
              {...getStyles('separator')}
              src={bottomFrameSeparator}
              alt=""
              aria-hidden
            />
            <span {...getStyles('disclaimer')}>{disclaimer}</span>
            <img
              {...getStyles('separator')}
              src={bottomFrameSeparator}
              alt=""
              aria-hidden
            />
          </>
        ) : null}
      </div>
    )
  },
)

BottomFrame.displayName = '@eve-online-tools/eve-ship-tree/BottomFrame'

export namespace BottomFrame {
  export type Props = BottomFrameProps
  export type StylesNames = BottomFrameStylesNames
}
