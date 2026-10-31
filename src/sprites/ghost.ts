// 16×16 픽셀 매트릭스 — 4배 확대해 64px로 그린다 (PRD §3.2, OQ-3).
// 형태는 docs/reference/sprite-sheet.webp를 따른다: 둥근 몸통, 오른쪽에 몰린 1px 점눈,
// 분홍 입, 뒤쪽 팔, 왼쪽 아래 그림자, 세 갈래 물결 하단.
// '.' 투명 · 'K' 외곽선 · 'W' 몸통 · 'G' 몸통 그림자 · 'P' 입 안쪽. 기본 프레임은 오른쪽을 본다.

export type GhostFrame = 'idle' | 'boo'

const HEAD = [
  '......KKKK......',
  '....KKWWWWKK....',
  '...KWWWWWWWWK...',
  '..KWWWWWWWWWWK..',
  '..KWWWWWWWWWWK..',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWKWWKWWK.',
  'KWWWWWWWWWWWWWK.'
]

const TAIL = ['.KGWWWWWWWWWWWK.', '.KGGWKWWWWKWWWK.', '.KGGK.KWWK.KWWK.', '..KK...KK...KK..']

const MOUTHS: Record<GhostFrame, string[]> = {
  idle: ['KWWWWWWWKKKKWWK.', '.KWWWWWWKPPKWWK.', '.KWWWWWWWKKWWWK.', '.KWWWWWWWWWWWWK.'],
  boo: ['KWWWWWWWKKKKWWK.', '.KWWWWWKPPPPKWK.', '.KWWWWWKPPPPKWK.', '.KWWWWWWKKKKWWK.']
}

export const GHOST_FRAMES: Record<GhostFrame, string[]> = {
  idle: [...HEAD, ...MOUTHS.idle, ...TAIL],
  boo: [...HEAD, ...MOUTHS.boo, ...TAIL]
}

export const PALETTE: Record<string, string> = {
  K: '#1f1f26',
  W: '#ffffff',
  G: '#d9dbe4',
  P: '#ff6f91'
}
