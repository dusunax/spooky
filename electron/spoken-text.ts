// 유령이 읽고 모델에 넘길 화면 글씨의 길이 — 단어 중간에서 끊기지 않게 단어 경계로 자른다
export const SPOKEN_LIMIT = { maxWords: 4, maxChars: 30 }

export function spokenText(raw: string, limit = SPOKEN_LIMIT): string {
  const words = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const kept: string[] = []
  for (const word of words) {
    if (kept.length === limit.maxWords) break
    const next = kept.length ? `${kept.join(' ')} ${word}` : word
    if (next.length > limit.maxChars) {
      // 첫 단어 하나가 너무 길면 그 단어만 글자 수로 자른다
      if (kept.length === 0) kept.push(word.slice(0, limit.maxChars))
      break
    }
    kept.push(word)
  }
  return kept.join(' ')
}
