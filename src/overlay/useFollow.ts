import { useEffect, useRef, type RefObject } from 'react'
import type { CursorUpdate } from '../shared/ipc'

// PRD §4 FR-02 기본값
const FOLLOW = {
  lerp: 0.08, // 30FPS 기준 계수 — 실제 프레임 간격에 맞춰 보정한다
  frameMs: 1000 / 30,
  distance: 60, // 커서에서 떨어질 거리
  stopThreshold: 8,
  personalSpace: 48, // 유령 중심이 이 반경 안으로 들어오면 밀어낸다 (시야 가림 방지)
  size: 64,
  topReserve: 54, // 머리 위 상태 패널(텍스트·게이지) + 동물귀 공간
  approachLerp: 0.2, // 버튼으로 날아갈 때는 더 빠르게
  arriveThreshold: 20
}

const DIAGONAL = FOLLOW.distance / Math.SQRT2

// 유령 중심 좌표를 rAF로 커서 쪽으로 보간하고, ref 요소의 transform을 직접 갱신한다.
// 매 프레임 React 리렌더를 피하기 위해 상태 대신 ref를 쓴다.
// EXPLODE 중에는 main이 준 버튼 위치로 날아가(APPROACH) 머문다(HOLD) — PRD §5.1 이동 레이어.
export function useFollow(ghostRef: RefObject<HTMLElement | null>, acting: boolean): void {
  const approach = useRef<{ x: number; y: number; arrived: boolean } | null>(null)

  // 행동이 끝나면 다시 커서를 따라간다
  useEffect(() => {
    if (!acting) approach.current = null
  }, [acting])

  useEffect(() => {
    const unsubscribe = window.ghost.on('ghost:approach', (point) => {
      approach.current = { ...point, arrived: false }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const el = ghostRef.current
    if (!el) return

    const half = FOLLOW.size / 2
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let cursor: CursorUpdate | null = null
    let side: 1 | -1 = -1 // 커서 기준 유령이 있을 쪽 (-1 왼쪽)
    let facing: 1 | -1 = 1

    const unsubscribe = window.ghost.on('cursor:update', (next) => {
      if (cursor && (next.origin.x !== cursor.origin.x || next.origin.y !== cursor.origin.y)) {
        // 디스플레이가 바뀌면 유령의 전역 위치를 유지한 채 새 로컬 좌표로 옮긴다 → 화면 가장자리에서 넘어오듯 보인다
        pos.x += cursor.origin.x - next.origin.x
        pos.y += cursor.origin.y - next.origin.y
      } else if (cursor) {
        const dx = next.x - cursor.x
        // 커서가 움직이는 반대편에서 따라간다
        if (Math.abs(dx) > 2) side = dx > 0 ? -1 : 1
      }
      cursor = next
    })

    let raf = 0
    let last = performance.now()
    let lastReport = 0

    const tick = (now: number): void => {
      const dt = Math.min(now - last, 100)
      last = now

      const target = approach.current
      if (target) {
        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const alpha = 1 - Math.pow(1 - FOLLOW.approachLerp, dt / FOLLOW.frameMs)
        pos.x += dx * alpha
        pos.y += dy * alpha
        if (Math.abs(dx * alpha) > 0.3) facing = dx > 0 ? 1 : -1
        if (!target.arrived && Math.hypot(dx, dy) < FOLLOW.arriveThreshold) {
          target.arrived = true
          window.ghost.send('ghost:arrived', {})
        }
      } else if (cursor) {
        const tx = cursor.x + side * DIAGONAL
        const ty = cursor.y - DIAGONAL
        const dx = tx - pos.x
        const dy = ty - pos.y

        if (Math.hypot(dx, dy) > FOLLOW.stopThreshold) {
          const alpha = 1 - Math.pow(1 - FOLLOW.lerp, dt / FOLLOW.frameMs)
          pos.x += dx * alpha
          pos.y += dy * alpha
          if (Math.abs(dx * alpha) > 0.3) facing = dx > 0 ? 1 : -1
        }

        const awayX = pos.x - cursor.x
        const awayY = pos.y - cursor.y
        const gap = Math.hypot(awayX, awayY)
        if (gap < FOLLOW.personalSpace) {
          if (gap === 0) {
            pos.y = cursor.y - FOLLOW.personalSpace
          } else {
            pos.x = cursor.x + (awayX / gap) * FOLLOW.personalSpace
            pos.y = cursor.y + (awayY / gap) * FOLLOW.personalSpace
          }
        }
      }

      pos.x = Math.min(Math.max(pos.x, half), window.innerWidth - half)
      pos.y = Math.min(Math.max(pos.y, half + FOLLOW.topReserve), window.innerHeight - half)

      el.style.transform = `translate3d(${pos.x - half}px, ${pos.y - half}px, 0)`
      el.dataset.facing = facing === 1 ? 'right' : 'left'
      // AI 컨텍스트(커서와의 거리)용 — main에 4Hz로만 알린다
      if (now - lastReport > 250) {
        lastReport = now
        window.ghost.send('ghost:position', { x: Math.round(pos.x), y: Math.round(pos.y) })
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
    }
  }, [ghostRef])
}
