// 16×16 픽셀 매트릭스 — 4배 확대해 64px로 그린다 (PRD §3.2, OQ-3).
// 형태는 docs/reference/sprite-sheet.webp를 따른다: 둥근 몸통, 오른쪽에 몰린 1px 점눈,
// 분홍 입, 뒤쪽 팔, 왼쪽 아래 그림자, 세 갈래 물결 하단.
// '.' 투명 · 'K' 외곽선 · 'W' 몸통(반투명 유리) · 'G' 몸통 그림자 · 'H' 유리 하이라이트 · 'P' 입 안쪽.
// 기본 프레임은 오른쪽을 본다. 표정은 얼굴 없는 몸통 위에 점을 찍어 만든다.

export type GhostFrame = 'idle' | 'boo' | 'mischief' | 'thinking' | 'excited' | 'sleepy'

const BODY = [
  '......KKKK......',
  '....KKWWWWKK....',
  '...KWHHWWWWWK...',
  '..KWHWWWWWWWWK..',
  '..KWWWWWWWWWWK..',
  '.KWWWWWWWWWWWWK.', // 5: 눈썹·위를 보는 눈
  '.KWWWWWWWWWWWWK.', // 6: 눈
  'KWWWWWWWWWWWWWK.', // 7: 팔
  'KWWWWWWWWWWWWWK.', // 8~11: 입
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KGWWWWWWWWWWWK.',
  '.KGGWKWWWWKWWWK.',
  '.KGGK.KWWK.KWWK.',
  '..KK...KK...KK..'
]

type Dot = [row: number, col: number, color: 'K' | 'P']

const k = (row: number, ...cols: number[]): Dot[] => cols.map((col) => [row, col, 'K'])
const p = (row: number, ...cols: number[]): Dot[] => cols.map((col) => [row, col, 'P'])

const EYES: Dot[] = k(6, 8, 11)

// 레퍼런스 시트의 IDLE·BOO·ANGRY·THINKING·HAPPY·COOLDOWN 표정을 16×16에 맞춰 옮겼다
const FACES: Record<GhostFrame, Dot[]> = {
  // 웃는 얼굴, 분홍 입
  idle: [...EYES, ...k(8, 8, 9, 10, 11), ...k(9, 8, 11), ...p(9, 9, 10), ...k(10, 9, 10)],
  // 입을 크게 벌림
  boo: [
    ...EYES,
    ...k(8, 8, 9, 10, 11),
    ...k(9, 7, 12),
    ...p(9, 8, 9, 10, 11),
    ...k(10, 7, 12),
    ...p(10, 8, 9, 10, 11),
    ...k(11, 8, 9, 10, 11)
  ],
  // 장난기: 안쪽으로 내려간 눈썹 + 한쪽만 올라간 입
  mischief: [...k(5, 7, 12), ...EYES, ...k(8, 11), ...k(9, 8, 9, 10)],
  // 골똘히: 위를 보는 눈 + 다문 입
  thinking: [...k(5, 9, 12), ...k(9, 9, 10)],
  // 신남: ^ ^ 눈 + 활짝 웃는 입
  excited: [
    ...k(6, 7, 9),
    ...k(5, 8),
    ...k(6, 10, 12),
    ...k(5, 11),
    ...k(8, 7, 8, 9, 10, 11, 12),
    ...k(9, 7, 12),
    ...p(9, 8, 9, 10, 11),
    ...k(10, 8, 9, 10, 11)
  ],
  // 졸림: 감은 눈 + 작은 입
  sleepy: [...k(6, 7, 8, 11, 12), ...k(9, 9, 10)]
}

function paint(dots: Dot[]): string[] {
  const rows = BODY.map((row) => row.split(''))
  for (const [row, col, color] of dots) rows[row][col] = color
  return rows.map((row) => row.join(''))
}

export const GHOST_FRAMES = Object.fromEntries(
  Object.entries(FACES).map(([frame, dots]) => [frame, paint(dots)])
) as Record<GhostFrame, string[]>

// 머리 위 작은 아이콘 (레퍼런스 시트 EXTRA EFFECTS) — 'Y' 노랑 · 'B' 하늘 · 'K' 외곽선
export type HeadIcon = 'question' | 'zzz' | 'z' | 'sparkle'

export const HEAD_ICONS: Record<HeadIcon, string[]> = {
  question: ['.KKK.', 'K...K', '....K', '..KK.', '..K..', '.....', '..K..'],
  zzz: ['....BBBB', '......B.', '.....B..', 'BBB.BBBB', '..B.....', '.B......', 'BBB.....'],
  z: ['BBB', '..B', '.B.', 'BBB'],
  sparkle: ['..Y..', '..Y..', 'YYYYY', '..Y..', '..Y..']
}

export const PALETTE: Record<string, string> = {
  K: '#1f1f26',
  W: 'rgb(255 255 255 / 70%)',
  G: 'rgb(200 206 224 / 70%)',
  H: '#ffffff',
  P: '#ff6f91',
  Y: '#ffd84d',
  B: '#7cc4ff'
}
