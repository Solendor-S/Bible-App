import React, { useState, useEffect, useRef } from 'react'
import { parsePassage, passagesToString } from '../lib/parsePassage'
import type { PassageRef } from '../types'

interface Props {
  passages: PassageRef[]
  onPassagesChange: (passages: PassageRef[]) => void
  onSearchOpen: () => void
  onChangelogOpen: () => void
  aiOpen: boolean
  onToggleAi: () => void
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
}

const BOOK_GROUPS: { label: string; books: string[] }[] = [
  { label: 'Torah', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  { label: 'Historical', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
  { label: 'Wisdom & Poetry', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'] },
  { label: 'Major Prophets', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'] },
  { label: 'Minor Prophets', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  { label: 'Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  { label: 'Acts', books: ['Acts'] },
  { label: 'Pauline Epistles', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'] },
  { label: 'General Epistles', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'] },
  { label: 'Prophecy', books: ['Revelation'] },
]

function BookDropdown({ onSelect }: { onSelect: (book: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="book-dropdown" ref={ref}>
      <button
        className="book-dropdown-btn"
        onClick={() => setOpen(o => !o)}
        title="Browse books"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        Books
      </button>
      {open && (
        <div className="book-dropdown-menu">
          {BOOK_GROUPS.map(group => (
            <div key={group.label} className="book-group">
              <div className="book-group-label">{group.label}</div>
              <div className="book-group-items">
                {group.books.map(book => (
                  <button
                    key={book}
                    className="book-group-item"
                    onClick={() => { onSelect(book); setOpen(false) }}
                  >
                    {book}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function NavigationBar({ passages, onPassagesChange, onSearchOpen, onChangelogOpen, aiOpen, onToggleAi, canBack, canForward, onBack, onForward }: Props) {
  const [inputValue, setInputValue] = useState(passagesToString(passages))

  useEffect(() => {
    setInputValue(passagesToString(passages))
  }, [passages])

  function submit() {
    const parsed = parsePassage(inputValue)
    if (parsed.length > 0) onPassagesChange(parsed)
  }

  function handleBookSelect(book: string) {
    const parsed = parsePassage(`${book} 1`)
    if (parsed.length > 0) onPassagesChange(parsed)
  }

  return (
    <div className="nav-bar">
      <div className="nav-left">
        <div className="nav-history-btns">
          <button className="nav-hist-btn" onClick={onBack} disabled={!canBack} title="Back (Alt+←)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="nav-hist-btn" onClick={onForward} disabled={!canForward} title="Forward (Alt+→)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="nav-passage-input">
          <input
            className="nav-passage-field"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. John 3:16; Romans 8:28"
            spellCheck={false}
          />
          <button className="nav-go-btn" onClick={submit}>Go</button>
          <BookDropdown onSelect={handleBookSelect} />
        </div>
      </div>

      <div className="nav-title">Bible Study</div>

      <div className="nav-actions">
        <button
          className={`nav-ai-btn ${aiOpen ? 'nav-ai-btn-active' : ''}`}
          onClick={onToggleAi}
          title="AI Scholar (Bible & Church Fathers)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 21h6M10 17v1M14 17v1" />
          </svg>
          Scholar
        </button>
        <button className="nav-changelog-btn" onClick={onChangelogOpen} title="Changelog">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Changelog
        </button>
        <button className="nav-search-btn" onClick={onSearchOpen} title="Search (Ctrl+F)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>
    </div>
  )
}
