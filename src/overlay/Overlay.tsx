import { useRef } from 'react'
import GhostSprite from './GhostSprite'
import MischiefGauge from './MischiefGauge'
import { useFollow } from './useFollow'
import { useGhostState } from './useGhostState'
import { useSettings } from './useSettings'
import { useBoo } from './useBoo'

function Overlay(): React.JSX.Element {
  const ghostRef = useRef<HTMLDivElement>(null)
  const ghostState = useGhostState()
  useFollow(ghostRef, ghostState.mischief === 'ACTING')
  const settings = useSettings()
  useBoo(ghostState, settings)
  const { mischief, gauge, statusText, decision } = ghostState
  const booing = mischief === 'ACTING' && decision?.action.type === 'BOO'

  return (
    <div
      ref={ghostRef}
      className="ghost"
      data-facing="right"
      data-mischief={mischief}
      data-action={mischief === 'ACTING' ? decision?.action.type : undefined}
    >
      <div className="shadow" />
      <div className="ghost-bob">
        <div className="hud">
          <span className="status">{statusText}</span>
          <MischiefGauge gauge={gauge} />
        </div>
        <GhostSprite frame={booing ? 'boo' : 'idle'} />
      </div>
    </div>
  )
}

export default Overlay
