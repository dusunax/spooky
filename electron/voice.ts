import { app } from 'electron'
import { execFile } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'

// 화면 요소의 글씨(spoken-text.ts로 단어 경계에서 자른 것)를 macOS `say`로 WAV로 만든다 — 유령 효과는 오버레이가 Web Audio로 입힌다.
// 글씨는 셸을 거치지 않도록 임시 파일(-f)로 넘기고, 다 쓰면 바로 지운다.

const HANGUL = /[ㄱ-ㆎ가-힣]/
const SYNTH_TIMEOUT_MS = 3000
// 오버레이가 1.45배로 재생해 음을 높이므로, 들리는 속도가 분당 190단어가 되도록 미리 늦춘다
const HEARD_WORDS_PER_MINUTE = 190
const PLAYBACK_RATE = 1.45 // src/audio/ghostVoice.ts와 같은 값
const WORDS_PER_MINUTE = Math.round(HEARD_WORDS_PER_MINUTE / PLAYBACK_RATE)

function sayToFile(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/say', args, { timeout: SYNTH_TIMEOUT_MS }, (error) =>
      error ? reject(error) : resolve()
    )
  })
}

// 말끝을 올려 귀엽게: "Invite collaborators" → "Invite collaborators?" (끝의 . ! 는 ? 로)
function asQuestion(text: string): string {
  const line = text.trim().replace(/[.!。]+$/, '')
  return line && !line.endsWith('?') ? `${line}?` : line
}

// 실패하면 null — 목소리 없이 폭발만 한다
export async function synthesizeGhostVoice(text: string): Promise<Uint8Array | null> {
  const line = asQuestion(text)
  if (process.platform !== 'darwin' || !line) return null

  const dir = await mkdtemp(join(app.getPath('temp'), 'spooky-voice-'))
  try {
    const input = join(dir, 'line.txt')
    const output = join(dir, 'line.wav')
    await writeFile(input, line)
    // 귀엽게: 영어는 어린이 목소리 Junior, 한글은 Yuna
    const voice = HANGUL.test(line) ? 'Yuna' : 'Junior'
    await sayToFile([
      '-v',
      voice,
      '-r',
      String(WORDS_PER_MINUTE),
      '-f',
      input,
      '--file-format=WAVE',
      '--data-format=LEI16@22050',
      '-o',
      output
    ])
    return new Uint8Array(await readFile(output))
  } catch (error) {
    console.warn('[spooky] voice synthesis failed', (error as Error).message)
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
