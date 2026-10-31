// IPC 계약 — docs/PRD.md §7.3. preload는 여기 있는 채널만 통과시킨다.

export type CursorUpdate = { x: number; y: number; speed: number }

export type MainToRenderer = {
  'cursor:update': CursorUpdate
}

export type RendererToMain = {
  'ghost:arrived': Record<string, never>
}

export const MAIN_TO_RENDERER = [
  'cursor:update'
] as const satisfies readonly (keyof MainToRenderer)[]
export const RENDERER_TO_MAIN = [
  'ghost:arrived'
] as const satisfies readonly (keyof RendererToMain)[]

export type GhostBridge = {
  on<K extends keyof MainToRenderer>(
    channel: K,
    listener: (payload: MainToRenderer[K]) => void
  ): () => void
  send<K extends keyof RendererToMain>(channel: K, payload: RendererToMain[K]): void
}
