import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updaterApi', {
  getInfo: () => ipcRenderer.invoke('update:getInfo'),
  apply: () => ipcRenderer.invoke('update:apply'),
  onProgress: (cb: (data: { line: string; type: string }) => void) => {
    ipcRenderer.on('update:progress', (_e, data) => cb(data))
  },
  removeProgressListeners: () => {
    ipcRenderer.removeAllListeners('update:progress')
  }
})
