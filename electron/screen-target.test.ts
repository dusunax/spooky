import { describe, expect, it } from 'vitest'
import { redactRecord, SCREEN_TARGET_ID, spotFor } from './screen-target'
import type { DecisionRecord } from './ai/decide'

const overlay = { x: 0, y: -1080, width: 1920, height: 1080 } // 위쪽 외부 모니터

describe('spotFor', () => {
  it('uses the center of a small element, in overlay coordinates', () => {
    const frame = { x: 100, y: -1000, width: 80, height: 30 }
    expect(spotFor(frame, { x: 0, y: 0 }, overlay)).toEqual({
      x: 140,
      y: 95,
      width: 80,
      height: 30
    })
  })

  it('moves to the point nearest the cursor inside a large element', () => {
    const paragraph = { x: 100, y: -1000, width: 600, height: 80 }
    const cursor = { x: 650, y: -930 }
    // 그을음은 160×40, 지점은 요소 안쪽으로 묶인다
    expect(spotFor(paragraph, cursor, overlay)).toEqual({ x: 620, y: 140, width: 160, height: 40 })
  })

  it('falls back to the center without a cursor', () => {
    const paragraph = { x: 0, y: -1080, width: 600, height: 80 }
    expect(spotFor(paragraph, null, overlay)).toMatchObject({ x: 300, y: 40 })
  })
})

describe('redactRecord', () => {
  const record = (targets: { id: string; label: string; distance: number }[]): DecisionRecord => ({
    context: {
      cursorSpeed: 'still',
      distanceToCursor: 60,
      lastAction: null,
      secondsSinceLastAction: null,
      targets,
      lineLanguage: 'English'
    },
    raw: '{"choice":"EXPLODE:screen-target","line":"My bank balance?"}',
    action: { type: 'EXPLODE', targetId: SCREEN_TARGET_ID },
    line: 'My bank balance?',
    engine: 'fake',
    source: 'model',
    latencyMs: 700
  })

  it('hides the on-screen label, line and raw output', () => {
    const redacted = redactRecord(
      record([
        { id: 'btn-save', label: 'Save', distance: 0 },
        { id: SCREEN_TARGET_ID, label: 'Bank balance (text in Safari)', distance: 10 }
      ])
    )
    expect(JSON.stringify(redacted)).not.toContain('balance')
    expect(redacted.context.targets).toEqual([
      { id: 'btn-save', label: 'Save', distance: 0 },
      { id: SCREEN_TARGET_ID, label: '[on-screen element]', distance: 10 }
    ])
  })

  it('leaves demo-only decisions untouched', () => {
    const plain = record([{ id: 'btn-save', label: 'Save', distance: 0 }])
    expect(redactRecord(plain)).toBe(plain)
  })
})
