import { SYSTEM_PROMPT, userPrompt } from '../prompt'
import { outputJsonSchema } from '../schema'
import { EngineUnavailableError, type DecisionEngine, type EngineHealth } from './types'

const BASE_URL = 'http://127.0.0.1:11434' // 로컬만 (PRD §9 보안)
const TIMEOUT_MS = 10_000

// 실측(2026-10-31, M 시리즈): qwen3:1.7b p50 586ms, 16/16 유효, BOO·EXPLODE 고르게 섞임
export const DEFAULT_OLLAMA_MODEL = 'qwen3:1.7b'

type ChatResponse = { message?: { content?: string }; error?: string }

export function createOllamaEngine(model = DEFAULT_OLLAMA_MODEL): DecisionEngine {
  return {
    id: 'ollama',
    kind: 'open-local',
    label: `ollama/${model}`,

    async health(): Promise<EngineHealth> {
      try {
        const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3_000) })
        if (!res.ok) return 'offline'
        const { models = [] } = (await res.json()) as { models?: { name: string }[] }
        return models.some((m) => m.name === model) ? 'ok' : 'model_missing'
      } catch {
        return 'offline'
      }
    },

    async decide(context, signal) {
      let res: Response
      try {
        res = await fetch(`${BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
          body: JSON.stringify({
            model,
            stream: false,
            think: false, // System 1 — 숙고 없이 바로 고른다
            format: outputJsonSchema(context),
            options: { temperature: 0.8 },
            keep_alive: '30m',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt(context) }
            ]
          })
        })
      } catch (error) {
        if (signal.aborted) throw error // 일시정지·종료로 취소된 것은 그대로 전달
        throw new EngineUnavailableError('offline') // 연결 거부·타임아웃
      }

      if (res.status === 404) throw new EngineUnavailableError('model_missing')
      if (!res.ok) throw new EngineUnavailableError('offline')
      const body = (await res.json()) as ChatResponse
      return { raw: body.message?.content ?? '' }
    }
  }
}
