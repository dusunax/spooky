/// <reference types="vite/client" />

import type { GhostBridge } from './shared/ipc'

declare global {
  interface Window {
    ghost: GhostBridge
  }
}
