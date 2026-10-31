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

export function buildContext({ cursor, ghost, last, targets }: Inputs): DecisionContext {
  const distance =
    cursor && ghost ? Math.round(Math.hypot(cursor.x - ghost.x, cursor.y - ghost.y)) : 60
  return {
    cursorSpeed: speedBucket(cursor?.speed ?? 0),
    distanceToCursor: distance,
    lastAction: last.action,
    secondsSinceLastAction: last.at === null ? null : Math.round((Date.now() - last.at) / 1000),
    targets
  }
}
