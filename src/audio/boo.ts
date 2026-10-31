// "우우우~" — 오디오 파일 없이 Web Audio로 합성한다 (PRD §4 FR-06, 라이선스 걱정 없음).
// 매번 같은 소리면 금방 질려서, 설정에서 켠 패턴 중 하나를 랜덤으로 고른다. 직전 패턴은 피한다.

import type { BooPatternId } from '../shared/boo-patterns'
import { audioContext } from './context'

const MASTER_VOLUME = 0.3 // 기본 볼륨 제한 (PRD §9 사용성)

// at·length는 전체 길이에 대한 비율, from·to는 Hz
type Note = { at: number; length: number; from: number; to: number }

type BooPattern = {
  seconds: number // intensity 0일 때 길이. intensity 1이면 1.5배
  wave: OscillatorType
  notes: Note[]
  vibrato: { rate: number; depth: number }
  tremolo?: { rate: number; depth: number } // 0~1, 소리 크기 떨림
}

const PATTERNS: Record<BooPatternId, BooPattern> = {
  wail: {
    // 우우우~ 길게 내려가는 울음
    seconds: 1.2,
    wave: 'triangle',
    notes: [{ at: 0, length: 1, from: 520, to: 300 }],
    vibrato: { rate: 5.5, depth: 18 }
  },
  question: {
    // 우우~? 끝이 올라간다
    seconds: 1.0,
    wave: 'triangle',
    notes: [{ at: 0, length: 1, from: 320, to: 560 }],
    vibrato: { rate: 6, depth: 14 }
  },
  stutter: {
    // 우, 우, 우우~ 끊어서 세 번
    seconds: 1.1,
    wave: 'triangle',
    notes: [
      { at: 0, length: 0.2, from: 560, to: 520 },
      { at: 0.28, length: 0.2, from: 500, to: 460 },
      { at: 0.56, length: 0.44, from: 460, to: 330 }
    ],
    vibrato: { rate: 7, depth: 10 }
  },
  moan: {
    // 우우우… 낮고 느린 신음
    seconds: 1.5,
    wave: 'sine',
    notes: [{ at: 0, length: 1, from: 260, to: 190 }],
    vibrato: { rate: 3.5, depth: 12 },
    tremolo: { rate: 4, depth: 0.5 }
  },
  warble: {
    // 우워워워~ 크게 흔들리는 소리
    seconds: 1.1,
    wave: 'triangle',
    notes: [{ at: 0, length: 1, from: 440, to: 380 }],
    vibrato: { rate: 9, depth: 45 }
  }
}

let lastPattern: BooPatternId | null = null

function pickPattern(allowed: BooPatternId[]): BooPatternId {
  const pool = allowed.length > 0 ? allowed : (Object.keys(PATTERNS) as BooPatternId[])
  const candidates = pool.length > 1 ? pool.filter((id) => id !== lastPattern) : pool
  const id = candidates[Math.floor(Math.random() * candidates.length)]
  lastPattern = id
  return id
}

type PlayOptions = { muted: boolean; patterns: BooPatternId[] }

// intensity 0~1에 비례해 길고 크게. 끝나면 resolve — muted면 소리 없이 같은 시간만 기다린다.
export function playBoo(intensity: number, { muted, patterns }: PlayOptions): Promise<void> {
  return play(PATTERNS[pickPattern(patterns)], intensity, muted)
}

// 설정에서 패턴을 켰을 때 미리 들려준다
export function previewBoo(id: BooPatternId): Promise<void> {
  return play(PATTERNS[id], 0.5, false)
}

function play(pattern: BooPattern, intensity: number, muted: boolean): Promise<void> {
  const duration = pattern.seconds * (1 + 0.5 * intensity)
  if (muted) return new Promise((resolve) => setTimeout(resolve, duration * 1000))

  const ctx = audioContext()
  const now = ctx.currentTime
  const end = now + duration
  const peak = MASTER_VOLUME * (0.4 + 0.6 * intensity)

  const voice = ctx.createOscillator()
  voice.type = pattern.wave

  const vibrato = ctx.createOscillator()
  const vibratoDepth = ctx.createGain()
  vibrato.frequency.value = pattern.vibrato.rate
  vibratoDepth.gain.value = pattern.vibrato.depth
  vibrato.connect(vibratoDepth).connect(voice.frequency)

  // 날카로운 배음을 깎아 둥글게
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1400

  // 음표마다 피치를 미끄러뜨리고, 음표 사이는 소리를 끈다
  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0.0001, now)
  for (const note of pattern.notes) {
    const start = now + note.at * duration
    const stop = start + note.length * duration
    const attack = Math.min(0.12, (stop - start) / 3)
    voice.frequency.setValueAtTime(note.from, start)
    voice.frequency.exponentialRampToValueAtTime(note.to, stop)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack)
    envelope.gain.setValueAtTime(peak, start + (stop - start) * 0.6)
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop)
  }

  const output = ctx.createGain()
  const nodes: AudioNode[] = [voice, vibrato, vibratoDepth, tone, envelope, output]
  const sources: OscillatorNode[] = [voice, vibrato]

  if (pattern.tremolo) {
    const tremolo = ctx.createOscillator()
    const tremoloDepth = ctx.createGain()
    tremolo.frequency.value = pattern.tremolo.rate
    tremoloDepth.gain.value = pattern.tremolo.depth / 2
    output.gain.value = 1 - pattern.tremolo.depth / 2
    tremolo.connect(tremoloDepth).connect(output.gain)
    nodes.push(tremolo, tremoloDepth)
    sources.push(tremolo)
  }

  voice.connect(tone).connect(envelope).connect(output).connect(ctx.destination)

  return new Promise((resolve) => {
    voice.onended = () => {
      nodes.forEach((node) => node.disconnect())
      resolve()
    }
    sources.forEach((source) => {
      source.start(now)
      source.stop(end)
    })
  })
}
