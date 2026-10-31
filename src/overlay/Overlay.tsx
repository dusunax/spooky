import { Fragment, useRef } from 'react'
import GhostSprite from './GhostSprite'
import MischiefGauge from './MischiefGauge'
import { useFollow } from './useFollow'
import { useGhostState } from './useGhostState'
import { useSettings } from './useSettings'
import { useBoo } from './useBoo'
import { useScreenExplosions } from './useScreenExplosions'
import Explosion from '../effects/Explosion'

// 긴 문단 같은 큰 요소는 그을음이 화면을 덮지 않게 크기를 묶는다
const SCORCH_MAX = { width: 360, height: 120 }

function scorchStyle(boom: {
  x: number
  y: number
  width: number
  height: number
}): React.CSSProperties {
  const width = Math.min(boom.width, SCORCH_MAX.width)
  const height = Math.min(boom.height, SCORCH_MAX.height)
  return { left: boom.x - width / 2, top: boom.y - height / 2, width, height }
}

function Overlay(): React.JSX.Element {
  const ghostRef = useRef<HTMLDivElement>(null)
  const ghostState = useGhostState()
  useFollow(ghostRef, ghostState.mischief === 'ACTING')
  const settings = useSettings()
  useBoo(ghostState, settings)
  const { mischief, gauge, statusText, decision } = ghostState
  const screenBooms = useScreenExplosions()
  const booing = mischief === 'ACTING' && decision?.action.type === 'BOO'

  return (
    <>
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
      {screenBooms.map((boom) => (
        <Fragment key={boom.key}>
          {/* 버튼 위에 덧그린 그을음 — 실제 버튼은 그대로다 */}
          <div className="scorch" style={scorchStyle(boom)} />
          <Explosion x={boom.x} y={boom.y} large />
        </Fragment>
      ))}
    </>
  )
}

export default Overlay
