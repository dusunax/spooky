import type { DecisionRecord } from './ai/decide'
import type { ScreenButton, ScreenButtons } from './screen-buttons'
import { spokenText } from './spoken-text'

// 커서 근처의 외부 앱 요소를 판단 대상 하나로 만든다 (PRD OQ-8).
// 요소의 글씨는 로컬 모델과 유령 목소리에만 쓰고, 로그에는 남기지 않는다.

export const SCREEN_TARGET_ID = 'screen-target'

export type Spot = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }

// 문단처럼 큰 요소는 중심이 커서에서 멀 수 있어, 요소 안에서 커서와 가장 가까운 지점으로 간다
const LARGE = { width: 240, height: 60 }
const SCORCH_FOR_LARGE = { width: 160, height: 40 }

// 터뜨릴 지점(오버레이 로컬)과 그을음 크기
export function spotFor(frame: Rect, cursor: Point | null, overlay: Rect): Spot {
  const { x, y, width, height } = frame
  const large = width > LARGE.width || height > LARGE.height
  if (!large || !cursor) {
    return { x: x + width / 2 - overlay.x, y: y + height / 2 - overlay.y, width, height }
  }
  const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)
  const halfW = Math.min(width, SCORCH_FOR_LARGE.width) / 2
  const halfH = Math.min(height, SCORCH_FOR_LARGE.height) / 2
  return {
    x: clamp(cursor.x, x + halfW, x + width - halfW) - overlay.x,
    y: clamp(cursor.y, y + halfH, y + height - halfH) - overlay.y,
    width: halfW * 2,
    height: halfH * 2
  }
}

// 로그용 — 화면 요소가 후보에 있었으면 그 라벨과, 글씨가 섞일 수 있는 대사·원본 출력을 가린다
export function redactRecord(record: DecisionRecord): DecisionRecord {
  if (!record.context.targets.some((t) => t.id === SCREEN_TARGET_ID)) return record
  return {
    ...record,
    raw: '[redacted]',
    line: '[redacted]',
    context: {
      ...record.context,
      targets: record.context.targets.map((t) =>
        t.id === SCREEN_TARGET_ID ? { ...t, label: '[on-screen element]' } : t
      )
    }
  }
}

type Deps = {
  screenButtons: ScreenButtons
  isEnabled: () => boolean
  cursorGlobal: () => Point | null
}

export type ScreenTarget = {
  // 반경 120px 안에서 커서에 가장 가까운 요소 하나를 대상 후보로 (설정이 꺼져 있거나 못 찾으면 빈 배열)
  probe: () => Promise<{ id: string; label: string }[]>
  // 마지막으로 찾은 요소 — 폭파 때 위치와 읽을 글씨에 쓴다
  current: () => { button: ScreenButton; cursor: Point } | null
}

export function createScreenTarget({ screenButtons, isEnabled, cursorGlobal }: Deps): ScreenTarget {
  let found: { button: ScreenButton; cursor: Point } | null = null

  return {
    async probe() {
      found = null
      const cursor = cursorGlobal()
      if (!isEnabled() || !cursor) return []
      const result = await screenButtons.probe(cursor)
      // 상태와 요소 종류·크기만 남긴다 — 글씨는 로그에 쓰지 않는다
      console.info(
        '[spooky] screen probe',
        result.status,
        result.status === 'found'
          ? `${result.button.kind} ${result.button.role} in ${result.button.app} ${Math.round(result.button.frame.width)}x${Math.round(result.button.frame.height)}`
          : result.status === 'none'
            ? JSON.stringify(result.miss ?? {})
            : '',
        'ms' in result && result.ms !== undefined ? `${result.ms}ms` : ''
      )
      if (result.status !== 'found') return []
      // 모델에 넘기는 라벨과 유령이 읽는 글씨를 같은 길이(4단어·30자, 단어 경계)로 맞춘다
      const button = { ...result.button, label: spokenText(result.button.label) }
      found = { button, cursor }
      const where = button.app ? `${button.kind} in ${button.app}` : button.kind
      return [{ id: SCREEN_TARGET_ID, label: `${button.label} (${where})` }]
    },
    current: () => found
  }
}
