import PixelArt from './PixelArt'
import { HEAD_ICONS } from '../sprites/ghost'
import { EARED_FRAMES, type EarStyle } from '../sprites/ears'
import type { Expression } from '../sprites/expression'

type Props = Expression & { ears: EarStyle }

function GhostSprite({ face, icon, ears }: Props): React.JSX.Element {
  return (
    <>
      <PixelArt
        rows={EARED_FRAMES[ears][face]}
        className={ears === 'none' ? 'sprite' : 'sprite sprite--eared'}
      />
      {icon && (
        <PixelArt key={icon} rows={HEAD_ICONS[icon]} className={`head-icon head-icon--${icon}`} />
      )}
    </>
  )
}

export default GhostSprite
