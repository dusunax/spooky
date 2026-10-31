// IPC 계약 — docs/PRD.md §7.3. preload는 여기 있는 채널만 통과시킨다.

import type { BooPatternId } from './boo-patterns'

// x·y는 오버레이(현재 디스플레이) 로컬 좌표, origin은 그 디스플레이의 전역 원점
export type CursorUpdate = { x: number; y: number; speed: number; origin: { x: number; y: number } }

// PRD §5.2 Mischief 레이어
export type MischiefState =
  'CHARGING' | 'THINKING' | 'ACTING' | 'COOLDOWN' | 'AI_OFFLINE' | 'PAUSED'

// 허용 목록 밖의 행동은 존재하지 않는다 (PRD §4 FR-04)
export type GhostAction = { type: 'BOO'; intensity: number } | { type: 'EXPLODE'; targetId: string }

export type Decision = { action: GhostAction; source: 'model' | 'fallback' }

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
}

// 데모 창 버튼 — rect는 데모 창 콘텐츠 기준 CSS px
export type DemoTarget = {
  id: string
  label: string
  rect: { x: number; y: number; width: number; height: number }
  disabled: boolean // 폭파 후 복구 중
}

export type MainToRenderer = {
  'cursor:update': CursorUpdate
  'ghost:state': GhostState
  'ghost:settings': GhostSettings
  'ghost:preview-boo': { pattern: BooPatternId }
  'ghost:approach': { x: number; y: number } // 오버레이 로컬 좌표
  'demo:explode': { id: string }
}

export type RendererToMain = {
  'ghost:arrived': Record<string, never>
  'ghost:boo-ended': Record<string, never>
  'ghost:position': { x: number; y: number } // 유령 중심, 오버레이 로컬 좌표
  'demo:targets': DemoTarget[]
  'demo:exploded': { id: string }
}

export const MAIN_TO_RENDERER = [
  'cursor:update',
  'ghost:state',
  'ghost:settings',
  'ghost:preview-boo',
  'ghost:approach',
  'demo:explode'
] as const satisfies readonly (keyof MainToRenderer)[]
export const RENDERER_TO_MAIN = [
  'ghost:arrived',
  'ghost:boo-ended',
  'ghost:position',
  'demo:targets',
  'demo:exploded'
] as const satisfies readonly (keyof RendererToMain)[]

export type GhostBridge = {
  on<K extends keyof MainToRenderer>(
    channel: K,
    listener: (payload: MainToRenderer[K]) => void
  ): () => void
  send<K extends keyof RendererToMain>(channel: K, payload: RendererToMain[K]): void
}
