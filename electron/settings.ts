import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { z } from 'zod'
import { BOO_PATTERN_IDS } from '../src/shared/boo-patterns'
import type { GhostSettings } from '../src/shared/ipc'

// 재실행해도 유지되는 사용자 설정 — ~/Library/Application Support/spooky/settings.json
const SettingsSchema = z.object({
  muted: z.boolean(),
  booPatterns: z.array(z.enum(BOO_PATTERN_IDS)).min(1),
  screenButtons: z.boolean().default(false) // 이전 버전 설정 파일에는 없다
})

export const DEFAULT_SETTINGS: GhostSettings = {
  muted: false,
  booPatterns: [...BOO_PATTERN_IDS],
  screenButtons: false
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// 파일이 없거나 깨졌으면 기본값으로 시작한다
export function loadSettings(): GhostSettings {
  try {
    const parsed = SettingsSchema.safeParse(JSON.parse(readFileSync(settingsPath(), 'utf8')))
    return parsed.success
      ? { ...parsed.data, booPatterns: [...new Set(parsed.data.booPatterns)] }
      : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: GhostSettings): void {
  try {
    mkdirSync(dirname(settingsPath()), { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
  } catch (error) {
    console.warn('[spooky] failed to save settings', error)
  }
}
