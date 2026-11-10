import { describe, expect, it, vi } from 'vitest'
import { buildContext } from './context'

const base = {
  cursor: { x: 100, y: 100, speed: 0, origin: { x: 0, y: 0 } },
  ghost: { x: 130, y: 140 },
  last: { action: null, at: null },
  targets: [] as { id: string; label: string; distance: number }[]
}

describe('buildContext', () => {
  it.each([
    [0, 'still'],
    [39, 'still'],
    [40, 'slow'],
    [799, 'slow'],
    [800, 'fast']
  ] as const)('speed %i px/s is %s', (speed, bucket) => {
    expect(buildContext({ ...base, cursor: { ...base.cursor, speed } }).cursorSpeed).toBe(bucket)
  })

  it('measures ghost-to-cursor distance', () => {
    expect(buildContext(base).distanceToCursor).toBe(50)
  })

  it('reports seconds since the last action', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    expect(buildContext({ ...base, last: { action: 'BOO', at: 4_000 } })).toMatchObject({
      lastAction: 'BOO',
      secondsSinceLastAction: 6
    })
    vi.useRealTimers()
  })

  it('lists targets nearest to the cursor first', () => {
    const targets = [
      { id: 'far', label: 'A', distance: 300 },
      { id: 'under', label: 'B', distance: 0 },
      { id: 'near', label: 'C', distance: 40 }
    ]
    const ids = buildContext({ ...base, targets }).targets.map((t) => t.id)
    expect(ids).toEqual(['under', 'near', 'far'])
  })

  it('speaks Korean when any target label has Hangul', () => {
    expect(
      buildContext({ ...base, targets: [{ id: 'a', label: 'Save', distance: 0 }] }).lineLanguage
    ).toBe('English')
    expect(
      buildContext({
        ...base,
        targets: [{ id: 'a', label: '협업자 초대 (button in Chrome)', distance: 0 }]
      }).lineLanguage
    ).toBe('Korean')
  })
})
