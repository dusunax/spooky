import { useCallback, useEffect, useRef, useState } from 'react'
import Explosion from './Explosion'
import type { DemoTarget } from '../shared/ipc'

// 폭파 대상 버튼 — 실제 동작 없음. 이 창 밖의 앱은 절대 건드리지 않는다 (PRD §4 FR-05).
const TARGETS = [
  { id: 'btn-save', label: 'Save' },
  { id: 'btn-submit', label: 'Submit' },
  { id: 'btn-delete', label: 'Delete Everything' }
] as const

const SHAKE_MS = 300
const BOOM_MS = 700 // 폭발 연출이 끝나면 main에 알려 쿨다운으로 넘긴다
const RESTORE_MS = 3000 // 비활성화 후 복구까지 (PRD: 3초)

type Phase = 'shake' | 'broken'
type Boom = { key: number; x: number; y: number }

function Demo(): React.JSX.Element {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [phases, setPhases] = useState<Record<string, Phase>>({})
  const [booms, setBooms] = useState<Boom[]>([])
  const phasesRef = useRef(phases)

  useEffect(() => {
    phasesRef.current = phases
  }, [phases])

  const report = useCallback(() => {
    const targets: DemoTarget[] = TARGETS.map(({ id, label }) => {
      const rect = buttons.current.get(id)?.getBoundingClientRect()
      return {
        id,
        label,
        rect: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : { x: 0, y: 0, width: 0, height: 0 },
        disabled: phasesRef.current[id] !== undefined
      }
    })
    window.ghost.send('demo:targets', targets)
  }, [])

  // 위치·상태가 바뀔 때마다 main에 알린다 (창 이동은 main이 창 좌표로 보정)
  useEffect(() => {
    report()
  }, [phases, report])

  useEffect(() => {
    window.addEventListener('resize', report)
    return () => window.removeEventListener('resize', report)
  }, [report])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, fn: () => void): void => {
      timers.push(setTimeout(fn, ms))
    }

    const unsubscribe = window.ghost.on('demo:explode', ({ id }) => {
      const button = buttons.current.get(id)
      if (!button || phasesRef.current[id]) return

      setPhases((p) => ({ ...p, [id]: 'shake' }))
      later(SHAKE_MS, () => {
        const rect = button.getBoundingClientRect()
        const boom = { key: Date.now(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        setBooms((b) => [...b, boom])
        setPhases((p) => ({ ...p, [id]: 'broken' }))
        later(BOOM_MS, () => {
          setBooms((b) => b.filter((item) => item.key !== boom.key))
          window.ghost.send('demo:exploded', { id })
        })
        later(RESTORE_MS, () =>
          setPhases((p) => {
            const next = { ...p }
            delete next[id]
            return next
          })
        )
      })
    })

    // 창이 닫히면 복구 타이머도 함께 정리된다
    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <main className="demo">
      <p className="hint">Spooky may haunt these buttons.</p>
      <div className="buttons">
        {TARGETS.map((target) => (
          <button
            key={target.id}
            ref={(el) => {
              if (el) buttons.current.set(target.id, el)
              else buttons.current.delete(target.id)
            }}
            type="button"
            data-ghost-target={target.id}
            data-phase={phases[target.id]}
            disabled={phases[target.id] === 'broken'}
          >
            {target.label}
          </button>
        ))}
      </div>
      {booms.map((boom) => (
        <Explosion key={boom.key} x={boom.x} y={boom.y} />
      ))}
    </main>
  )
}

export default Demo
