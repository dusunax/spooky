// BOO와 유령 목소리가 함께 쓰는 AudioContext
let context: AudioContext | null = null

export function audioContext(): AudioContext {
  context ??= new AudioContext()
  return context
}
