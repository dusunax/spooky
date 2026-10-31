import type { DecisionContext } from '../schema'

export type EngineHealth = 'ok' | 'offline' | 'model_missing'

// 엔진이 모델에 닿지 못했을 때 던진다. 검증·폴백은 decide.ts가 맡는다.
export class EngineUnavailableError extends Error {
  constructor(readonly reason: 'offline' | 'model_missing') {
    super(reason)
  }
}

// 결정 엔진 계층 (PRD §7.5). 새 런타임은 이 인터페이스를 구현한 파일 하나로 붙인다.
export interface DecisionEngine {
  id: string
  kind: 'open-local' | 'hosted' // 제출 빌드는 open-local만
  label: string // 로그·디버그 표시용 (예: 'ollama/qwen3:1.7b')
  health(): Promise<EngineHealth>
  decide(context: DecisionContext, signal: AbortSignal): Promise<{ raw: string }>
}
