export type EasingName = 'linear' | 'cubicInOut' | 'cubicOut' | 'quadInOut'
export type Easing = EasingName | ((t: number) => number)

const easings: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  cubicOut: (t) => 1 - (1 - t) ** 3,
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
}

export const resolveEasing = (easing: Easing | undefined): ((t: number) => number) =>
  typeof easing === 'function' ? easing : easings[easing ?? 'cubicInOut']
