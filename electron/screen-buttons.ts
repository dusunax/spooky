import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

// 커서 근처의 외부 앱 버튼·입력칸·글씨·아이콘 (PRD OQ-8). frame은 전역 화면 좌표(pt). 입력칸의 값은 오지 않는다
export type ScreenButton = {
  kind: 'button' | 'input' | 'text' | 'icon' // text = label·span 글씨, icon = svg·이미지
  role: string
  label: string
  app: string
  frame: { x: number; y: number; width: number; height: number }
}

export type ScreenButtons = {
  available: boolean
  trusted: () => Promise<boolean>
  promptTrust: () => Promise<boolean>
  probe: (point: { x: number; y: number }) => Promise<ProbeResult>
  dispose: () => void
}

type Miss = { reason: string; app?: string; roles?: string[] }
type Reply = { trusted?: boolean; hit?: ScreenButton | null; miss?: Miss | null; ms?: number }

// 'untrusted' = 손쉬운 사용 권한 없음, 'none' = 커서 근처에 버튼 없음, 'unavailable' = 도우미 응답 없음
export type ProbeResult =
  | { status: 'found'; button: ScreenButton; ms?: number }
  | { status: 'none'; miss?: Miss; ms?: number }
  | { status: 'untrusted' | 'unavailable' }

const REPLY_TIMEOUT_MS = 1500 // 반경 120px를 살피는 데 걸리는 시간 포함

function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', 'ax-probe')
    : join(app.getAppPath(), 'resources', 'bin', 'ax-probe')
}

// native/ax-probe와 한 줄 명령/한 줄 JSON으로 대화한다. 도우미가 없으면 기능만 꺼진다.
export function createScreenButtons(): ScreenButtons {
  const path = helperPath()
  if (process.platform !== 'darwin' || !existsSync(path)) {
    return {
      available: false,
      trusted: async () => false,
      promptTrust: async () => false,
      probe: async () => ({ status: 'unavailable' }),
      dispose: () => {}
    }
  }

  let child: ChildProcessWithoutNullStreams | null = null
  const waiting: ((reply: Reply) => void)[] = []

  const ensure = (): ChildProcessWithoutNullStreams => {
    if (child && child.exitCode === null) return child
    child = spawn(path, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    createInterface({ input: child.stdout }).on('line', (line) => {
      const resolve = waiting.shift()
      if (!resolve) return
      try {
        resolve(JSON.parse(line) as Reply)
      } catch {
        resolve({})
      }
    })
    child.on('exit', () => waiting.splice(0).forEach((resolve) => resolve({})))
    return child
  }

  const ask = (command: string): Promise<Reply> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        const index = waiting.indexOf(done)
        if (index >= 0) waiting.splice(index, 1)
        resolve({})
      }, REPLY_TIMEOUT_MS)
      const done = (reply: Reply): void => {
        clearTimeout(timer)
        resolve(reply)
      }
      waiting.push(done)
      ensure().stdin.write(`${command}\n`)
    })

  return {
    available: true,
    trusted: async () => (await ask('trust')).trusted === true,
    promptTrust: async () => (await ask('prompt')).trusted === true,
    probe: async ({ x, y }) => {
      const reply = await ask(`probe ${Math.round(x)} ${Math.round(y)}`)
      if (reply.trusted === undefined) return { status: 'unavailable' }
      if (!reply.trusted) return { status: 'untrusted' }
      return reply.hit
        ? { status: 'found', button: reply.hit, ms: reply.ms }
        : { status: 'none', miss: reply.miss ?? undefined, ms: reply.ms }
    },
    dispose: () => child?.kill()
  }
}
