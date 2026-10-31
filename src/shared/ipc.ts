// IPC 계약 — docs/PRD.md §7.3. preload는 여기 있는 채널만 통과시킨다.

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
}

export type MainToRenderer = {
  'cursor:update': CursorUpdate
  'ghost:state': GhostState
}

export type RendererToMain = {
  'ghost:arrived': Record<string, never>
  'ghost:boo-ended': Record<string, never>
}

export const MAIN_TO_RENDERER = [
  'cursor:update',
  'ghost:state'
] as const satisfies readonly (keyof MainToRenderer)[]
export const RENDERER_TO_MAIN = [
  'ghost:arrived',
  'ghost:boo-ended'
] as const satisfies readonly (keyof RendererToMain)[]

export type GhostBridge = {
  on<K extends keyof MainToRenderer>(
    channel: K,
    listener: (payload: MainToRenderer[K]) => void
  ): () => void
  send<K extends keyof RendererToMain>(channel: K, payload: RendererToMain[K]): void
}
