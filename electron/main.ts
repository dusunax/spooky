import { app, ipcMain, type BrowserWindow, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDemoWindow, createOverlayWindow } from './windows'
import { createTray } from './tray'
import { startCursorPolling, type CursorPolling } from './cursor'
import { createMischief, DEFAULT_MISCHIEF_CONFIG, type Mischief } from './mischief'
import { createDecider } from './ai/decide'
import { buildContext } from './ai/context'
import { createOllamaEngine } from './ai/engines/ollama'

let overlay: BrowserWindow | null = null
let demo: BrowserWindow | null = null
let tray: Tray | null = null
let cursor: CursorPolling | null = null
let ghostPosition: { x: number; y: number } | null = null
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
  cursor = startCursorPolling(overlay)
  ipcMain.on(
    'ghost:position',
    (_, position: { x: number; y: number }) => (ghostPosition = position)
  )

  // 무료·오픈 웨이트 로컬 엔진만 (OQ-4). 다른 엔진은 engines/에 추가하고 여기서 고른다.
  const engine = createOllamaEngine(process.env['SPOOKY_MODEL'] || undefined)
  const decide = createDecider({
    engine,
    getContext: (last) =>
      buildContext({
        cursor: cursor?.latest() ?? null,
        ghost: ghostPosition,
        last,
        targets: [] // 6단계에서 데모 창이 보고한 버튼으로 채운다
      }),
    onRecord: (record) => console.info('[spooky] decision', JSON.stringify(record))
  })

  mischief = createMischief({
    decide,
    onState: (state) => {
      if (overlay && !overlay.isDestroyed()) overlay.webContents.send('ghost:state', state)
    },
    onAction: () => {}, // BOO·EXPLODE 실행은 5·6단계에서 연결
    config: { chargeMs: chargeMsFromEnv() }
  })
  engine.health().then((health) => {
    console.info(`[spooky] engine ${engine.label}: ${health}`)
    if (health !== 'ok') mischief?.setOffline(health)
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
  cursor?.stop()
  mischief?.dispose()
  tray?.destroy()
  overlay?.destroy()
})
