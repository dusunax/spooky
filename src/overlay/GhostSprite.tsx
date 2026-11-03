import PixelArt from './PixelArt'
import { GHOST_FRAMES, HEAD_ICONS } from '../sprites/ghost'
import type { Expression } from '../sprites/expression'

function GhostSprite({ face, icon }: Expression): React.JSX.Element {
  return (
    <>
      <PixelArt rows={GHOST_FRAMES[face]} className="sprite" />
      {icon && (
        <PixelArt key={icon} rows={HEAD_ICONS[icon]} className={`head-icon head-icon--${icon}`} />
      )}
    </>
  )
}

export default GhostSprite
