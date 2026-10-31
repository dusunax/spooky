import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { MAIN_TO_RENDERER, RENDERER_TO_MAIN, type GhostBridge } from '../src/shared/ipc'

const inbound = new Set<string>(MAIN_TO_RENDERER)
const outbound = new Set<string>(RENDERER_TO_MAIN)

const bridge: GhostBridge = {
  on(channel, listener) {
    if (!inbound.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`)
    const handler = (_event: IpcRendererEvent, payload: unknown): void =>
      listener(payload as Parameters<typeof listener>[0])
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  send(channel, payload) {
    if (!outbound.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`)
    ipcRenderer.send(channel, payload)
  }
}

contextBridge.exposeInMainWorld('ghost', bridge)
