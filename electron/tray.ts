import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions } from 'electron'
// resources/ 안의 파일은 경로만 참조된다 — 옆의 trayTemplate@2x.png도 macOS가 함께 고른다
import trayIcon from '../resources/trayTemplate.png?asset'
import { BOO_PATTERNS, type BooPatternId } from '../src/shared/boo-patterns'
import type { GhostSettings } from '../src/shared/ipc'

type TrayActions = {
  showDemo: () => void
  rebuildDemo: () => void
  testVoice: () => void
  togglePause: () => void
  isPaused: () => boolean
  getSettings: () => GhostSettings
  toggleMute: () => void
  toggleBooPattern: (id: BooPatternId) => void
  screenButtons: () => { available: boolean; enabled: boolean; trusted: boolean }
  toggleScreenButtons: () => void
}

// 트레이가 설정 메뉴를 겸한다 (PRD §8.3): Pause · Mute · BOO Sounds · Show Demo · Rebuild · Quit
export function createTray(actions: TrayActions): { tray: Tray; render: () => void } {
  // 'Template' 이미지 — 메뉴바 밝기·다크 모드에 맞춰 macOS가 색을 바꾼다 (scripts/make-icons.py)
  const image = nativeImage.createFromPath(trayIcon)
  image.setTemplateImage(true)
  const tray = new Tray(image)
  tray.setToolTip('Spooky')

  // 메뉴 항목을 누를 때마다 다시 그려 체크 상태·라벨을 최신으로 맞춘다
  const withRender = (fn: () => void) => () => {
    fn()
    render()
  }

  const render = (): void => {
    const { muted, booPatterns } = actions.getSettings()
    const booSounds: MenuItemConstructorOptions[] = BOO_PATTERNS.map((pattern) => ({
      label: pattern.label,
      type: 'checkbox',
      checked: booPatterns.includes(pattern.id),
      // 마지막 하나는 끌 수 없다
      enabled: !(booPatterns.length === 1 && booPatterns[0] === pattern.id),
      click: withRender(() => actions.toggleBooPattern(pattern.id))
    }))

    const screen = actions.screenButtons()
    const screenItem: MenuItemConstructorOptions = {
      label: !screen.available
        ? 'React to On-Screen Buttons (helper not built)'
        : screen.enabled && !screen.trusted
          ? 'React to On-Screen Buttons — allow in Accessibility'
          : 'React to On-Screen Buttons',
      type: 'checkbox',
      checked: screen.enabled,
      enabled: screen.available,
      click: withRender(actions.toggleScreenButtons)
    }

    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: actions.isPaused() ? 'Resume' : 'Pause', click: withRender(actions.togglePause) },
        { label: muted ? 'Unmute' : 'Mute', click: withRender(actions.toggleMute) },
        {
          label: 'BOO Sounds',
          submenu: [
            { label: 'Random among checked · checking one plays it', enabled: false },
            { type: 'separator' },
            ...booSounds
          ]
        },
        screenItem,
        { type: 'separator' },
        { label: 'Show Demo Window', click: actions.showDemo },
        { label: 'Rebuild Demo Buttons', click: actions.rebuildDemo },
        { label: 'Test Ghost Voice', click: actions.testVoice },
        { type: 'separator' },
        { label: 'Quit Spooky', accelerator: 'Command+Q', click: () => app.quit() }
      ])
    )
  }

  render()
  return { tray, render }
}
