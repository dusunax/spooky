type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }

// 점에서 사각형까지의 거리(px, 정수). 안에 있으면 0 — native/ax-probe.swift의 distance와 같은 계산
export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return Math.round(Math.hypot(dx, dy))
}
