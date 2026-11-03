import type { Decision, GhostState, MischiefState } from '../src/shared/ipc'
import { SCREEN_TARGET_ID } from './screen-target'

// 결정 엔진이 돌려주는 결과. 모델에 닿지 못하면 장난을 멈춘다 (PRD §6).
export type DecideResult =
  { ok: true; decision: Decision } | { ok: false; reason: 'offline' | 'model_missing' }

export type MischiefConfig = {
  chargeMs: number
  cooldownMs: number
  actionTimeoutMs: number // 행동 종료 신호가 오지 않아도 멈추지 않게
  offlineRetryMs: number
  tickMs: number
}

export const DEFAULT_MISCHIEF_CONFIG: MischiefConfig = {
  chargeMs: 20_000,
  cooldownMs: 5_000,
  actionTimeoutMs: 10_000,
  offlineRetryMs: 30_000,
  tickMs: 100
}

type Deps = {
  decide: (signal: AbortSignal) => Promise<DecideResult>
  onState: (state: GhostState) => void
  onAction: (decision: Decision) => void
  config?: Partial<MischiefConfig>
}

export type Mischief = {
  finishAction: () => void
  setOffline: (reason: 'offline' | 'model_missing') => void
  setChargeMs: (ms: number) => void
  pause: () => void
  resume: () => void
  isPaused: () => boolean
  dispose: () => void
}

function describe(
  state: MischiefState,
  gauge: number,
  decision: Decision | null,
  offlineReason: 'offline' | 'model_missing'
): string {
  switch (state) {
    case 'CHARGING':
      return gauge < 50 ? 'Following cursor' : `Mischief ${gauge}%`
    case 'THINKING':
      return 'Thinking...'
    case 'ACTING': {
      if (!decision) return 'Action'
      const { action, source } = decision
      const target =
        action.type === 'EXPLODE' && action.targetId === SCREEN_TARGET_ID
          ? 'that one' // 외부 앱 요소 — 라벨은 화면에도 다시 쓰지 않는다
          : action.type === 'EXPLODE'
            ? action.targetId
            : ''
      const label = action.type === 'EXPLODE' ? `EXPLODE → ${target}` : 'BOO'
      return `Action: ${label}${source === 'model' ? '' : ` (${source})`}`
    }
    case 'COOLDOWN':
      return 'Cooldown'
    case 'AI_OFFLINE':
      return offlineReason === 'model_missing' ? 'Model missing' : 'AI offline'
    case 'PAUSED':
      return 'Paused'
  }
}

// 게이지와 Mischief 상태의 단일 진실 공급원 (PRD §5.2, §7.2).
// 이동 레이어는 렌더러가 맡고, 여기서는 장난 주기만 관리한다.
export function createMischief({ decide, onState, onAction, config }: Deps): Mischief {
  const cfg = { ...DEFAULT_MISCHIEF_CONFIG, ...config }

  let state: MischiefState = 'CHARGING'
  let gauge = 0
  let decision: Decision | null = null
  let actionId = 0
  let offlineReason: 'offline' | 'model_missing' = 'offline'
  let pausedFrom: MischiefState | null = null
  let phaseTimer: ReturnType<typeof setTimeout> | null = null
  let inflight: AbortController | null = null
  let lastEmitted = ''
  let lastTick = Date.now()

  const emit = (): void => {
    const next: GhostState = {
      mischief: state,
      gauge: Math.floor(gauge),
      statusText: describe(state, Math.floor(gauge), decision, offlineReason),
      decision: state === 'ACTING' ? decision : null,
      actionId
    }
    const key = JSON.stringify(next)
    if (key === lastEmitted) return
    lastEmitted = key
    onState(next)
  }

  const clearPhase = (): void => {
    if (phaseTimer) clearTimeout(phaseTimer)
    phaseTimer = null
  }

  const enter = (next: MischiefState): void => {
    clearPhase()
    state = next
    emit()
  }

  const think = (): void => {
    enter('THINKING')
    inflight?.abort()
    const controller = new AbortController()
    inflight = controller

    decide(controller.signal)
      .then((result) => {
        if (controller.signal.aborted || state !== 'THINKING') return
        if (result.ok) act(result.decision)
        else goOffline(result.reason)
      })
      .catch(() => {
        if (controller.signal.aborted || state !== 'THINKING') return
        goOffline('offline')
      })
      .finally(() => {
        if (inflight === controller) inflight = null
      })
  }

  const act = (next: Decision): void => {
    decision = next
    actionId++
    enter('ACTING')
    onAction(next)
    phaseTimer = setTimeout(finishAction, cfg.actionTimeoutMs)
  }

  const cooldown = (): void => {
    gauge = 0
    decision = null
    enter('COOLDOWN')
    phaseTimer = setTimeout(() => enter('CHARGING'), cfg.cooldownMs)
  }

  const goOffline = (reason: 'offline' | 'model_missing'): void => {
    offlineReason = reason
    enter('AI_OFFLINE')
    phaseTimer = setTimeout(think, cfg.offlineRetryMs)
  }

  function finishAction(): void {
    if (state === 'ACTING') cooldown()
  }

  const ticker = setInterval(() => {
    const now = Date.now()
    const dt = now - lastTick
    lastTick = now
    if (state !== 'CHARGING') return
    gauge = Math.min(100, gauge + (100 * dt) / cfg.chargeMs)
    if (gauge >= 100) think()
    else emit()
  }, cfg.tickMs)

  emit()

  return {
    finishAction,
    // 시작 헬스체크 실패 시 게이지가 의미 없이 차지 않게 바로 AI_OFFLINE으로 (PRD §6)
    setOffline(reason) {
      if (state === 'CHARGING') goOffline(reason)
    },
    pause() {
      if (state === 'PAUSED') return
      pausedFrom = state
      inflight?.abort()
      enter('PAUSED')
    },
    resume() {
      if (state !== 'PAUSED') return
      const from = pausedFrom ?? 'CHARGING'
      pausedFrom = null
      lastTick = Date.now()
      // THINKING·AI_OFFLINE은 다시 묻고, 행동 중이던 것은 쿨다운으로 마무리한다 (PRD §5.2)
      if (from === 'THINKING' || from === 'AI_OFFLINE') think()
      else if (from === 'ACTING' || from === 'COOLDOWN') cooldown()
      else enter('CHARGING')
    },
    // 장난 주기 변경 — 지금 차고 있는 게이지에도 바로 적용된다 (차 있는 비율은 그대로)
    setChargeMs(ms) {
      cfg.chargeMs = ms
    },
    isPaused: () => state === 'PAUSED',
    dispose() {
      clearInterval(ticker)
      clearPhase()
      inflight?.abort()
    }
  }
}
