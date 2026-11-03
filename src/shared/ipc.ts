// IPC 계약 — docs/PRD.md §7.3. preload는 여기 있는 채널만 통과시킨다.

import type { BooPatternId } from './boo-patterns'

// x·y는 오버레이(현재 디스플레이) 로컬 좌표, origin은 그 디스플레이의 전역 원점
export type CursorUpdate = { x: number; y: number; speed: number; origin: { x: number; y: number } }

// PRD §5.2 Mischief 레이어
export type MischiefState =
  'CHARGING' | 'THINKING' | 'ACTING' | 'COOLDOWN' | 'AI_OFFLINE' | 'PAUSED'

// 허용 목록 밖의 행동은 존재하지 않는다 (PRD §4 FR-04)
export type GhostAction = { type: 'BOO'; intensity: number } | { type: 'EXPLODE'; targetId: string }

// debug = SPOOKY_DEBUG_SCREEN_TARGET로 모델을 거치지 않고 화면 요소를 강제로 고른 것
export type Decision = {
  action: GhostAction
  source: 'model' | 'fallback' | 'debug'
  line?: string // 모델이 만든 유령의 한마디 (말풍선·목소리)
}

export type GhostState = {
  mischief: MischiefState
  gauge: number // 0~100 정수
  statusText: string
  decision: Decision | null // ACTING 중일 때만
  actionId: number // 행동마다 1씩 증가 — 같은 행동을 두 번 실행하지 않게
}

// 사용자 설정 — main이 저장하고 오버레이에 알린다
export type GhostSettings = {
  muted: boolean
  booPatterns: BooPatternId[] // 이 중에서 랜덤, 최소 1개
  screenButtons: boolean // 커서 근처 외부 앱 버튼에 반응 (PRD OQ-8, 기본 꺼짐)
  chargeSeconds: number // 게이지가 가득 차는 데 걸리는 시간 = 장난 주기
}

// 데모 창 버튼 — rect는 데모 창 콘텐츠 기준 CSS px
export type DemoTarget = {
  id: string
  label: string
  rect: { x: number; y: number; width: number; height: number }
  disabled: boolean // 폭파 중이거나 이미 부서짐
}

export type MainToRenderer = {
  'cursor:update': CursorUpdate
  'ghost:state': GhostState
  'ghost:settings': GhostSettings
  'ghost:preview-boo': { pattern: BooPatternId }
  'ghost:approach': { x: number; y: number } // 오버레이 로컬 좌표
  'demo:explode': { id: string }
  'demo:reset': Record<string, never> // 부서진 버튼 되살리기
  // 외부 요소 위: 폭발·그을음 그림과 함께 그 글씨를 유령 목소리로 읽는다.
  // x·y는 요소 중심(오버레이 로컬), width·height는 요소 크기, voice는 `say`로 만든 WAV(없으면 null)
  'ghost:play-voice': { voice: Uint8Array } // 트레이 Test Ghost Voice
  'ghost:screen-explode': {
    x: number
    y: number
    width: number
    height: number
    voice: Uint8Array | null
  }
}

export type RendererToMain = {
  'ghost:arrived': Record<string, never>
  'ghost:boo-ended': Record<string, never>
  'ghost:position': { x: number; y: number } // 유령 중심, 오버레이 로컬 좌표
  'demo:targets': DemoTarget[]
  'ghost:screen-done': Record<string, never> // 폭발·목소리 연출이 끝남
  'demo:exploded': { id: string }
}

export const MAIN_TO_RENDERER = [
  'cursor:update',
  'ghost:state',
  'ghost:settings',
  'ghost:preview-boo',
  'ghost:approach',
  'demo:explode',
  'demo:reset',
  'ghost:screen-explode',
  'ghost:play-voice'
] as const satisfies readonly (keyof MainToRenderer)[]
export const RENDERER_TO_MAIN = [
  'ghost:arrived',
  'ghost:boo-ended',
  'ghost:position',
  'demo:targets',
  'demo:exploded',
  'ghost:screen-done'
] as const satisfies readonly (keyof RendererToMain)[]

export type GhostBridge = {
  on<K extends keyof MainToRenderer>(
    channel: K,
    listener: (payload: MainToRenderer[K]) => void
  ): () => void
  send<K extends keyof RendererToMain>(channel: K, payload: RendererToMain[K]): void
}
