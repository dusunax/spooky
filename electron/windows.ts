import { BrowserWindow, screen, type WebPreferences } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const secureWebPreferences: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

function loadPage(win: BrowserWindow, page: 'overlay' | 'demo'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${page}/index.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}/index.html`))
  }
}

function lockNavigation(win: BrowserWindow): void {
  // 원격 페이지 로드 금지 — 로컬 페이지만 허용 (PRD §9 보안)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
}

// 주 디스플레이 전체를 덮는 투명·클릭 통과 창 (PRD §4 FR-01)
export function createOverlayWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true)
  win.once('ready-to-show', () => win.showInactive())
  lockNavigation(win)
  loadPage(win, 'overlay')
  return win
}

// 폭파 대상 버튼이 있는 일반 창
export function createDemoWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 280,
    title: 'Ghosty — Demo',
    resizable: false,
    show: false,
    backgroundColor: '#14121a',
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences
  })
  win.once('ready-to-show', () => win.show())
  lockNavigation(win)
  loadPage(win, 'demo')
  return win
}
