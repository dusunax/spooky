import type { GhostAction, MischiefState } from '../shared/ipc'
import type { GhostFrame, HeadIcon } from './ghost'

// 상태 → 표정·머리 위 아이콘 (PRD §5.3 표정 매핑, 레퍼런스 시트 기준)
export type Expression = { face: GhostFrame; icon: HeadIcon | null }

export const MISCHIEF_FACE_FROM = 80 // 게이지가 이만큼 차면 장난기 어린 얼굴

export function expressionFor(
  mischief: MischiefState,
  gauge: number,
  action: GhostAction['type'] | null
): Expression {
  switch (mischief) {
    case 'CHARGING':
      return { face: gauge >= MISCHIEF_FACE_FROM ? 'mischief' : 'idle', icon: null }
    case 'THINKING':
      return { face: 'thinking', icon: 'question' }
    case 'ACTING':
      return action === 'EXPLODE'
        ? { face: 'excited', icon: 'sparkle' }
        : { face: 'boo', icon: null }
    case 'COOLDOWN':
      return { face: 'sleepy', icon: 'z' }
    case 'AI_OFFLINE':
      return { face: 'sleepy', icon: 'zzz' }
    case 'PAUSED':
      return { face: 'idle', icon: null }
  }
}
