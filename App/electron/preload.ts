import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bibleApi', {
  getBooks: () => ipcRenderer.invoke('bible:getBooks'),
  getChapters: (book: string) => ipcRenderer.invoke('bible:getChapters', book),
  getVerses: (book: string, chapter: number) => ipcRenderer.invoke('bible:getVerses', book, chapter),
  getCrossRefs: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('bible:getCrossRefs', book, chapter, verse),
  getCommentary: (book: string, chapter: number, verse: number) =>
    ipcRenderer.invoke('commentary:getForVerse', book, chapter, verse),
  search: (query: string) => ipcRenderer.invoke('search:query', query),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
})

contextBridge.exposeInMainWorld('chatApi', {
  getSessions: () => ipcRenderer.invoke('chat:getSessions'),
  saveSession: (session: any) => ipcRenderer.invoke('chat:saveSession', session),
  loadSession: (id: string) => ipcRenderer.invoke('chat:loadSession', id),
  deleteSession: (id: string) => ipcRenderer.invoke('chat:deleteSession', id),
  searchCommentary: (query: string) => ipcRenderer.invoke('commentary:search', query),
  searchCommentaryByFather: (name: string) => ipcRenderer.invoke('commentary:searchByFather', name)
})
