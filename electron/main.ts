import { app, ipcMain, type BrowserWindow, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDemoWindow, createOverlayWindow } from './windows'
import { createTray } from './tray'
import { startCursorPolling } from './cursor'
import { createMischief, DEFAULT_MISCHIEF_CONFIG, type Mischief } from './mischief'

let overlay: BrowserWindow | null = null
let demo: BrowserWindow | null = null
let tray: Tray | null = null
let stopCursor: (() => void) | null = null
let mischief: Mischief | null = null

function showDemo(): void {
  if (demo && !demo.isDestroyed()) {
    demo.show()
    demo.focus()
    return
  }
  demo = createDemoWindow()
  demo.on('closed', () => (demo = null))
}

// 데모 촬영용: SPOOKY_CHARGE_SECONDS=8 npm run dev
function chargeMsFromEnv(): number {
  const seconds = Number(process.env['SPOOKY_CHARGE_SECONDS'])
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_MISCHIEF_CONFIG.chargeMs
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.dusuna.spooky')
  app.dock?.hide()

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  overlay = createOverlayWindow()
  stopCursor = startCursorPolling(overlay)

  mischief = createMischief({
    // 4단계에서 Ollama 결정 엔진으로 교체한다. 그 전까지는 정직하게 AI offline.
    decide: async () => ({ ok: false, reason: 'offline' }),
    onState: (state) => {
      if (overlay && !overlay.isDestroyed()) overlay.webContents.send('ghost:state', state)
    },
    onAction: (decision) => console.info('[spooky] action', decision),
    config: { chargeMs: chargeMsFromEnv() }
  })
  ipcMain.on('ghost:boo-ended', () => mischief?.finishAction())

  showDemo()
  tray = createTray({
    showDemo,
    togglePause: () => {
      if (!mischief) return
      if (mischief.isPaused()) mischief.resume()
      else mischief.pause()
    },
    isPaused: () => mischief?.isPaused() ?? false
  })
})

// 데모 창을 닫아도 유령은 남는다. 종료는 트레이 Quit으로만.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  stopCursor?.()
  mischief?.dispose()
  tray?.destroy()
  overlay?.destroy()
})
