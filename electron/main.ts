import { app, ipcMain, systemPreferences, type BrowserWindow, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDemoWindow, createOverlayWindow } from './windows'
import { createTray } from './tray'
import { startCursorPolling, type CursorPolling } from './cursor'
import {
  createMischief,
  DEFAULT_MISCHIEF_CONFIG,
  type DecideResult,
  type Mischief
} from './mischief'
import { createDecider } from './ai/decide'
import { buildContext } from './ai/context'
import { createOllamaEngine } from './ai/engines/ollama'
import { loadSettings, saveSettings } from './settings'
import { createDemoTargets } from './demo-targets'
import { createScreenButtons, type ScreenButton } from './screen-buttons'
import { synthesizeGhostVoice } from './voice'
import { spokenText } from './spoken-text'
import type { BooPatternId } from '../src/shared/boo-patterns'
import type { Decision, DemoTarget, GhostSettings } from '../src/shared/ipc'

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
const SCREEN_TARGET_ID = 'screen-target'
// 디버깅: SPOOKY_DEBUG_SCREEN_TARGET=1 → 데모 창 제외, 화면 요소를 찾으면 항상 폭파
const VOICE_SAMPLES = ['Invite collaborators', '협업자 초대']
let voiceSample = 0
const DEBUG_SCREEN_TARGET = process.env['SPOOKY_DEBUG_SCREEN_TARGET'] === '1'
let screenTarget: ScreenButton | null = null // 마지막 판단 때 읽은 커서 근처 외부 요소

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
          ...(await probeScreenTarget())
        ]
      }),
    // 외부 앱 버튼 글씨는 로컬 모델에만 넘기고 로그에는 남기지 않는다 (PRD OQ-8)
    onRecord: (record) => {
      const targets = record.context.targets.map((t) =>
        t.id === SCREEN_TARGET_ID ? { ...t, label: '[on-screen element]' } : t
      )
      console.info(
        '[spooky] decision',
        JSON.stringify({ ...record, context: { ...record.context, targets } })
      )
    }
  })

  // 설정이 켜져 있고 권한이 있으면 반경 120px 안에서 커서에 가장 가까운 요소 하나를 대상 후보로 더한다
  async function probeScreenTarget(): Promise<{ id: string; label: string }[]> {
    screenTarget = null
    const point = cursor?.latest()
    if (!settings.screenButtons || !point || !overlay || overlay.isDestroyed()) return []
    const result = await screenButtons.probe({
      x: point.x + point.origin.x,
      y: point.y + point.origin.y
    })
    // 상태와 버튼 종류만 남긴다 — 글씨는 로그에 쓰지 않는다
    console.info(
      '[spooky] screen probe',
      result.status,
      result.status === 'found'
        ? `${result.button.kind} ${result.button.role} in ${result.button.app}`
        : result.status === 'none'
          ? JSON.stringify(result.miss ?? {})
          : '',
      'ms' in result && result.ms !== undefined ? `${result.ms}ms` : ''
    )
    if (result.status !== 'found') return []
    // 모델에 넘기는 라벨과 유령이 읽는 글씨를 같은 길이(6단어·40자, 단어 경계)로 맞춘다
    const hit = { ...result.button, label: spokenText(result.button.label) }
    screenTarget = hit
    const where = hit.app ? `${hit.kind} in ${hit.app}` : hit.kind
    return [{ id: SCREEN_TARGET_ID, label: `${hit.label} (${where})` }]
  }

  // 디버깅용: 화면 요소를 찾으면 모델을 거치지 않고 항상 그것을 폭파한다 (source: 'debug').
  // 못 찾으면 평소처럼 모델에 묻는다
  async function decideScreenFirst(signal: AbortSignal): Promise<DecideResult> {
    const targets = await probeScreenTarget()
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
    onAction: (decision) => runAction(decision),
    config: { chargeMs: chargeMsFromEnv() }
  })
  engine.health().then((health) => {
    console.info(`[spooky] engine ${engine.label}: ${health}`)
    if (health !== 'ok') mischief?.setOffline(health)
  })
  ipcMain.on('ghost:boo-ended', () => mischief?.finishAction())

  // EXPLODE: 유령이 버튼으로 날아가고(최대 1.5초) → 폭파 → 연출이 끝나면 쿨다운
  //  - 데모 창 버튼: 데모 창이 실제로 부순다
  //  - 외부 앱 요소(버튼·입력칸·글씨·아이콘): 오버레이에 폭발만 그린다. 그 요소는 그대로다 (PRD OQ-8)
  const APPROACH_LIMIT_MS = 1500
  const HOVER_ABOVE = 40
  const VOICE_GRACE_MS = 500
  type Pending =
    | { kind: 'demo'; id: string; timer: ReturnType<typeof setTimeout> }
    | {
        kind: 'screen'
        spot: { x: number; y: number; width: number; height: number }
        voice: Promise<Uint8Array | null>
        timer: ReturnType<typeof setTimeout>
      }
  let pendingExplode: Pending | null = null
  const explodeNow = (): void => {
    if (!pendingExplode) return
    clearTimeout(pendingExplode.timer)
    const pending = pendingExplode
    pendingExplode = null
    if (pending.kind === 'screen') {
      // 목소리는 날아가는 동안 만들어 둔다. 늦어지면 조금만 기다리고 목소리 없이 터뜨린다.
      // 오버레이가 폭발과 목소리를 동시에 시작하고, 둘 다 끝나면 ghost:screen-done으로 알린다
      const voiceOrNothing = Promise.race([
        pending.voice,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), VOICE_GRACE_MS))
      ])
      voiceOrNothing.then((voice) =>
        sendToOverlay('ghost:screen-explode', { ...pending.spot, voice })
      )
    } else if (demo && !demo.isDestroyed()) {
      demo.webContents.send('demo:explode', { id: pending.id })
    } else {
      mischief?.finishAction()
    }
  }
  const screenCenter = (button: ScreenButton): { x: number; y: number } | null => {
    if (!overlay || overlay.isDestroyed()) return null
    const b = overlay.getBounds()
    return {
      x: button.frame.x + button.frame.width / 2 - b.x,
      y: button.frame.y + button.frame.height / 2 - b.y
    }
  }
  const runAction = ({ action }: Decision): void => {
    if (action.type !== 'EXPLODE') return // BOO는 오버레이가 재생하고 ghost:boo-ended로 알린다
    const timer = setTimeout(explodeNow, APPROACH_LIMIT_MS)
    if (action.targetId === SCREEN_TARGET_ID) {
      const center = screenTarget && screenCenter(screenTarget)
      if (!center) {
        clearTimeout(timer)
        mischief?.finishAction()
        return
      }
      sendToOverlay('ghost:approach', { x: center.x, y: center.y - HOVER_ABOVE })
      const { width, height } = screenTarget!.frame
      pendingExplode = {
        kind: 'screen',
        spot: { ...center, width, height },
        voice: settings.muted ? Promise.resolve(null) : synthesizeGhostVoice(screenTarget!.label),
        timer
      }
      return
    }
    const point = demoTargets.approachPoint(action.targetId)
    if (!point) {
      clearTimeout(timer)
      mischief?.finishAction() // 그 사이 데모 창이 닫히거나 옮겨졌다
      return
    }
    sendToOverlay('ghost:approach', point)
    pendingExplode = { kind: 'demo', id: action.targetId, timer }
  }
  ipcMain.on('ghost:arrived', explodeNow)
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
