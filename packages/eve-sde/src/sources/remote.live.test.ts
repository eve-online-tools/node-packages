import { createSde } from '../core/sde'
import { remote } from './remote'

describe.each(['record', 'bulk'] as const)('remote({ get: %s }) against the live API', (mode) => {
  const sde = createSde({ sources: [remote({ get: mode })], updates: 'off' })

  it('reads rows by key', async () => {
    const rows = await sde.table('types').getMany([587, 585, -1])
    expect(rows.get(587)?.name.en).toBe('Rifter')
    expect(rows.get(585)?.name.en).toBe('Slasher')
    expect(rows.has(-1)).toBe(false)
  })

  it('lists a table', async () => {
    let count = 0
    for await (const row of sde.table('races').list({ fields: ['raceID'] })) {
      expect(typeof row.raceID).toBe('number')
      count++
    }
    expect(count).toBeGreaterThan(0)
  })
})
