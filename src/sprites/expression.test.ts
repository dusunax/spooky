import { describe, expect, it } from 'vitest'
import { expressionFor, MISCHIEF_FACE_FROM } from './expression'
import { GHOST_FRAMES, HEAD_ICONS } from './ghost'

describe('expressionFor', () => {
  it.each([
    ['CHARGING', 10, null, 'idle', null],
    ['CHARGING', MISCHIEF_FACE_FROM, null, 'mischief', null],
    ['THINKING', 100, null, 'thinking', 'question'],
    ['ACTING', 0, 'BOO', 'boo', null],
    ['ACTING', 0, 'EXPLODE', 'excited', 'sparkle'],
    ['COOLDOWN', 0, null, 'sleepy', 'z'],
    ['AI_OFFLINE', 100, null, 'sleepy', 'zzz'],
    ['PAUSED', 50, null, 'idle', null]
  ] as const)('%s at %i%% (%s) → %s face, %s icon', (mischief, gauge, action, face, icon) => {
    expect(expressionFor(mischief, gauge, action)).toEqual({ face, icon })
  })
})

describe('pixel art', () => {
  it('every face is a 16×16 grid', () => {
    for (const rows of Object.values(GHOST_FRAMES)) {
      expect(rows).toHaveLength(16)
      for (const row of rows) expect(row).toHaveLength(16)
    }
  })

  it('faces only differ inside the face area (rows 5–11)', () => {
    const idle = GHOST_FRAMES.idle
    for (const rows of Object.values(GHOST_FRAMES)) {
      rows.forEach((row, i) => {
        if (i < 5 || i > 11) expect(row).toBe(idle[i])
      })
    }
  })

  it('head icons have rectangular rows', () => {
    for (const rows of Object.values(HEAD_ICONS)) {
      expect(new Set(rows.map((r) => r.length)).size).toBe(1)
    }
  })
})
