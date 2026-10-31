import { screen, type BrowserWindow } from 'electron'
import type { CursorUpdate } from '../src/shared/ipc'

const POLL_MS = 1000 / 30
const SPEED_WINDOW_MS = 500

type Sample = { x: number; y: number; t: number }

// 전역 커서 좌표를 30Hz로 읽어 오버레이 로컬 좌표로 보낸다 (PRD §4 FR-02).
// getCursorScreenPoint는 macOS 손쉬운 사용 권한이 필요 없다.
// 커서가 다른 디스플레이로 넘어가면 오버레이 창도 그 디스플레이로 옮긴다.
export function startCursorPolling(overlay: BrowserWindow): () => void {
  const samples: Sample[] = []
  let displayId: number | null = null
  let origin = { x: 0, y: 0 }

  const timer = setInterval(() => {
    if (overlay.isDestroyed()) return
    const point = screen.getCursorScreenPoint()
    const now = Date.now()

    const display = screen.getDisplayNearestPoint(point)
    if (display.id !== displayId) {
      displayId = display.id
      origin = { x: display.bounds.x, y: display.bounds.y }
      overlay.setBounds(display.bounds)
    }

    samples.push({ ...point, t: now })
    while (now - samples[0].t > SPEED_WINDOW_MS) samples.shift()

    const oldest = samples[0]
    const elapsed = (now - oldest.t) / 1000
    const speed = elapsed > 0 ? Math.hypot(point.x - oldest.x, point.y - oldest.y) / elapsed : 0

    const update: CursorUpdate = {
      x: point.x - origin.x,
      y: point.y - origin.y,
      speed: Math.round(speed),
      origin
    }
    overlay.webContents.send('cursor:update', update)
  }, POLL_MS)

  return () => clearInterval(timer)
}
