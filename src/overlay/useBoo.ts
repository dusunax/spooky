import { useEffect, useRef } from 'react'
import { playBoo, previewBoo } from '../audio/boo'
import type { GhostSettings, GhostState } from '../shared/ipc'

// ACTING(BOO)이 들어오면 한 번 울리고, 끝나면 main에 알려 쿨다운으로 넘긴다
export function useBoo(
  { mischief, decision, actionId }: GhostState,
  settings: GhostSettings
): void {
  const played = useRef(0)
  const settingsRef = useRef(settings)

  // 설정을 바꿔도 이미 울리는 BOO를 다시 재생하지 않도록 ref로 읽는다
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (mischief !== 'ACTING' || decision?.action.type !== 'BOO') return
    if (played.current === actionId) return
    played.current = actionId
    playBoo(decision.action.intensity, {
      muted: settingsRef.current.muted,
      patterns: settingsRef.current.booPatterns
    }).then(() => window.ghost.send('ghost:boo-ended', {}))
  }, [mischief, decision, actionId])

  // 트레이에서 패턴을 켜면 미리 들려준다
  useEffect(
    () => window.ghost.on('ghost:preview-boo', ({ pattern }) => void previewBoo(pattern)),
    []
  )
}
