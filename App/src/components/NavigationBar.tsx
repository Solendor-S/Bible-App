import { useEffect, useRef, useState } from 'react'
import { parsePassage, passagesToString } from '../lib/parsePassage'
import { APOCRYPHA_BOOKS, BOOK_MAP, EARLY_TEXTS } from '../data/books'
import { useOutsideClick } from './Modal'
import type { PassageRef } from '../types'

interface Props {
  passages: PassageRef[]
  onPassagesChange: (passages: PassageRef[]) => void
  onSearchOpen: () => void
  onSettingsOpen: () => void
  onHelpOpen?: () => void
  aiOpen: boolean
  onToggleAi: () => void
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
}

const BOOK_GROUPS: Record<'OT' | 'NT', { label: string; books: string[] }[]> = {
  OT: [
    { label: 'Torah', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
    { label: 'Historical', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
    { label: 'Wisdom & Poetry', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'] },
    { label: 'Major Prophets', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'] },
    { label: 'Minor Prophets', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  ],
  NT: [
    { label: 'Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
    { label: 'Acts', books: ['Acts'] },
    { label: 'Pauline Epistles', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'] },
    { label: 'General Epistles', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'] },
    { label: 'Prophecy', books: ['Revelation'] },
  ],
}

function groupBy<T extends { group?: string }>(list: T[]) {
  const m = new Map<string, T[]>()
  for (const b of list) (m.get(b.group ?? '') ?? m.set(b.group ?? '', []).get(b.group ?? '')!).push(b)
  return [...m.entries()]
}

type Tab = 'OT' | 'NT' | 'APOC' | 'EARLY'
const TABS: { key: Tab; label: string }[] = [
  { key: 'OT', label: 'Old Testament' }, { key: 'NT', label: 'New Testament' },
  { key: 'APOC', label: 'Apocrypha' }, { key: 'EARLY', label: 'Early Texts' },
]

function BookDropdown({ onSelect }: { onSelect: (passage: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('OT')
  const [filter, setFilter] = useState('')
  const [book, setBook] = useState<{ name: string; chapters: number; early?: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => { setOpen(false); setBook(null) })

  const pick = (p: string) => { onSelect(p); setOpen(false); setBook(null); setFilter('') }
  const q = filter.trim().toLowerCase()
  const match = (n: string) => !q || n.toLowerCase().includes(q)
  const bookBtn = (name: string, chapters: number, early = false, sub?: string) => (
    <button key={name} className="book-group-item" onClick={() => chapters > 1 ? setBook({ name, chapters, early }) : pick(`${name} 1`)} title={sub}>
      {name}{sub && <span className="book-group-sub">{sub}</span>}
    </button>
  )

  return (
    <div className="book-dropdown" ref={ref}>
      <button className="book-dropdown-btn" onClick={() => setOpen(o => !o)} title="Browse books">Books ▾</button>
      {open && (
        <div className="book-dropdown-menu">
          {book ? (
            <>
              <div className="book-picker-head">
                <button className="link-btn" onClick={() => setBook(null)}>‹ Books</button>
                <span className="book-picker-title">{book.name}</span>
                <button className="link-btn" onClick={() => pick(book.early ? `${book.name} 0` : book.name)}>Introduction</button>
              </div>
              <div className="chapter-grid">
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map(c => (
                  <button key={c} className="chapter-cell" onClick={() => pick(`${book.name} ${c}`)}>{c}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="book-tabs">
                {TABS.map(t => <button key={t.key} className={`chip${tab === t.key ? ' chip--active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
              </div>
              <input className="book-filter" placeholder="Search books…" value={filter} onChange={e => setFilter(e.target.value)} autoFocus spellCheck={false} />
              {(tab === 'OT' || tab === 'NT') && BOOK_GROUPS[tab].map(g => {
                const books = g.books.filter(match)
                return books.length ? (
                  <div key={g.label} className="book-group">
                    <div className="book-group-label">{g.label}</div>
                    <div className="book-group-items">{books.map(b => bookBtn(b, BOOK_MAP[b].chapters))}</div>
                  </div>
                ) : null
              })}
              {tab === 'APOC' && groupBy(APOCRYPHA_BOOKS.filter(b => match(b.name))).map(([g, books]) => (
                <div key={g} className="book-group">
                  <div className="book-group-label">{g}</div>
                  <div className="book-group-items">{books.map(b => bookBtn(b.name, b.chapters))}</div>
                </div>
              ))}
              {tab === 'EARLY' && groupBy(EARLY_TEXTS.filter(b => match(b.name))).map(([g, books]) => (
                <div key={g} className="book-group">
                  <div className="book-group-label">{g}</div>
                  <div className="book-group-items">{books.map(b => bookBtn(b.name, b.chapters, true, b.date))}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function NavigationBar({ passages, onPassagesChange, onSearchOpen, onSettingsOpen, onHelpOpen, aiOpen, onToggleAi, canBack, canForward, onBack, onForward }: Props) {
  const [inputValue, setInputValue] = useState(passagesToString(passages))
  useEffect(() => { setInputValue(passagesToString(passages)) }, [passages])

  function go(text: string) {
    const parsed = parsePassage(text)
    if (parsed.length > 0) onPassagesChange(parsed)
  }

  return (
    <div className="nav-bar">
      <div className="nav-left">
        <div className="nav-history-btns">
          <button className="nav-hist-btn" onClick={onBack} disabled={!canBack} title="Back (Alt+←)">‹</button>
          <button className="nav-hist-btn" onClick={onForward} disabled={!canForward} title="Forward (Alt+→)">›</button>
        </div>
        <div className="nav-passage-input">
          <input
            className="nav-passage-field"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go(inputValue)}
            placeholder="e.g. John 3:16; Romans 8:28; Didache 1"
            spellCheck={false}
          />
          <button className="nav-go-btn" onClick={() => go(inputValue)}>Go</button>
          <BookDropdown onSelect={go} />
        </div>
      </div>

      <div className="nav-title">Bible Study</div>

      <div className="nav-actions">
        <button className={`nav-ai-btn ${aiOpen ? 'nav-ai-btn-active' : ''}`} onClick={onToggleAi} title="AI Scholar (Bible & Church Fathers)">Scholar</button>
        <button className="nav-search-btn" onClick={onSearchOpen} title="Search (Ctrl+F)">Search</button>
        {onHelpOpen && <button className="nav-icon-btn" onClick={onHelpOpen} title="Show the tour">?</button>}
        <button className="nav-icon-btn" onClick={onSettingsOpen} title="Settings (Ctrl+,)">⚙</button>
      </div>
    </div>
  )
}
