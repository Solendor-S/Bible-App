export interface BibleVerse {
  verse: number
  text: string
}

export interface Book {
  book: string
  book_order: number
}

export interface CrossRef {
  to_book: string
  to_chapter: number
  to_verse: number
  text: string
}

export interface CommentaryEntry {
  id: number
  father_name: string
  father_era: string
  excerpt: string
  full_text: string
  source: string
  source_url: string
}

export interface SearchResult {
  verses: Array<{ book: string; chapter: number; verse: number; text: string; type: 'scripture' }>
  commentary: Array<{ book: string; chapter: number; verse: number; father_name: string; text: string; type: 'commentary' }>
}

export interface SelectedVerse {
  book: string
  chapter: number
  verse: number
}

export interface PassageRef {
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
  raw: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
}

export interface CommentarySearchResult extends CommentaryEntry {
  book: string
  chapter: number
  verse: number
}

declare global {
  interface Window {
    bibleApi: {
      getBooks(): Promise<Book[]>
      getChapters(book: string): Promise<number[]>
      getVerses(book: string, chapter: number): Promise<BibleVerse[]>
      getCrossRefs(book: string, chapter: number, verse: number): Promise<CrossRef[]>
      getCommentary(book: string, chapter: number, verse: number): Promise<CommentaryEntry[]>
      search(query: string): Promise<SearchResult>
      openExternal(url: string): Promise<void>
      launchUpdater(): Promise<void>
      onUpdateAvailable(cb: (info: { current: string; latest: string }) => void): void
    }
    chatApi: {
      getSessions(): Promise<ChatSession[]>
      saveSession(session: ChatSession): Promise<void>
      loadSession(id: string): Promise<ChatSession | null>
      deleteSession(id: string): Promise<void>
      searchCommentary(query: string): Promise<CommentarySearchResult[]>
      searchCommentaryByFather(name: string): Promise<CommentarySearchResult[]>
    }
  }
}
