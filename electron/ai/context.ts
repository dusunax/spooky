import type { CursorUpdate, GhostAction } from '../../src/shared/ipc'
import type { DecisionContext } from './schema'

type Inputs = {
  cursor: CursorUpdate | null
  ghost: { x: number; y: number } | null
  last: { action: GhostAction['type'] | null; at: number | null }
  targets: DecisionContext['targets']
}

const HANGUL = /[\u3131-\u318e\uac00-\ud7a3]/

function speedBucket(pxPerSecond: number): DecisionContext['cursorSpeed'] {
  if (pxPerSecond < 40) return 'still'
  if (pxPerSecond < 800) return 'slow'
  return 'fast'
}

// 소형 모델은 목록 맨 앞을 고르는 경향이 있다(실측: 섞어도 70%). 섞는 대신 커서에서 가까운 순으로 넘겨
// 그 습관이 "가장 가까운 것을 터뜨린다"는 행동이 되게 한다
function nearestFirst<T extends { distance: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.distance - b.distance)
}

export function buildContext({ cursor, ghost, last, targets }: Inputs): DecisionContext {
  const distance =
    cursor && ghost ? Math.round(Math.hypot(cursor.x - ghost.x, cursor.y - ghost.y)) : 60
  return {
    cursorSpeed: speedBucket(cursor?.speed ?? 0),
    distanceToCursor: distance,
    lastAction: last.action,
    secondsSinceLastAction: last.at === null ? null : Math.round((Date.now() - last.at) / 1000),
    targets: nearestFirst(targets),
    lineLanguage: targets.some((t) => HANGUL.test(t.label)) ? 'Korean' : 'English'
  }
}
