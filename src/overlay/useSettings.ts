import { useEffect, useState } from 'react'
import { BOO_PATTERN_IDS } from '../shared/boo-patterns'
import type { GhostSettings } from '../shared/ipc'

export function useSettings(): GhostSettings {
  const [settings, setSettings] = useState<GhostSettings>({
    muted: false,
    booPatterns: [...BOO_PATTERN_IDS],
    screenButtons: false,
    chargeSeconds: 20
  })
  useEffect(() => window.ghost.on('ghost:settings', setSettings), [])
  return settings
}
