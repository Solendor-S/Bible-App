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

export interface GreekWord {
  position: number
  greek: string
  translit: string
  strongs: string
  gloss: string | null
}

export interface HebrewWord {
  position: number
  hebrew: string
  translit: string
  strongs: string
  gloss: string | null
}

export interface StrongsEntry {
  number: string
  lemma: string
  translit: string
  pronunciation: string
  definition: string
  kjv_usage: string
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

export interface JosephusEntry {
  work: string
  book: number
  chapter: number
  section: number
  text: string
  ref: string
  note: string
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
      getCrossRefsFull(book: string, chapter: number, verse: number): Promise<CrossRef[]>
      getGreekWords(book: string, chapter: number, verse: number): Promise<GreekWord[]>
      getHebrewWords(book: string, chapter: number, verse: number): Promise<HebrewWord[]>
      getStrongsEntry(type: string, num: string): Promise<StrongsEntry | null>
      getCommentary(book: string, chapter: number, verse: number): Promise<CommentaryEntry[]>
      getJosephusForVerse(book: string, chapter: number, verse: number): Promise<JosephusEntry[]>
      search(query: string): Promise<SearchResult>
      openExternal(url: string): Promise<void>
      launchUpdater(): Promise<void>
      getReleases(): Promise<{ tag: string; name: string; date: string; body: string }[]>
      onUpdateAvailable(cb: (info: { current: string; latest: string }) => void): void
      ensureOllama(): Promise<{ success: boolean; alreadyRunning?: boolean; error?: string }>
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
