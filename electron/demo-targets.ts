import type { BrowserWindow } from 'electron'
import type { DemoTarget } from '../src/shared/ipc'

// 데모 창이 보고한 버튼을 화면 좌표와 이어 준다 (PRD §4 FR-05 좌표 계약).
// 폭파 가능한 대상 = 데모 창이 보이고, 버튼이 복구 중이 아니고, 유령이 있는 디스플레이 안에 있는 것.
export type DemoTargets = {
  update: (targets: DemoTarget[]) => void
  eligible: () => { id: string; label: string }[]
  approachPoint: (id: string) => { x: number; y: number } | null
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
    eligible() {
      return targets
        .filter((t) => !t.disabled && t.rect.width > 0)
        .filter((t) => {
          const center = screenCenter(t)
          return center !== null && onOverlayDisplay(center)
        })
        .map(({ id, label }) => ({ id, label }))
    },
    approachPoint(id) {
      const target = targets.find((t) => t.id === id)
      const overlay = getOverlay()
      const center = target && screenCenter(target)
      if (!center || !overlay || overlay.isDestroyed()) return null
      const b = overlay.getBounds()
      return { x: center.x - b.x, y: center.y - b.y - HOVER_ABOVE }
    }
  }
}
