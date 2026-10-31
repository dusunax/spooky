import { useEffect, useState } from 'react'
import type { GhostState } from '../shared/ipc'

const INITIAL: GhostState = {
  mischief: 'CHARGING',
  gauge: 0,
  statusText: 'Following cursor',
  decision: null
}

// main의 Mischief 상태를 구독한다. main은 값이 바뀔 때만 보낸다.
export function useGhostState(): GhostState {
  const [state, setState] = useState(INITIAL)
  useEffect(() => window.ghost.on('ghost:state', setState), [])
  return state
}
