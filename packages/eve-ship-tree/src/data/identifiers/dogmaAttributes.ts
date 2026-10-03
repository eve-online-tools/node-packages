export const identifiers = {
  requiredSkill1: 182,
  requiredSkill2: 183,
  requiredSkill3: 184,
  requiredSkill1Level: 277,
  requiredSkill2Level: 278,
  requiredSkill3Level: 279,
  techLevel: 422,
  requiredSkill4: 1285,
  requiredSkill4Level: 1286,
  requiredSkill5Level: 1287,
  requiredSkill5: 1289,
  rigSize: 1547,
} as const

export type Identifier = (typeof identifiers)[keyof typeof identifiers]

export const names = {
  182: 'requiredSkill1',
  183: 'requiredSkill2',
  184: 'requiredSkill3',
  277: 'requiredSkill1Level',
  278: 'requiredSkill2Level',
  279: 'requiredSkill3Level',
  422: 'techLevel',
  1285: 'requiredSkill4',
  1286: 'requiredSkill4Level',
  1287: 'requiredSkill5Level',
  1289: 'requiredSkill5',
  1547: 'rigSize',
} as const
