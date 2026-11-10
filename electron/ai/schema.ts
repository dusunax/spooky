import { z } from 'zod'
import type { GhostAction } from '../../src/shared/ipc'

// 모델에 건네는 컨텍스트 (PRD §4 FR-04). 수치 대신 버킷 — 소형 모델이 덜 헷갈린다.
export type DecisionContext = {
  cursorSpeed: 'still' | 'slow' | 'fast'
  distanceToCursor: number
  lastAction: GhostAction['type'] | null
  secondsSinceLastAction: number | null
  targets: { id: string; label: string; distance: number }[] // distance = 커서에서 대상까지 px, 가까운 순
  lineLanguage: 'Korean' | 'English' // 대상 글씨에 한글이 있으면 한국어로 말하게 한다
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
      intensity: { type: 'number' },
      // 고른 뒤에 대사를 쓰도록 맨 뒤에 둔다
      // 문법으로 글자 수를 자르면 문장 중간에서 끊긴다 — 넉넉히 두고 cleanLine이 첫 문장만 남긴다
      line: { type: 'string', maxLength: 120 }
    },
    required: ['choice', 'intensity', 'line']
  }
}

// 유령의 한마디 — 말풍선과 목소리로 쓴다
export const LINE_LIMIT = { maxWords: 5, maxChars: 40 }

const ModelOutput = z.object({
  choice: z.string(),
  intensity: z.number(),
  line: z.string().optional()
})

export type ParseResult =
  | { ok: true; action: GhostAction; line: string }
  | { ok: false; reason: 'parse_failed' | 'invalid_target' }

// 따옴표·이모지를 걷어 내고 첫 문장만, 5단어·40자 안에서 단어 경계로 자른다
function cleanLine(line: string | undefined): string {
  // 이모지·따옴표는 뺀다 — 목소리가 이모지 이름을 읽어 버린다
  const words = (line ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  // 첫 문장(? ! . 까지)만 — 긴 대사가 중간에서 끊기지 않게
  const firstSentence = words.join(' ').match(/^.*?[?!.]+/)?.[0] ?? words.join(' ')
  let out = ''
  for (const word of firstSentence.split(' ').slice(0, LINE_LIMIT.maxWords)) {
    const next = out ? `${out} ${word}` : word
    if (next.length > LINE_LIMIT.maxChars) break
    out = next
  }
  return out
}

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
  const line = cleanLine(parsed.data.line)
  if (choice === 'BOO') {
    if (intensity < 0 || intensity > 1) return { ok: false, reason: 'parse_failed' }
    return { ok: true, action: { type: 'BOO', intensity }, line: '' } // BOO는 대사 없이 소리만
  }
  if (choice.startsWith(EXPLODE_PREFIX)) {
    const targetId = choice.slice(EXPLODE_PREFIX.length)
    if (!context.targets.some((t) => t.id === targetId))
      return { ok: false, reason: 'invalid_target' }
    return { ok: true, action: { type: 'EXPLODE', targetId }, line }
  }
  return { ok: false, reason: 'parse_failed' }
}
