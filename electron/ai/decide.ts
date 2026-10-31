import type { Decision, GhostAction } from '../../src/shared/ipc'
import type { DecideResult } from '../mischief'
import { EngineUnavailableError, type DecisionEngine } from './engines/types'
import { parseModelOutput, type DecisionContext } from './schema'

const FALLBACK_ACTION: GhostAction = { type: 'BOO', intensity: 0.5 }

export type DecisionRecord = {
  context: DecisionContext
  raw: string | null
  action: GhostAction
  engine: string
  source: Decision['source']
  fallbackReason?: 'parse_failed' | 'invalid_target'
  latencyMs: number
}

type Deps = {
  engine: DecisionEngine
  getContext: (last: {
    action: GhostAction['type'] | null
    at: number | null
  }) => DecisionContext | Promise<DecisionContext>
  onRecord: (record: DecisionRecord) => void
}

// 엔진 선택과 무관한 결정 정책 — 검증·재시도·폴백·source 기록은 여기 한 곳에만 둔다 (PRD §6, §7.5).
// 모델에 닿지 못하면 장난을 멈추고(offline), 응답했는데 쓸 수 없으면 BOO로 폴백한다.
export function createDecider({ engine, getContext, onRecord }: Deps) {
  let lastAction: GhostAction['type'] | null = null
  let lastActionAt: number | null = null

  return async function decide(signal: AbortSignal): Promise<DecideResult> {
    const context = await getContext({ action: lastAction, at: lastActionAt })
    const startedAt = Date.now()
    let raw: string | null = null
    let failure: 'parse_failed' | 'invalid_target' = 'parse_failed'

    try {
      // 파싱 실패는 1회 재시도, 존재하지 않는 대상은 재시도하지 않는다
      for (let attempt = 0; attempt < 2; attempt++) {
        raw = (await engine.decide(context, signal)).raw
        const parsed = parseModelOutput(raw, context)
        if (parsed.ok) return finish(parsed.action, 'model')
        failure = parsed.reason
        if (parsed.reason === 'invalid_target') break
      }
    } catch (error) {
      if (error instanceof EngineUnavailableError) return { ok: false, reason: error.reason }
      throw error
    }
    return finish(FALLBACK_ACTION, 'fallback', failure)

    function finish(
      action: GhostAction,
      source: Decision['source'],
      fallbackReason?: DecisionRecord['fallbackReason']
    ): DecideResult {
      lastAction = action.type
      lastActionAt = Date.now()
      onRecord({
        context,
        raw,
        action,
        engine: engine.label,
        source,
        fallbackReason,
        latencyMs: Date.now() - startedAt
      })
      return { ok: true, decision: { action, source } }
    }
  }
}
