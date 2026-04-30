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
  verses: Array<{ book: string; chapter: number; verse: number; text: string }>
  commentary: Array<{ book: string; chapter: number; verse: number; father_name: string; text: string }>
  totalVerses: number
  totalCommentary: number
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
  bookOnly?: boolean
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

export interface HistoricalEntry {
  id: number
  source_key: string
  title: string
  category: 'ancient_author' | 'archaeology' | 'manuscript' | 'inscription'
  author: string
  date_desc: string
  location: string
  description: string
  significance: string
  citation: string
  testament: 'ot' | 'nt'
  sort_year: number
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

export interface ApocryphaBook {
  id: number
  book: string
  book_order: number
  group_label: string
  chapter_count: number
}

export interface ApocryphaVerse {
  verse: number
  text: string
}

export interface CommentarySearchResult extends CommentaryEntry {
  book: string
  chapter: number
  verse: number
}

export interface Notebook {
  id: string
  name: string
  createdAt: number
}

export interface Note {
  id: string
  notebookId: string
  book: string
  chapter: number
  verse: number
  verseText: string
  noteText: string
  createdAt: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  book: string
  chapter: number
  verse: number
  verseText: string
  createdAt: number
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
}

export interface Highlight {
  book: string
  chapter: number
  verse: number
  color: string
  text: string | null
}

declare global {
  interface Window {
    translationsApi: {
      getList(): Promise<string[]>
      getVerses(translation: string, book: string, chapter: number): Promise<BibleVerse[]>
    }
    bookmarksApi: {
      getAll(): Promise<Bookmark[]>
      add(bookmark: Bookmark): Promise<void>
      remove(book: string, chapter: number, verse: number): Promise<void>
    }
    highlightApi: {
      get(book: string, chapter: number): Promise<Array<{ verse: number; color: string }>>
      set(book: string, chapter: number, verse: number, color: string): Promise<void>
      clear(book: string, chapter: number, verse: number): Promise<void>
      getAll(translation?: string): Promise<Highlight[]>
    }
    notesApi: {
      getNotebooks(): Promise<Notebook[]>
      saveNotebook(notebook: Notebook): Promise<void>
      deleteNotebook(id: string): Promise<void>
      getNotes(notebookId: string): Promise<Note[]>
      saveNote(note: Note): Promise<void>
      deleteNote(id: string): Promise<void>
    }
    navesApi: {
      getForVerse(book: string, chapter: number, verse: number): Promise<NavesTopic[]>
      getTopicRefs(topicId: number, translation?: string): Promise<NavesRef[]>
      search(query: string): Promise<NavesTopic[]>
    }
    bibleApi: {
      getBooks(): Promise<Book[]>
      getChapters(book: string): Promise<number[]>
      getVerses(book: string, chapter: number): Promise<BibleVerse[]>
      getCrossRefs(book: string, chapter: number, verse: number, translation?: string): Promise<CrossRef[]>
      getCrossRefsFull(book: string, chapter: number, verse: number, translation?: string): Promise<CrossRef[]>
      getGreekWords(book: string, chapter: number, verse: number): Promise<GreekWord[]>
      getHebrewWords(book: string, chapter: number, verse: number): Promise<HebrewWord[]>
      getStrongsEntry(type: string, num: string): Promise<StrongsEntry | null>
      getCommentary(book: string, chapter: number, verse: number): Promise<CommentaryEntry[]>
      getJosephusForVerse(book: string, chapter: number, verse: number): Promise<JosephusEntry[]>
      getHistoricalForVerse(book: string, chapter: number, verse: number): Promise<HistoricalEntry[]>
      getHistoricalAll(): Promise<HistoricalEntry[]>
      search(params: { query: string; tab?: string; book?: string; father?: string; offset?: number; limit?: number; translation?: string }): Promise<SearchResult>
      getFathers(): Promise<string[]>
      concordance(word: string, translation?: string): Promise<{ total: number; results: Array<{ book: string; chapter: number; verse: number; text: string }> }>
      openExternal(url: string): Promise<void>
      launchUpdater(): Promise<void>
      getReleases(): Promise<{ tag: string; name: string; date: string; body: string }[]>
      onUpdateAvailable(cb: (info: { current: string; latest: string }) => void): void
      ensureOllama(): Promise<{ success: boolean; alreadyRunning?: boolean; error?: string }>
    }
    apocryphaApi: {
      getBooks(): Promise<ApocryphaBook[]>
      getChapters(book: string): Promise<number[]>
      getVerses(book: string, chapter: number): Promise<ApocryphaVerse[]>
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
