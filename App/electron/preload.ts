import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bibleApi', {
  getBooks: () => ipcRenderer.invoke('bible:getBooks'),
  getChapters: (book: string) => ipcRenderer.invoke('bible:getChapters', book),
  getVerses: (book: string, chapter: number) => ipcRenderer.invoke('bible:getVerses', book, chapter),
  getCrossRefs: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('bible:getCrossRefs', book, chapter, verse),
  getCrossRefsFull: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('bible:getCrossRefsFull', book, chapter, verse),
  getGreekWords: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('bible:getGreekWords', book, chapter, verse),
  getHebrewWords: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('bible:getHebrewWords', book, chapter, verse),
  getStrongsEntry: (type: string, num: string) =>
    ipcRenderer.invoke('bible:getStrongsEntry', type, num),
  getCommentary: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('commentary:getForVerse', book, chapter, verse),
  getJosephusForVerse: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('josephus:getForVerse', book, chapter, verse),
  search: (query: string) => ipcRenderer.invoke('search:query', query),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  launchUpdater: () => ipcRenderer.invoke('app:launchUpdater'),
  getReleases: () => ipcRenderer.invoke('app:getReleases'),
  onUpdateAvailable: (cb: (info: { current: string; latest: string }) => void) =>
    ipcRenderer.on('app:updateAvailable', (_e, info) => cb(info)),
  ensureOllama: () => ipcRenderer.invoke('ollama:ensureRunning')
})

contextBridge.exposeInMainWorld('chatApi', {
  getSessions: () => ipcRenderer.invoke('chat:getSessions'),
  saveSession: (session: any) => ipcRenderer.invoke('chat:saveSession', session),
  loadSession: (id: string) => ipcRenderer.invoke('chat:loadSession', id),
  deleteSession: (id: string) => ipcRenderer.invoke('chat:deleteSession', id),
  searchCommentary: (query: string) => ipcRenderer.invoke('commentary:search', query),
  searchCommentaryByFather: (name: string) => ipcRenderer.invoke('commentary:searchByFather', name),
  searchCommentaryByFatherAndVerse: (name: string, book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('commentary:searchByFatherAndVerse', name, book, chapter, verse)
})
