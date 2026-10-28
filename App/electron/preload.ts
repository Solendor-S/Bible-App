import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  sql: (which: 'bible' | 'user', method: string, sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('sql', which, method, sql, params),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  setTitleBarColors: (color: string, symbolColor: string) =>
    ipcRenderer.invoke('app:setTitleBarColors', color, symbolColor),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getReleases: () => ipcRenderer.invoke('app:getReleases'),
  launchUpdater: () => ipcRenderer.invoke('app:launchUpdater'),
  onUpdateAvailable: (cb: (info: { current: string; latest: string }) => void) =>
    ipcRenderer.on('app:updateAvailable', (_e, info) => cb(info)),
  ensureOllama: () => ipcRenderer.invoke('ollama:ensureRunning'),
  getChatSessions: () => ipcRenderer.invoke('chat:getSessions'),
  saveChatSession: (session: unknown) => ipcRenderer.invoke('chat:saveSession', session),
  loadChatSession: (id: string) => ipcRenderer.invoke('chat:loadSession', id),
})
