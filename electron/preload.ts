import { contextBridge } from 'electron'

// Keep the bridge minimal; native capabilities are added here only when needed.
contextBridge.exposeInMainWorld('dardar', {
  platform: process.platform,
})
