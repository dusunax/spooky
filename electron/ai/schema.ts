import { z } from 'zod'
import type { GhostAction } from '../../src/shared/ipc'

// 모델에 건네는 컨텍스트 (PRD §4 FR-04). 수치 대신 버킷 — 소형 모델이 덜 헷갈린다.
export type DecisionContext = {
  cursorSpeed: 'still' | 'slow' | 'fast'
  distanceToCursor: number
  lastAction: GhostAction['type'] | null
  secondsSinceLastAction: number | null
  targets: { id: string; label: string }[]
}

// 소형 모델이 EXPLODE를 고르고 대상을 비워 두는 일이 잦아서(실측),
// 행동과 대상을 "BOO" | "EXPLODE:<id>" 한 필드에서 고르게 한다.
const EXPLODE_PREFIX = 'EXPLODE:'

export function choicesFor(context: DecisionContext): string[] {
  return ['BOO', ...context.targets.map((t) => `${EXPLODE_PREFIX}${t.id}`)]
}

// Ollama `format`에 넘기는 JSON 스키마 — 허용된 선택지만 생성되도록 문법으로 묶는다
export function outputJsonSchema(context: DecisionContext): object {
  return {
    type: 'object',
    properties: {
      choice: { enum: choicesFor(context) },
      intensity: { type: 'number' }
    },
    required: ['choice', 'intensity']
  }
}

const ModelOutput = z.object({
  choice: z.string(),
  intensity: z.number()
})

export type ParseResult =
  { ok: true; action: GhostAction } | { ok: false; reason: 'parse_failed' | 'invalid_target' }

// 형식 강제와 별개로 한 번 더 검증한다 — 허용 목록 밖의 행동은 실행되지 않는다 (PRD §9 안전)
export function parseModelOutput(raw: string, context: DecisionContext): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'parse_failed' }
  }
  const parsed = ModelOutput.safeParse(json)
  if (!parsed.success) return { ok: false, reason: 'parse_failed' }

  const { choice, intensity } = parsed.data
  if (choice === 'BOO') {
    if (intensity < 0 || intensity > 1) return { ok: false, reason: 'parse_failed' }
    return { ok: true, action: { type: 'BOO', intensity } }
  }
  if (choice.startsWith(EXPLODE_PREFIX)) {
    const targetId = choice.slice(EXPLODE_PREFIX.length)
    if (!context.targets.some((t) => t.id === targetId))
      return { ok: false, reason: 'invalid_target' }
    return { ok: true, action: { type: 'EXPLODE', targetId } }
  }
  return { ok: false, reason: 'parse_failed' }
}
