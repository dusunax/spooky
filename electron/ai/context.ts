import type { CursorUpdate, GhostAction } from '../../src/shared/ipc'
import type { DecisionContext } from './schema'

type Inputs = {
  cursor: CursorUpdate | null
  ghost: { x: number; y: number } | null
  last: { action: GhostAction['type'] | null; at: number | null }
  targets: DecisionContext['targets']
}

function speedBucket(pxPerSecond: number): DecisionContext['cursorSpeed'] {
  if (pxPerSecond < 40) return 'still'
  if (pxPerSecond < 800) return 'slow'
  return 'fast'
}

// 소형 모델은 목록 맨 앞을 고르는 경향이 있어(실측: 3/3 btn-save) 매번 순서를 섞는다
function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildContext({ cursor, ghost, last, targets }: Inputs): DecisionContext {
  const distance =
    cursor && ghost ? Math.round(Math.hypot(cursor.x - ghost.x, cursor.y - ghost.y)) : 60
  return {
    cursorSpeed: speedBucket(cursor?.speed ?? 0),
    distanceToCursor: distance,
    lastAction: last.action,
    secondsSinceLastAction: last.at === null ? null : Math.round((Date.now() - last.at) / 1000),
    targets: shuffled(targets)
  }
}
