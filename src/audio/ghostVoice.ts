import { audioContext } from './context'

// `say`로 만든 목소리를 귀여운 유령처럼: 아주 높게 · 떨림 · 아주 약한 울림 (메아리는 두 번 말하는 것처럼 들려 뺐다)
const MASTER_VOLUME = 0.35
// 음을 아주 높게(약 6반음). 빨라지는 만큼 main이 `say` 속도를 낮춰 들리는 속도는 분당 190단어로 맞춘다
export const PLAYBACK_RATE = 1.45
const MAX_MS = 6000 // 안전장치 — 글씨는 main이 6단어·40자로 묶어 보내서 보통 3초 안쪽이다

let impulse: AudioBuffer | null = null

// 빈 방 울림 — 노이즈가 2초에 걸쳐 사라지는 임펄스를 직접 만든다
function reverbImpulse(ctx: AudioContext): AudioBuffer {
  if (impulse) return impulse
  const seconds = 2
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    }
  }
  impulse = buffer
  return buffer
}

// 재생이 끝나면(또는 MAX_MS) resolve. 디코딩에 실패하면 바로 resolve
export async function playGhostVoice(wav: Uint8Array): Promise<void> {
  const ctx = audioContext()
  let buffer: AudioBuffer
  try {
    // decodeAudioData가 원본을 떼어 가므로 복사본을 넘긴다
    buffer = await ctx.decodeAudioData(wav.slice().buffer)
  } catch {
    return
  }

  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = PLAYBACK_RATE

  // 떨림: 소리 크기를 초당 7번 살짝 출렁
  const tremolo = ctx.createGain()
  const tremoloLfo = ctx.createOscillator()
  const tremoloDepth = ctx.createGain()
  tremoloLfo.frequency.value = 7
  tremoloDepth.gain.value = 0.12
  tremolo.gain.value = 0.88
  tremoloLfo.connect(tremoloDepth).connect(tremolo.gain)

  const reverb = ctx.createConvolver()
  reverb.buffer = reverbImpulse(ctx)
  const reverbMix = ctx.createGain()
  reverbMix.gain.value = 0.05 // 거의 없게

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 4200

  const output = ctx.createGain()
  output.gain.value = MASTER_VOLUME

  source.connect(tone).connect(tremolo)
  tremolo.connect(output) // 원음
  tremolo.connect(reverb).connect(reverbMix).connect(output) // 울림
  output.connect(ctx.destination)

  const nodes: AudioNode[] = [
    source,
    tremolo,
    tremoloLfo,
    tremoloDepth,
    reverb,
    reverbMix,
    tone,
    output
  ]
  const tailSeconds = 0.3 // 울림이 잦아들 시간
  const playSeconds = Math.min(buffer.duration / PLAYBACK_RATE, MAX_MS / 1000)

  return new Promise((resolve) => {
    source.start(now)
    source.stop(now + playSeconds)
    tremoloLfo.start(now)
    tremoloLfo.stop(now + playSeconds + tailSeconds)
    // 울림 꼬리까지 기다렸다가 정리한다
    setTimeout(
      () => {
        nodes.forEach((node) => node.disconnect())
        resolve()
      },
      (playSeconds + tailSeconds) * 1000
    )
  })
}
