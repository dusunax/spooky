import { useCallback, useEffect, useRef, useState } from 'react'
import Explosion from '../effects/Explosion'
import type { DemoTarget } from '../shared/ipc'

// 폭파 대상 버튼 — 실제 동작 없음. 이 창 밖의 앱은 절대 건드리지 않는다 (PRD §4 FR-05).
// 한 번 폭파된 버튼은 돌아오지 않는다. Rebuild(이 창 또는 트레이)로만 되살린다.
const BUTTONS = [
  { id: 'btn-save', label: 'Save' },
  { id: 'btn-submit', label: 'Submit' },
  { id: 'btn-delete', label: 'Delete Everything' }
] as const
const INPUT = { id: 'input-note', label: 'Note input' } as const
const TARGETS = [...BUTTONS, INPUT]

const SHAKE_MS = 300
const BOOM_MS = 700 // 폭발 연출이 끝나면 main에 알려 쿨다운으로 넘긴다

type Phase = 'shake' | 'broken'
type Boom = { key: number; x: number; y: number }

function Demo(): React.JSX.Element {
  const elements = useRef(new Map<string, HTMLElement>())
  const [phases, setPhases] = useState<Record<string, Phase>>({})
  const [booms, setBooms] = useState<Boom[]>([])
  const phasesRef = useRef(phases)

  useEffect(() => {
    phasesRef.current = phases
  }, [phases])

  const report = useCallback(() => {
    const targets: DemoTarget[] = TARGETS.map(({ id, label }) => {
      const rect = elements.current.get(id)?.getBoundingClientRect()
      return {
        id,
        label,
        rect: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : { x: 0, y: 0, width: 0, height: 0 },
        disabled: phasesRef.current[id] !== undefined // 폭파 중이거나 이미 부서짐
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
      const element = elements.current.get(id)
      if (!element || phasesRef.current[id]) return

      setPhases((p) => ({ ...p, [id]: 'shake' }))
      later(SHAKE_MS, () => {
        const rect = element.getBoundingClientRect()
        const boom = { key: Date.now(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        setBooms((b) => [...b, boom])
        setPhases((p) => ({ ...p, [id]: 'broken' }))
        later(BOOM_MS, () => {
          setBooms((b) => b.filter((item) => item.key !== boom.key))
          window.ghost.send('demo:exploded', { id })
        })
      })
    })

    const unsubscribeReset = window.ghost.on('demo:reset', () => setPhases({}))

    return () => {
      unsubscribe()
      unsubscribeReset()
      timers.forEach(clearTimeout)
    }
  }, [])

  const track = (id: string, el: HTMLElement | null): void => {
    if (el) elements.current.set(id, el)
    else elements.current.delete(id)
  }

  const brokenCount = Object.values(phases).filter((phase) => phase === 'broken').length
  const allBroken = brokenCount === TARGETS.length

  return (
    <main className="demo">
      <p className="hint">
        {allBroken ? 'Everything is gone. Spooky is pleased.' : 'Spooky may haunt these buttons.'}
      </p>
      <div className="buttons">
        {BUTTONS.map((target) => (
          <button
            key={target.id}
            ref={(el) => track(target.id, el)}
            type="button"
            data-ghost-target={target.id}
            data-phase={phases[target.id]}
            disabled={phases[target.id] === 'broken'}
          >
            {target.label}
          </button>
        ))}
      </div>
      <input
        ref={(el) => track(INPUT.id, el)}
        className="note"
        type="text"
        placeholder="Leave a note for Spooky…"
        aria-label={INPUT.label}
        data-ghost-target={INPUT.id}
        data-phase={phases[INPUT.id]}
        disabled={phases[INPUT.id] === 'broken'}
      />
      {brokenCount > 0 && (
        <button type="button" className="rebuild" onClick={() => setPhases({})}>
          Rebuild {brokenCount === 1 ? '1 piece' : `${brokenCount} pieces`}
        </button>
      )}
      {booms.map((boom) => (
        <Explosion key={boom.key} x={boom.x} y={boom.y} />
      ))}
    </main>
  )
}

export default Demo
