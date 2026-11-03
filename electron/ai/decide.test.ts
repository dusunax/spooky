import { describe, expect, it, vi } from 'vitest'
import { createDecider, type DecisionRecord } from './decide'
import { EngineUnavailableError, type DecisionEngine } from './engines/types'
import type { DecisionContext } from './schema'

const context: DecisionContext = {
  cursorSpeed: 'still',
  distanceToCursor: 60,
  lastAction: null,
  secondsSinceLastAction: null,
  targets: [{ id: 'btn-save', label: 'Save' }],
  lineLanguage: 'English'
}

function engineReturning(...replies: (string | Error)[]): DecisionEngine & { calls: number } {
  const engine = {
    id: 'fake',
    kind: 'open-local' as const,
    label: 'fake/model',
    calls: 0,
    health: async () => 'ok' as const,
    decide: async () => {
      const reply = replies[Math.min(engine.calls++, replies.length - 1)]
      if (reply instanceof Error) throw reply
      return { raw: reply }
    }
  }
  return engine
}

function setup(engine: DecisionEngine): {
  decide: () => ReturnType<ReturnType<typeof createDecider>>
  records: DecisionRecord[]
} {
  const records: DecisionRecord[] = []
  const decide = createDecider({
    engine,
    getContext: async () => context,
    onRecord: (r) => records.push(r)
  })
  return { decide: () => decide(new AbortController().signal), records }
}

describe('createDecider', () => {
  it('uses the model answer and records it as the model', async () => {
    const { decide, records } = setup(
      engineReturning('{"choice":"EXPLODE:btn-save","intensity":0,"line":"Save me?"}')
    )
    expect(await decide()).toEqual({
      ok: true,
      decision: {
        action: { type: 'EXPLODE', targetId: 'btn-save' },
        source: 'model',
        line: 'Save me?'
      }
    })
    expect(records[0]).toMatchObject({ source: 'model', engine: 'fake/model', line: 'Save me?' })
  })

  it('retries once on a broken answer, then falls back to BOO', async () => {
    const engine = engineReturning('oops', 'still oops')
    const { decide, records } = setup(engine)
    expect(await decide()).toEqual({
      ok: true,
      decision: { action: { type: 'BOO', intensity: 0.5 }, source: 'fallback' }
    })
    expect(engine.calls).toBe(2)
    expect(records[0]).toMatchObject({ source: 'fallback', fallbackReason: 'parse_failed' })
  })

  it('recovers when the retry succeeds', async () => {
    const engine = engineReturning('oops', '{"choice":"BOO","intensity":0.2,"line":""}')
    const { decide } = setup(engine)
    expect(await decide()).toMatchObject({ ok: true, decision: { source: 'model' } })
  })

  it('does not retry an invalid target', async () => {
    const engine = engineReturning('{"choice":"EXPLODE:nope","intensity":0,"line":""}')
    const { decide, records } = setup(engine)
    expect(await decide()).toMatchObject({ decision: { source: 'fallback' } })
    expect(engine.calls).toBe(1)
    expect(records[0].fallbackReason).toBe('invalid_target')
  })

  it('stops pranking when the engine is unreachable — no fallback BOO', async () => {
    const { decide, records } = setup(engineReturning(new EngineUnavailableError('offline')))
    expect(await decide()).toEqual({ ok: false, reason: 'offline' })
    expect(records).toHaveLength(0)
  })

  it('passes the last action into the next context', async () => {
    const getContext = vi.fn<Parameters<typeof createDecider>[0]['getContext']>(async () => context)
    const decide = createDecider({
      engine: engineReturning('{"choice":"BOO","intensity":0.4,"line":""}'),
      getContext,
      onRecord: () => {}
    })
    const signal = new AbortController().signal
    await decide(signal)
    await decide(signal)
    expect(getContext.mock.calls[0][0]).toEqual({ action: null, at: null })
    expect(getContext.mock.calls[1][0]).toMatchObject({ action: 'BOO' })
  })
})
