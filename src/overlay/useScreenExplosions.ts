import { useEffect, useState } from 'react'
import { playGhostVoice } from '../audio/ghostVoice'

type Boom = { key: number; x: number; y: number; width: number; height: number }

const EFFECT_MS = 2600 // 폭발 ~1초 + 그을음이 서서히 사라질 때까지
const BOOM_MS = 1200

// 외부 앱 요소 위: 폭발·그을음과 동시에 그 글씨를 유령 목소리로 읽는다.
// 그 요소는 건드리지 않는다 (PRD OQ-8). Mute면 main이 목소리를 만들지 않는다
export function useScreenExplosions(): Boom[] {
  const [booms, setBooms] = useState<Boom[]>([])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const unsubscribe = window.ghost.on('ghost:screen-explode', ({ voice, ...spot }) => {
      const boom = { key: Date.now(), ...spot }
      setBooms((b) => [...b, boom])
      timers.push(setTimeout(() => setBooms((b) => b.filter((i) => i.key !== boom.key)), EFFECT_MS))

      // 폭발과 목소리가 둘 다 끝나면 쿨다운으로
      Promise.all([
        new Promise((resolve) => timers.push(setTimeout(resolve, BOOM_MS))),
        voice ? playGhostVoice(voice) : Promise.resolve()
      ]).then(() => window.ghost.send('ghost:screen-done', {}))
    })
    const unsubscribeVoice = window.ghost.on('ghost:play-voice', ({ voice }) => {
      void playGhostVoice(voice)
    })
    return () => {
      unsubscribe()
      unsubscribeVoice()
      timers.forEach(clearTimeout)
    }
  }, [])

  return booms
}
