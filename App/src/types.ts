// Core types — shared with the Android app (Patristica src/types/index.ts), plus desktop extras below.

export interface BibleVerse {
  book: string
  chapter: number
  verse: number
  text: string
}

export interface SelectedVerse {
  book: string
  chapter: number
  verse: number
}

export interface Footnote {
  verse: number
  marker: string
  word_index: number
  content: string
}

export interface BsbFootnote {
  verse: number
  word_index: number
  word: string
  footnote: string
}

export interface ElxxNote {
  verse: number
  word_index: number
  note: string
}

export interface Book {
  name: string
  chapters: number
  testament: 'OT' | 'NT' | 'APOC' | 'EARLY'
  group?: string
}

export interface SearchResult {
  book: string
  chapter: number
  verse: number
  text: string
}

export interface Bookmark {
  book: string
  chapter: number
  verse: number
  createdAt: number
  position: number
}

export interface Highlight {
  book: string
  chapter: number
  verse: number
  color: string
  createdAt: number
}

export interface Note {
  id: number
  notebookId: number
  book: string
  chapter: number
  verse: number
  text: string
  updatedAt: number
}

export interface CrossRef {
  ref_book: string
  ref_chapter: number
  ref_verse: number
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

export interface TextualVariant {
  id: number
  testament: 'ot' | 'nt'
  word_ref: string
  main_type: string
  main_english: string
  main_hebrew: string
  variant_source: string
  variant_source_label: string
  variant_english: string
  variant_hebrew: string
  description: string
}

// ── Desktop extras ────────────────────────────────────────────────

export interface PassageRef {
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
  raw: string
  bookOnly?: boolean
  /** Which reader corpus the passage belongs to; undefined = canonical Bible. */
  kind?: 'apocrypha' | 'early'
}

export interface Notebook {
  id: number
  name: string
  createdAt: number
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

export interface ResolvedCitation {
  hasDbMatch: boolean
  url?: string
  aiSuggested?: boolean
}

export interface NavesTopic {
  id: number
  name: string
  refCount: number
}

export interface NavesRef {
  book: string
  chapter: number
  verse: number
  text: string | null
  cross_count?: number
}

export interface Release {
  tag: string
  name: string
  date: string
  body: string
}

declare global {
  interface Window {
    api: {
      sql(which: 'bible' | 'user', method: string, sql: string, params?: unknown[]): Promise<any>
      openExternal(url: string): Promise<void>
      setTitleBarColors(color: string, symbolColor: string): Promise<void>
      getVersion(): Promise<string>
      getReleases(): Promise<Release[]>
      launchUpdater(): Promise<void>
      onUpdateAvailable(cb: (info: { current: string; latest: string }) => void): void
      ensureOllama(): Promise<{ success: boolean; alreadyRunning?: boolean; error?: string }>
      getChatSessions(): Promise<ChatSession[]>
      saveChatSession(session: ChatSession): Promise<void>
      loadChatSession(id: string): Promise<ChatSession | null>
    }
  }
}
