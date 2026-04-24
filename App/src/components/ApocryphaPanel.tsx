import React, { useEffect, useState } from 'react'
import type { ApocryphaBook, ApocryphaVerse } from '../types'

const GROUP_ORDER = ['Deuterocanon', 'Broader Canon', 'Ethiopian Canon']

const GROUP_DESCRIPTION: Record<string, string> = {
  'Deuterocanon': 'Accepted by Catholic and most Orthodox churches. Present in the Septuagint (LXX) and included in the KJV Apocrypha (1611).',
  'Broader Canon': 'Accepted by Eastern Orthodox and Ethiopian Orthodox churches. Not in the Catholic canon.',
  'Ethiopian Canon': 'Unique to the Ethiopian Orthodox Tewahedo Church. Not in Western canons.',
}

function BookGrid({ books, onSelect }: { books: ApocryphaBook[]; onSelect: (book: ApocryphaBook) => void }) {
  const groups = GROUP_ORDER.map(g => ({ label: g, items: books.filter(b => b.group_label === g) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="apocrypha-browse">
      {groups.map(g => (
        <div key={g.label} className="apocrypha-group">
          <div className="apocrypha-group-header">
            <span className="apocrypha-group-label">{g.label}</span>
            <span className="apocrypha-group-desc">{GROUP_DESCRIPTION[g.label]}</span>
          </div>
          <div className="apocrypha-book-grid">
            {g.items.map(b => (
              <button key={b.book} className="apocrypha-book-card" onClick={() => onSelect(b)}>
                <span className="apocrypha-book-name">{b.book}</span>
                <span className="apocrypha-book-meta">{b.chapter_count} ch</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReadMode({ book, onBack }: { book: ApocryphaBook; onBack: () => void }) {
  const [chapter, setChapter] = useState(1)
  const [chapters, setChapters] = useState<number[]>([])
  const [verses, setVerses] = useState<ApocryphaVerse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.apocryphaApi.getChapters(book.book).then(chs => {
      setChapters(chs)
      setChapter(chs[0] ?? 1)
    })
  }, [book.book])

  useEffect(() => {
    setLoading(true)
    setVerses([])
    window.apocryphaApi.getVerses(book.book, chapter)
      .then(v => { setVerses(v); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book.book, chapter])

  return (
    <div className="apocrypha-read">
      <div className="apocrypha-read-topbar">
        <button className="apocrypha-back-btn" onClick={onBack}>← All Books</button>
        <div className="apocrypha-read-title">
          <span className="apocrypha-read-book">{book.book}</span>
          <span className="apocrypha-badge">{book.group_label}</span>
        </div>
      </div>

      {chapters.length > 1 && (
        <div className="apocrypha-chapter-nav">
          {chapters.map(ch => (
            <button
              key={ch}
              className={`apocrypha-chapter-btn${ch === chapter ? ' apocrypha-chapter-btn--active' : ''}`}
              onClick={() => setChapter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      <div className="apocrypha-verses">
        {loading && <div className="panel-loading">Loading…</div>}
        {!loading && verses.length === 0 && (
          <div className="apocrypha-no-text">
            <p className="apocrypha-no-text-title">Text not yet loaded</p>
            <p className="apocrypha-no-text-body">
              The full text of {book.book} will be included in a future update.
              It is part of the {book.group_label} — recognised as scripture by{' '}
              {book.group_label === 'Deuterocanon' ? 'the Catholic and Orthodox churches' :
               book.group_label === 'Broader Canon' ? 'the Eastern and Ethiopian Orthodox churches' :
               'the Ethiopian Orthodox Tewahedo Church'}.
            </p>
          </div>
        )}
        {!loading && verses.length > 0 && verses.map(v => (
          <div key={v.verse} className="apocrypha-verse-row">
            <span className="apocrypha-verse-num">{v.verse}</span>
            <span className="apocrypha-verse-text">{v.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApocryphaPanel() {
  const [books, setBooks] = useState<ApocryphaBook[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApocryphaBook | null>(null)

  useEffect(() => {
    window.apocryphaApi.getBooks()
      .then(b => { setBooks(b); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="apocrypha-panel">
      <div className="apocrypha-disclaimer">
        <span className="apocrypha-disclaimer-icon">✦</span>
        <span>
          These texts are <strong>not part of the 66-book Protestant Bible</strong>.
          They represent the broader Christian canon used in Catholic, Orthodox, and Ethiopian traditions.
          Presented for study and historical context.
        </span>
      </div>

      {loading && <div className="panel-loading">Loading…</div>}
      {!loading && !selected && <BookGrid books={books} onSelect={setSelected} />}
      {!loading && selected && <ReadMode book={selected} onBack={() => setSelected(null)} />}
    </div>
  )
}
