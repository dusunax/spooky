import { useRef } from 'react'
import GhostSprite from './GhostSprite'
import { useFollow } from './useFollow'

function Overlay(): React.JSX.Element {
  const ghostRef = useRef<HTMLDivElement>(null)
  useFollow(ghostRef)

  return (
    <div ref={ghostRef} className="ghost" data-facing="right">
      <div className="shadow" />
      <div className="ghost-bob">
        <span className="status">Following cursor</span>
        <GhostSprite frame="idle" />
      </div>
    </div>
  )
}

export default Overlay
