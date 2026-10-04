import type { MapData } from '../data/types'

const AU = 1.5e11

/** Two regions, three constellations, six systems in SDE universe coordinates. */
export const fixtureMapData = (): MapData => ({
  systems: [
    {
      id: 30000001,
      constellationId: 20000001,
      security: 0.9,
      name: 'Alpha',
      position: { x: -10 * AU, y: 2 * AU, z: 10 * AU },
      position2d: { x: -10 * AU, y: 10 * AU },
      gates: [30000002],
    },
    {
      id: 30000002,
      constellationId: 20000001,
      security: 0.5,
      name: 'Bravo',
      position: { x: -5 * AU, y: 0, z: 5 * AU },
      position2d: { x: -5 * AU, y: 5 * AU },
      gates: [30000001, 30000003],
    },
    {
      id: 30000003,
      constellationId: 20000002,
      security: 0.04,
      name: 'Charlie',
      position: { x: 0, y: -2 * AU, z: 0 },
      position2d: { x: 0, y: 0 },
      gates: [30000004],
    },
    {
      id: 30000004,
      constellationId: 20000003,
      security: -0.3,
      name: 'Delta',
      position: { x: 5 * AU, y: 1 * AU, z: -5 * AU },
      position2d: { x: 5 * AU, y: -5 * AU },
      gates: [30000005],
    },
    {
      id: 30000005,
      constellationId: 20000003,
      security: -1,
      name: 'Echo',
      position: { x: 10 * AU, y: 0, z: -10 * AU },
      position2d: { x: 10 * AU, y: -10 * AU },
      gates: [30000006],
    },
    {
      id: 30000006,
      constellationId: 20000003,
      security: 0.2,
      name: 'Foxtrot',
      position: { x: 10 * AU, y: 0, z: 10 * AU },
      position2d: { x: 10 * AU, y: 10 * AU },
      gates: [39999999],
    },
  ],
  constellations: {
    20000001: { name: 'Const A', regionId: 10000001 },
    20000002: { name: 'Const B', regionId: 10000001 },
    20000003: { name: 'Const C', regionId: 10000002 },
  },
  regions: { 10000001: 'Region One', 10000002: 'Region Two' },
})
