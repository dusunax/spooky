import type { BrowserWindow } from 'electron'
import type { DemoTargets } from './demo-targets'
import { SCREEN_TARGET_ID, spotFor, type ScreenTarget, type Spot } from './screen-target'
import type { Decision } from '../src/shared/ipc'

// EXPLODE: 유령이 대상으로 날아가고(최대 1.5초) → 폭파 → 연출이 끝나면 쿨다운
//  - 데모 창 버튼: 데모 창이 실제로 부수고, 오버레이도 그 위치에 폭발·목소리를 그린다
//    (데모 창이 다른 창 뒤에 가려져 있어도 보이게)
//  - 외부 앱 요소(버튼·입력칸·글씨·아이콘): 오버레이에 폭발만 그린다. 그 요소는 그대로다 (PRD OQ-8)

const APPROACH_LIMIT_MS = 1500
const HOVER_ABOVE = 40
const VOICE_GRACE_MS = 500
const DEMO_SHAKE_MS = 300 // src/demo/Demo.tsx SHAKE_MS와 같은 값

type Voice = Promise<Uint8Array | null>

type Pending =
  | { kind: 'demo'; id: string; voice: Voice; timer: ReturnType<typeof setTimeout> }
  | { kind: 'screen'; spot: Spot; voice: Voice; timer: ReturnType<typeof setTimeout> }

type Deps = {
  getOverlay: () => BrowserWindow | null
  getDemo: () => BrowserWindow | null
  demoTargets: DemoTargets
  screenTarget: ScreenTarget
  sendToOverlay: BrowserWindow['webContents']['send']
  voiceFor: (text: string) => Voice // Mute면 null을 돌려준다
  finish: () => void // 행동이 끝났다 — 쿨다운으로
}

export type Exploder = {
  run: (decision: Decision) => void
  arrived: () => void // 오버레이: 유령이 대상 위에 도착
}

export function createExploder(deps: Deps): Exploder {
  const { getOverlay, getDemo, demoTargets, screenTarget, sendToOverlay, voiceFor, finish } = deps
  let pending: Pending | null = null

  // 목소리는 날아가는 동안 만들어 둔다. 늦어지면 조금만 기다리고 목소리 없이 터뜨린다.
  // 오버레이가 폭발과 목소리를 동시에 시작하고, 둘 다 끝나면 ghost:screen-done으로 알린다
  const burstOnOverlay = (spot: Spot, voice: Voice): void => {
    const voiceOrNothing = Promise.race([
      voice,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), VOICE_GRACE_MS))
    ])
    voiceOrNothing.then((v) => sendToOverlay('ghost:screen-explode', { ...spot, voice: v }))
  }

  const explodeNow = (): void => {
    if (!pending) return
    clearTimeout(pending.timer)
    const now = pending
    pending = null
    const demo = getDemo()
    if (now.kind === 'screen') {
      burstOnOverlay(now.spot, now.voice)
    } else if (demo && !demo.isDestroyed()) {
      demo.webContents.send('demo:explode', { id: now.id })
      const spot = demoTargets.spot(now.id)
      // 데모 창 버튼이 0.3초 흔들린 뒤 터지는 타이밍에 맞춘다
      if (spot) setTimeout(() => burstOnOverlay(spot, now.voice), DEMO_SHAKE_MS)
    } else {
      finish()
    }
  }

  return {
    run({ action, line = '' }) {
      if (action.type !== 'EXPLODE') return // BOO는 오버레이가 재생하고 ghost:boo-ended로 알린다
      const timer = setTimeout(explodeNow, APPROACH_LIMIT_MS)
      const giveUp = (): void => {
        clearTimeout(timer)
        finish() // 그 사이 대상이 사라졌다
      }

      if (action.targetId === SCREEN_TARGET_ID) {
        const found = screenTarget.current()
        const overlay = getOverlay()
        if (!found || !overlay || overlay.isDestroyed()) return giveUp()
        const spot = spotFor(found.button.frame, found.cursor, overlay.getBounds())
        sendToOverlay('ghost:approach', { x: spot.x, y: spot.y - HOVER_ABOVE })
        // 화면 요소: 그 글씨에 ?를 붙여 읽고 이어서 모델이 만든 한마디
        const label = found.button.label
        pending = {
          kind: 'screen',
          spot,
          voice: voiceFor(line ? `${label}? ${line}` : label),
          timer
        }
        return
      }

      const point = demoTargets.approachPoint(action.targetId)
      if (!point) return giveUp()
      sendToOverlay('ghost:approach', point)
      pending = { kind: 'demo', id: action.targetId, voice: voiceFor(line), timer }
    },
    arrived: explodeNow
  }
}
