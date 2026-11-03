import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMischief, type DecideResult, type Mischief } from './mischief'
import type { Decision, GhostState } from '../src/shared/ipc'

const BOO: Decision = { action: { type: 'BOO', intensity: 0.5 }, source: 'model' }
const config = {
  chargeMs: 1000,
  cooldownMs: 500,
  actionTimeoutMs: 2000,
  offlineRetryMs: 3000,
  tickMs: 10
}

describe('createMischief', () => {
  let states: GhostState[]
  let actions: Decision[]
  let mischief: Mischief

  const last = (): GhostState => states[states.length - 1]
  const start = (decide: () => Promise<DecideResult>): void => {
    mischief = createMischief({
      decide,
      onState: (s) => states.push(s),
      onAction: (d) => actions.push(d),
      config
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    states = []
    actions = []
  })
  afterEach(() => {
    mischief.dispose()
    vi.useRealTimers()
  })

  it('charges, thinks, acts, cools down and charges again', async () => {
    start(async () => ({ ok: true, decision: BOO }))
    expect(last().mischief).toBe('CHARGING')

    await vi.advanceTimersByTimeAsync(1050)
    expect(last().mischief).toBe('ACTING')
    expect(last().statusText).toBe('Action: BOO')
    expect(actions).toEqual([BOO])

    mischief.finishAction()
    expect(last()).toMatchObject({ mischief: 'COOLDOWN', gauge: 0 })

    await vi.advanceTimersByTimeAsync(500)
    expect(last().mischief).toBe('CHARGING')
  })

  it('gives each action a new actionId so the overlay plays it once', async () => {
    start(async () => ({ ok: true, decision: BOO }))
    await vi.advanceTimersByTimeAsync(1050)
    const first = last().actionId
    mischief.finishAction()
    await vi.advanceTimersByTimeAsync(500 + 1050)
    expect(last().actionId).toBe(first + 1)
  })

  it('falls back to cooldown when no end signal arrives', async () => {
    start(async () => ({ ok: true, decision: BOO }))
    await vi.advanceTimersByTimeAsync(1050)
    await vi.advanceTimersByTimeAsync(2000)
    expect(last().mischief).toBe('COOLDOWN')
  })

  it('stops pranking while the engine is offline and retries later', async () => {
    let online = false
    start(async () =>
      online ? { ok: true, decision: BOO } : { ok: false, reason: 'model_missing' }
    )
    await vi.advanceTimersByTimeAsync(1050)
    expect(last()).toMatchObject({
      mischief: 'AI_OFFLINE',
      statusText: 'Model missing',
      gauge: 100
    })
    expect(actions).toHaveLength(0)

    online = true
    await vi.advanceTimersByTimeAsync(3000)
    expect(last().mischief).toBe('ACTING')
  })

  it('setOffline at startup skips charging', () => {
    start(async () => ({ ok: true, decision: BOO }))
    mischief.setOffline('offline')
    expect(last()).toMatchObject({ mischief: 'AI_OFFLINE', statusText: 'AI offline' })
  })

  it('pausing while thinking discards the answer and resume asks again', async () => {
    let resolve: (r: DecideResult) => void = () => {}
    let calls = 0
    start(
      () =>
        new Promise<DecideResult>((r) => {
          calls++
          resolve = r
        })
    )
    await vi.advanceTimersByTimeAsync(1050)
    expect(last().mischief).toBe('THINKING')

    mischief.pause()
    resolve({ ok: true, decision: BOO })
    await vi.advanceTimersByTimeAsync(0)
    expect(last().mischief).toBe('PAUSED')
    expect(actions).toHaveLength(0)

    mischief.resume()
    expect(last().mischief).toBe('THINKING')
    expect(calls).toBe(2)
  })

  it('does not charge while paused', async () => {
    start(async () => ({ ok: true, decision: BOO }))
    await vi.advanceTimersByTimeAsync(300)
    mischief.pause()
    const gauge = last().gauge
    await vi.advanceTimersByTimeAsync(2000)
    mischief.resume()
    expect(last().gauge).toBe(gauge)
  })

  it('setChargeMs changes the speed of the gauge already filling', async () => {
    start(async () => ({ ok: true, decision: BOO }))
    await vi.advanceTimersByTimeAsync(500) // 반쯤
    mischief.setChargeMs(10_000)
    await vi.advanceTimersByTimeAsync(600)
    expect(last().mischief).toBe('CHARGING')
    expect(last().gauge).toBeLessThan(60)
  })

  it('labels fallback and debug decisions in the status text', async () => {
    start(async () => ({
      ok: true,
      decision: { action: { type: 'EXPLODE', targetId: 'screen-target' }, source: 'debug' }
    }))
    await vi.advanceTimersByTimeAsync(1050)
    expect(last().statusText).toBe('Action: EXPLODE → that one (debug)')
  })
})
