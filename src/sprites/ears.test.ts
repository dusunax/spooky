import { describe, expect, it } from 'vitest'
import { EAR_IDS, EAR_RISE, EARED_FRAMES, withEars } from './ears'
import { GHOST_FRAMES } from './ghost'

describe('withEars', () => {
  it('leaves the ghost untouched without ears', () => {
    expect(withEars(GHOST_FRAMES.idle, 'none')).toBe(GHOST_FRAMES.idle)
  })

  it.each(['bunny', 'cat', 'bear'] as const)('%s ears add rows above a 16-wide ghost', (ears) => {
    const rows = withEars(GHOST_FRAMES.idle, ears)
    expect(rows).toHaveLength(16 + EAR_RISE)
    for (const row of rows) expect(row).toHaveLength(16)
  })

  it.each(['bunny', 'cat', 'bear'] as const)('%s ears keep the face and lower body', (ears) => {
    const rows = withEars(GHOST_FRAMES.excited, ears)
    // 귀는 머리 윗줄(0·1행)까지만 덮는다 — 2행부터는 원본 그대로
    expect(rows.slice(EAR_RISE + 2)).toEqual(GHOST_FRAMES.excited.slice(2))
  })

  it('bunny ears are white-connected to the body (no outline under them)', () => {
    const row1 = withEars(GHOST_FRAMES.idle, 'bunny')[EAR_RISE + 1]
    expect(row1.slice(5, 11)).toBe('WWWWWW')
  })

  it('pre-builds every face for every ear style', () => {
    for (const ears of EAR_IDS) {
      expect(Object.keys(EARED_FRAMES[ears]).sort()).toEqual(Object.keys(GHOST_FRAMES).sort())
    }
  })
})
