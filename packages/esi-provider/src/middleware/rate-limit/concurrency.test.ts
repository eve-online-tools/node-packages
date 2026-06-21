import { describe, expect, it } from 'vitest'
import { BucketGate } from './concurrency'

describe('BucketGate', () => {
  it('serializes concurrent access per bucket', async () => {
    const gate = new BucketGate()
    const observedInFlight: number[] = []

    await Promise.all([
      gate.runWithBucket('req-1', 'status', '123', async () => {
        observedInFlight.push(gate.getInFlight('status', '123'))
      }),
      gate.runWithBucket('req-2', 'status', '123', async () => {
        observedInFlight.push(gate.getInFlight('status', '123'))
      }),
    ])

    expect(observedInFlight).toEqual([0, 1])
    expect(gate.getInFlight('status', '123')).toBe(2)
  })

  it('does not block different buckets', async () => {
    const gate = new BucketGate()
    const order: string[] = []

    await Promise.all([
      gate.runWithBucket('req-1', 'status', '123', async () => {
        order.push('a-start')
        await new Promise((resolve) => setTimeout(resolve, 20))
        order.push('a-end')
      }),
      gate.runWithBucket('req-2', 'status', '456', async () => {
        order.push('b-start')
        order.push('b-end')
      }),
    ])

    expect(order[0]).toBe('a-start')
    expect(order).toContain('b-start')
    expect(order).toContain('b-end')
  })

  it('releases in-flight counts by request id', async () => {
    const gate = new BucketGate()

    await Promise.all([
      gate.runWithBucket('req-1', 'status', '123', async () => {}),
      gate.runWithBucket('req-2', 'status', '123', async () => {}),
    ])

    expect(gate.getInFlight('status', '123')).toBe(2)

    gate.release('req-1')
    expect(gate.getInFlight('status', '123')).toBe(1)

    gate.release('req-2')
    expect(gate.getInFlight('status', '123')).toBe(0)
  })

  it('ignores release for unknown request ids', () => {
    const gate = new BucketGate()
    gate.release('missing')
    expect(gate.getInFlight('status', '123')).toBe(0)
  })
})
