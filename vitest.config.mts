import { defineConfig } from 'vitest/config'

// Electron 없이 도는 순수 로직만 테스트한다 (main 프로세스의 상태 머신·AI 검증·문자열 처리)
export default defineConfig({
  test: {
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node'
  }
})
