import { GHOST_FRAMES, type GhostFrame } from './ghost'

// 커스텀 동물귀 — 몸통 위에 덮어 그려서 귀 안쪽 흰색이 몸통과 이어진다 (2026-11-03 시안 확정).
// 행 번호는 몸통 기준: 음수는 머리 위, 0·1은 머리 윗줄을 덮어 외곽선을 튼다. '.'은 몸통 그대로.
// 'R' 귀 안쪽 분홍 · 'G' 몸통과 같은 그림자색

export const EAR_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'cat', label: 'Cat' },
  { id: 'bear', label: 'Bear' }
] as const

export type EarStyle = (typeof EAR_STYLES)[number]['id']

export const EAR_IDS = EAR_STYLES.map((e) => e.id) as [EarStyle, ...EarStyle[]]

// 귀가 머리 위로 올라가는 최대 높이(행) — 귀가 있으면 프레임이 16×20이 된다
export const EAR_RISE = 4

const EAR_LAYERS: Record<Exclude<EarStyle, 'none'>, Record<number, string>> = {
  // 가운데로 모은 작은 귀, 분홍 3칸, 그림자 없음
  bunny: {
    [-4]: '.....KK.KK......',
    [-3]: '....KWWKWWK.....',
    [-2]: '....KRWKWRK.....',
    [-1]: '....KRWKWRK.....',
    [0]: '....KRWKWRK.....',
    [1]: '....KWWWWWWK....'
  },
  // 머리 옆선이 귀 끝까지 곧게, 가운데 V자 홈, 끝은 흰색 아래로 바깥쪽 세모 그림자
  cat: {
    [-4]: '...KK......KK...',
    [-3]: '...KWK....KWK...',
    [-2]: '...KGWK..KWGK...',
    [-1]: '...KGGWKKWGGK...',
    [0]: '...KGGWWWWGGK...',
    [1]: '...KGWWWWWWGK...'
  },
  // 머리 양쪽 위 모서리의 작고 둥근 귀, 왼쪽 아래 그림자
  bear: {
    [-2]: '....KK....KK....',
    [-1]: '...KWWK..KWWK...',
    [0]: '...KGWKKKKGWK...',
    [1]: '...KGWWWWWWWK...'
  }
}

const EMPTY_ROW = '.'.repeat(16)

export function withEars(body: string[], ears: EarStyle): string[] {
  if (ears === 'none') return body
  const rows = [...Array<string>(EAR_RISE).fill(EMPTY_ROW), ...body].map((row) => row.split(''))
  for (const [r, layer] of Object.entries(EAR_LAYERS[ears])) {
    const y = EAR_RISE + Number(r)
    layer.split('').forEach((c, x) => {
      if (c !== '.') rows[y][x] = c
    })
  }
  return rows.map((row) => row.join(''))
}

// 표정 × 귀 조합을 미리 만들어 둔다 — 렌더러가 같은 배열을 받아 캐시를 쓴다
export const EARED_FRAMES = Object.fromEntries(
  EAR_IDS.map((ears) => [
    ears,
    Object.fromEntries(
      Object.entries(GHOST_FRAMES).map(([face, rows]) => [face, withEars(rows, ears)])
    )
  ])
) as Record<EarStyle, Record<GhostFrame, string[]>>
