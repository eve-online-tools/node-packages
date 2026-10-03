import type { CSSProperties } from 'react'

export interface StylesApiProps<StylesNames extends string> {
  className?: string
  style?: CSSProperties
  classNames?: Partial<Record<StylesNames, string>>
  styles?: Partial<Record<StylesNames, CSSProperties>>
}

export type SlotProps = { className: string | undefined; style: CSSProperties | undefined }

export const cx = (...names: (string | false | null | undefined)[]): string | undefined =>
  names.filter(Boolean).join(' ') || undefined

/** `className`, `style` and `rootStyle` (component CSS variables) apply to the root slot only. */
export const createGetStyles =
  <StylesNames extends string>(
    classes: Partial<Record<string, string>>,
    { className, style, classNames, styles }: StylesApiProps<StylesNames>,
    rootStyle?: CSSProperties,
  ) =>
  (slot: StylesNames): SlotProps => {
    const isRoot = slot === 'root'
    const merged = {
      ...(isRoot ? rootStyle : undefined),
      ...styles?.[slot],
      ...(isRoot ? style : undefined),
    }

    return {
      className: cx(classes[slot], classNames?.[slot], isRoot && className),
      style: Object.keys(merged).length > 0 ? merged : undefined,
    }
  }
