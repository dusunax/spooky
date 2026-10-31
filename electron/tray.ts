import { Menu, Tray, app, nativeImage } from 'electron'
import icon from '../resources/icon.png?asset'

type TrayActions = {
  showDemo: () => void
  togglePause: () => void
  isPaused: () => boolean
}

// MIN: Pause/Resume · Show Demo Window · Quit. Mute는 BOO 사운드와 함께 추가 (PRD §4 FR-08)
export function createTray({ showDemo, togglePause, isPaused }: TrayActions): Tray {
  const image = nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  const tray = new Tray(image)
  tray.setToolTip('Spooky')

  const render = (): void => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: isPaused() ? 'Resume' : 'Pause',
          click: () => {
            togglePause()
            render()
          }
        },
        { label: 'Show Demo Window', click: showDemo },
        { type: 'separator' },
        { label: 'Quit Spooky', accelerator: 'Command+Q', click: () => app.quit() }
      ])
    )
  }

  render()
  return tray
}
