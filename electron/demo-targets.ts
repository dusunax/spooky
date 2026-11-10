import type { BrowserWindow } from 'electron'
import type { DemoTarget } from '../src/shared/ipc'
import { distanceToRect } from './distance'

// 데모 창이 보고한 버튼을 화면 좌표와 이어 준다 (PRD §4 FR-05 좌표 계약).
// 폭파 가능한 대상 = 데모 창이 보이고, 버튼이 복구 중이 아니고, 유령이 있는 디스플레이 안에 있는 것.
export type DemoTargets = {
  update: (targets: DemoTarget[]) => void
  // cursor는 전역 화면 좌표. distance는 커서에서 버튼까지 px (커서를 모르면 0)
  eligible: (
    cursor: { x: number; y: number } | null
  ) => { id: string; label: string; distance: number }[]
  approachPoint: (id: string) => { x: number; y: number } | null
  // 버튼 중심과 크기(오버레이 로컬) — 데모 창이 가려져 있어도 오버레이에 폭발을 그리기 위해
  spot: (id: string) => { x: number; y: number; width: number; height: number } | null
}

const HOVER_ABOVE = 40 // 유령이 버튼 바로 위에 뜨도록

export function createDemoTargets(
  getOverlay: () => BrowserWindow | null,
  getDemo: () => BrowserWindow | null
): DemoTargets {
  let targets: DemoTarget[] = []

  // 버튼 중심의 전역 화면 좌표. 창 이동은 여기서 매번 창 위치로 보정한다
  const screenCenter = (target: DemoTarget): { x: number; y: number } | null => {
    const demo = getDemo()
    if (!demo || demo.isDestroyed() || !demo.isVisible() || demo.isMinimized()) return null
    const content = demo.getContentBounds()
    return {
      x: content.x + target.rect.x + target.rect.width / 2,
      y: content.y + target.rect.y + target.rect.height / 2
    }
  }

  const onOverlayDisplay = (point: { x: number; y: number }): boolean => {
    const overlay = getOverlay()
    if (!overlay || overlay.isDestroyed()) return false
    const b = overlay.getBounds()
    return point.x >= b.x && point.x < b.x + b.width && point.y >= b.y && point.y < b.y + b.height
  }

  return {
    update(next) {
      targets = next
    },
    eligible(cursor) {
      return targets
        .filter((t) => !t.disabled && t.rect.width > 0)
        .flatMap((t) => {
          const center = screenCenter(t)
          if (!center || !onOverlayDisplay(center)) return []
          const rect = {
            x: center.x - t.rect.width / 2,
            y: center.y - t.rect.height / 2,
            width: t.rect.width,
            height: t.rect.height
          }
          return [{ id: t.id, label: t.label, distance: cursor ? distanceToRect(cursor, rect) : 0 }]
        })
    },
    approachPoint(id) {
      const target = targets.find((t) => t.id === id)
      const overlay = getOverlay()
      const center = target && screenCenter(target)
      if (!center || !overlay || overlay.isDestroyed()) return null
      const b = overlay.getBounds()
      return { x: center.x - b.x, y: center.y - b.y - HOVER_ABOVE }
    },
    spot(id) {
      const target = targets.find((t) => t.id === id)
      const overlay = getOverlay()
      const center = target && screenCenter(target)
      if (!target || !center || !overlay || overlay.isDestroyed()) return null
      const b = overlay.getBounds()
      return {
        x: center.x - b.x,
        y: center.y - b.y,
        width: target.rect.width,
        height: target.rect.height
      }
    }
  }
}
