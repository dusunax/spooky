import { app, type BrowserWindow, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDemoWindow, createOverlayWindow } from './windows'
import { createTray } from './tray'
import { startCursorPolling } from './cursor'

let overlay: BrowserWindow | null = null
let demo: BrowserWindow | null = null
let tray: Tray | null = null
let stopCursor: (() => void) | null = null

function showDemo(): void {
  if (demo && !demo.isDestroyed()) {
    demo.show()
    demo.focus()
    return
  }
  demo = createDemoWindow()
  demo.on('closed', () => (demo = null))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.dusuna.spooky')
  app.dock?.hide()

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  overlay = createOverlayWindow()
  stopCursor = startCursorPolling(overlay)
  showDemo()
  tray = createTray({ showDemo })
})

// 데모 창을 닫아도 유령은 남는다. 종료는 트레이 Quit으로만.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  stopCursor?.()
  tray?.destroy()
  overlay?.destroy()
})
