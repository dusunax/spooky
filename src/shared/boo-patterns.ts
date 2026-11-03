// BOO 소리 패턴 목록 — 트레이 설정(main)과 합성기(renderer)가 함께 쓴다
export const BOO_PATTERNS = [
  { id: 'wail', label: 'Wail: 우우우~' },
  { id: 'question', label: 'Question: 우우~?' },
  { id: 'stutter', label: 'Stutter: 우, 우, 우우~' },
  { id: 'moan', label: 'Moan: 우우우…' },
  { id: 'warble', label: 'Warble: 우워워워~' }
] as const

export type BooPatternId = (typeof BOO_PATTERNS)[number]['id']

export const BOO_PATTERN_IDS = BOO_PATTERNS.map((p) => p.id) as [BooPatternId, ...BooPatternId[]]
