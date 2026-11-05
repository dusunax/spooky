import { app, ipcMain, systemPreferences, type BrowserWindow, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDemoWindow, createOverlayWindow } from './windows'
import { createTray } from './tray'
import { startCursorPolling, type CursorPolling } from './cursor'
import { createMischief, type DecideResult, type Mischief } from './mischief'
import { createDecider } from './ai/decide'
import { buildContext } from './ai/context'
import { createOllamaEngine } from './ai/engines/ollama'
import { loadSettings, saveSettings } from './settings'
import { createDemoTargets } from './demo-targets'
import { createScreenButtons } from './screen-buttons'
import { createScreenTarget, redactRecord, SCREEN_TARGET_ID } from './screen-target'
import { createExploder } from './explode'
import { synthesizeGhostVoice } from './voice'
import type { BooPatternId } from '../src/shared/boo-patterns'
import type { DemoTarget, GhostSettings } from '../src/shared/ipc'

let overlay: BrowserWindow | null = null
let demo: BrowserWindow | null = null
let tray: Tray | null = null
let cursor: CursorPolling | null = null
let ghostPosition: { x: number; y: number } | null = null
let settings: GhostSettings
let mischief: Mischief | null = null
const demoTargets = createDemoTargets(
  () => overlay,
  () => demo
)
const screenButtons = createScreenButtons()
const screenTarget = createScreenTarget({
  screenButtons,
  isEnabled: () => settings.screenButtons,
  cursorGlobal: () => {
    const point = cursor?.latest()
    return point ? { x: point.x + point.origin.x, y: point.y + point.origin.y } : null
  }
})
// 디버깅: SPOOKY_DEBUG_SCREEN_TARGET=1 → 데모 창 제외, 화면 요소를 찾으면 항상 폭파
const DEBUG_SCREEN_TARGET = process.env['SPOOKY_DEBUG_SCREEN_TARGET'] === '1'
// 트레이 Test Ghost Voice — 영어·한국어를 번갈아
const VOICE_SAMPLES = ['Invite collaborators', '협업자 초대']
let voiceSample = 0

function showDemo(): void {
  if (demo && !demo.isDestroyed()) {
    demo.show()
    demo.focus()
    return
  }
  demo = createDemoWindow()
  demo.on('closed', () => (demo = null))
}

// 장난 주기는 트레이 설정(chargeSeconds)을 따른다. 데모 촬영용으로 SPOOKY_CHARGE_SECONDS가 있으면 시작할 때만 그걸 쓴다
function initialChargeMs(saved: number): number {
  const seconds = Number(process.env['SPOOKY_CHARGE_SECONDS'])
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : saved) * 1000
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.dusuna.spooky')
  app.dock?.hide()

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  settings = loadSettings()
  overlay = createOverlayWindow()
  cursor = startCursorPolling(overlay)
  const sendToOverlay: BrowserWindow['webContents']['send'] = (channel, ...args) => {
    if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, ...args)
  }
  const updateSettings = (next: GhostSettings): void => {
    settings = next
    saveSettings(settings)
    sendToOverlay('ghost:settings', settings)
  }
  overlay.webContents.on('did-finish-load', () => sendToOverlay('ghost:settings', settings))
  ipcMain.on('demo:targets', (_, targets: DemoTarget[]) => demoTargets.update(targets))
  ipcMain.on(
    'ghost:position',
    (_, position: { x: number; y: number }) => (ghostPosition = position)
  )

  // 무료·오픈 웨이트 로컬 엔진만 (OQ-4). 다른 엔진은 engines/에 추가하고 여기서 고른다.
  const engine = createOllamaEngine(process.env['SPOOKY_MODEL'] || undefined)
  const decideWithModel = createDecider({
    engine,
    getContext: async (last) =>
      buildContext({
        cursor: cursor?.latest() ?? null,
        ghost: ghostPosition,
        last,
        targets: [
          ...(DEBUG_SCREEN_TARGET ? [] : demoTargets.eligible()),
          ...(await screenTarget.probe())
        ]
      }),
    // 외부 앱 요소 글씨는 로컬 모델에만 넘기고 로그에는 남기지 않는다 (PRD OQ-8)
    onRecord: (record) => console.info('[spooky] decision', JSON.stringify(redactRecord(record)))
  })

  // 디버깅용: 화면 요소를 찾으면 모델을 거치지 않고 항상 그것을 폭파한다 (source: 'debug').
  // 못 찾으면 평소처럼 모델에 묻는다
  async function decideScreenFirst(signal: AbortSignal): Promise<DecideResult> {
    const targets = await screenTarget.probe()
    if (targets.length === 0) return decideWithModel(signal)
    console.info('[spooky] debug: forcing EXPLODE on the on-screen element')
    return {
      ok: true,
      decision: { action: { type: 'EXPLODE', targetId: SCREEN_TARGET_ID }, source: 'debug' }
    }
  }

  mischief = createMischief({
    decide: DEBUG_SCREEN_TARGET ? decideScreenFirst : decideWithModel,
    onState: (state) => sendToOverlay('ghost:state', state),
    onAction: (decision) => exploder.run(decision),
    config: { chargeMs: initialChargeMs(settings.chargeSeconds) }
  })
  engine.health().then((health) => {
    console.info(`[spooky] engine ${engine.label}: ${health}`)
    if (health !== 'ok') mischief?.setOffline(health)
  })
  ipcMain.on('ghost:boo-ended', () => mischief?.finishAction())

  const exploder = createExploder({
    getOverlay: () => overlay,
    getDemo: () => demo,
    demoTargets,
    screenTarget,
    sendToOverlay,
    // 유령 목소리 — Mute면 만들지 않는다
    voiceFor: (text) =>
      settings.muted || !text ? Promise.resolve(null) : synthesizeGhostVoice(text),
    finish: () => mischief?.finishAction()
  })
  ipcMain.on('ghost:arrived', () => exploder.arrived())
  ipcMain.on('demo:exploded', () => mischief?.finishAction())
  ipcMain.on('ghost:screen-done', () => mischief?.finishAction())

  showDemo()
  let screenTrusted = false
  const refreshTrust = async (): Promise<void> => {
    const trusted = await screenButtons.trusted()
    if (trusted !== screenTrusted) {
      screenTrusted = trusted
      trayMenu?.render()
    }
  }
  // 설정이 켜진 채 시작했는데 권한이 없으면(재설치 등) 허용 창을 다시 띄운다
  screenButtons.trusted().then((trusted) => {
    // 본체와 도우미의 권한 판정이 다르면 도우미 쪽 귀속 문제다
    console.info(
      '[spooky] accessibility trusted — app:',
      systemPreferences.isTrustedAccessibilityClient(false),
      'helper:',
      trusted
    )
    if (settings.screenButtons && !trusted) screenButtons.promptTrust().then(() => refreshTrust())
    else refreshTrust()
  })
  // 시스템 설정에서 권한을 준 뒤 메뉴 표시가 따라오도록
  const trustTimer = setInterval(() => {
    if (settings.screenButtons) refreshTrust()
  }, 3000)
  app.on('before-quit', () => clearInterval(trustTimer))

  const trayMenu = createTray({
    showDemo,
    // 권한 없이 목소리만 들어 보기 — 실제와 같은 합성·효과 경로, 영어·한국어를 번갈아
    testVoice: () => {
      const line = VOICE_SAMPLES[voiceSample++ % VOICE_SAMPLES.length]
      synthesizeGhostVoice(line).then((voice) => {
        if (voice) sendToOverlay('ghost:play-voice', { voice })
      })
    },
    rebuildDemo: () => {
      if (demo && !demo.isDestroyed()) demo.webContents.send('demo:reset', {})
    },
    togglePause: () => {
      if (!mischief) return
      if (mischief.isPaused()) mischief.resume()
      else mischief.pause()
    },
    isPaused: () => mischief?.isPaused() ?? false,
    getSettings: () => settings,
    toggleMute: () => updateSettings({ ...settings, muted: !settings.muted }),
    setEars: (ears) => updateSettings({ ...settings, ears }),
    setChargeSeconds: (seconds: number) => {
      updateSettings({ ...settings, chargeSeconds: seconds })
      mischief?.setChargeMs(seconds * 1000)
    },
    toggleBooPattern: (id: BooPatternId) => {
      const enabled = settings.booPatterns.includes(id)
      // 최소 하나는 남긴다
      if (enabled && settings.booPatterns.length === 1) return
      updateSettings({
        ...settings,
        booPatterns: enabled
          ? settings.booPatterns.filter((p) => p !== id)
          : [...settings.booPatterns, id]
      })
      if (!enabled) sendToOverlay('ghost:preview-boo', { pattern: id })
    },
    screenButtons: () => ({
      available: screenButtons.available,
      enabled: settings.screenButtons,
      trusted: screenTrusted
    }),
    toggleScreenButtons: () => {
      const enabling = !settings.screenButtons
      updateSettings({ ...settings, screenButtons: enabling })
      // 켤 때 권한이 없으면 macOS 손쉬운 사용 허용 창을 띄운다
      if (enabling) screenButtons.promptTrust().then(() => refreshTrust())
    }
  })
  tray = trayMenu.tray
})

// 데모 창을 닫아도 유령은 남는다. 종료는 트레이 Quit으로만.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  cursor?.stop()
  screenButtons.dispose()
  mischief?.dispose()
  tray?.destroy()
  overlay?.destroy()
})
