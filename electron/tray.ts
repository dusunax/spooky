import { Menu, Tray, app, nativeImage } from 'electron'
import icon from '../resources/icon.png?asset'

type TrayActions = {
  showDemo: () => void
}

// MIN: Show Demo Window · Quit. Pause/Mute는 상태 머신과 함께 추가 (PRD §4 FR-08)
export function createTray({ showDemo }: TrayActions): Tray {
  const image = nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  const tray = new Tray(image)
  tray.setToolTip('Ghosty')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Demo Window', click: showDemo },
      { type: 'separator' },
      { label: 'Quit Ghosty', accelerator: 'Command+Q', click: () => app.quit() }
    ])
  )
  return tray
}
