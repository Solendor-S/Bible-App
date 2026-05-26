import React, { useEffect, useRef, useState } from 'react'

const SPURIOUS = new Set(['2 Clement'])

const GROUPS = [
  {
    label: 'Early Christian Texts',
    desc: 'Earliest Christian writings outside the New Testament, dating to the late 1st and early 2nd centuries.',
    books: ['Didache', '1 Clement'],
  },
  {
    label: 'Spurious',
    desc: '2 Clement is not a letter and was not written by Clement of Rome. It is an anonymous 2nd-century homily falsely attributed to him.',
    books: ['2 Clement'],
  },
]

interface EarlyBook { book: string; chapter_count: number }
interface Footnote { marker: number; note: string }
interface FnPopup { marker: number; note: string; x: number; y: number }

const FN_RE = /\[(\d+)\]/g

function VerseText({ text, fnMap, onFnClick }: {
  text: string
  fnMap: Map<number, string>
  onFnClick: (popup: FnPopup, e: React.MouseEvent) => void
}) {
  const parts: React.ReactNode[] = []
  let last = 0; let m: RegExpExecArray | null; let i = 0
  while ((m = FN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={i++}>{text.slice(last, m.index)}</span>)
    const num = parseInt(m[1])
    const note = fnMap.get(num)
    parts.push(
      <sup
        key={i++}
        className={`early-text-fn-marker${note ? ' early-text-fn-marker--active' : ''}`}
        onClick={note ? e => onFnClick({ marker: num, note, x: 0, y: 0 }, e) : undefined}
      >
        [{m[1]}]
      </sup>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>)
  return <span className="apocrypha-verse-text">{parts}</span>
}

function BookGrid({ books, onSelect }: { books: EarlyBook[]; onSelect: (b: EarlyBook) => void }) {
  return (
    <div className="apocrypha-browse">
      {GROUPS.map(g => {
        const available = books.filter(b => g.books.includes(b.book))
        if (!available.length) return null
        return (
          <div key={g.label} className="apocrypha-group">
            <div className="apocrypha-group-header">
              <span className="apocrypha-group-label">{g.label}</span>
              <span className="apocrypha-group-desc">{g.desc}</span>
            </div>
            <div className="apocrypha-book-grid">
              {available.map(b => (
                <button
                  key={b.book}
                  className={`apocrypha-book-card${SPURIOUS.has(b.book) ? ' early-text-spurious' : ''}`}
                  onClick={() => onSelect(b)}
                >
                  <span className="apocrypha-book-name">{b.book}</span>
                  <span className="apocrypha-book-meta">{b.chapter_count} ch</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReadMode({ book, onBack }: { book: EarlyBook; onBack: () => void }) {
  const [chapter, setChapter] = useState(1)
  const [chapters, setChapters] = useState<number[]>([])
  const [verses, setVerses] = useState<{ verse: number; text: string }[]>([])
  const [footnotes, setFootnotes] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState<FnPopup | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.earlyTextsApi.getChapters(book.book).then(chs => {
      setChapters(chs)
      setChapter(chs[0] ?? 1)
    })
  }, [book.book])

  useEffect(() => {
    setLoading(true)
    setVerses([])
    setPopup(null)
    Promise.all([
      window.earlyTextsApi.getVerses(book.book, chapter),
      window.earlyTextsApi.getFootnotes(book.book, chapter),
    ]).then(([vs, fns]) => {
      setVerses(vs)
      setFootnotes(new Map((fns as Footnote[]).map(f => [f.marker, f.note])))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [book.book, chapter])

  useEffect(() => {
    if (!popup) return
    function onDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [popup])

  function handleFnClick(fn: FnPopup, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopup({ ...fn, x: rect.left, y: rect.bottom + 4 })
  }

  return (
    <div className="apocrypha-read">
      <div className="apocrypha-read-topbar">
        <button className="apocrypha-back-btn" onClick={onBack}>← All Books</button>
        <div className="apocrypha-read-title">
          <span className="apocrypha-read-book">{book.book}</span>
          <span className="apocrypha-badge">{SPURIOUS.has(book.book) ? 'Spurious' : 'Early Text'}</span>
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
            <p className="apocrypha-no-text-title">No text available</p>
            <p className="apocrypha-no-text-body">No text found for this chapter.</p>
          </div>
        )}
        {!loading && verses.length > 0 && verses.map(v => (
          <div key={v.verse} className="apocrypha-verse-row">
            <span className="apocrypha-verse-num">{v.verse}</span>
            <VerseText text={v.text} fnMap={footnotes} onFnClick={handleFnClick} />
          </div>
        ))}
      </div>

      {popup && (
        <div
          ref={popupRef}
          className="early-text-fn-popup"
          style={{ position: 'fixed', left: popup.x, top: popup.y }}
        >
          <span className="early-text-fn-num">[{popup.marker}]</span>
          {popup.note}
        </div>
      )}
    </div>
  )
}

export function EarlyTextsPanel() {
  const [books, setBooks] = useState<EarlyBook[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EarlyBook | null>(null)

  useEffect(() => {
    window.earlyTextsApi.getBooks()
      .then(b => { setBooks(b); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="apocrypha-panel">
      <div className="apocrypha-disclaimer">
        <span className="apocrypha-disclaimer-icon">✦</span>
        <span>
          These texts are <strong>not part of the New Testament canon</strong>.
          They are early Christian writings valued for historical and theological context,
          dating primarily to the late 1st and early 2nd centuries.
        </span>
      </div>

      {loading && <div className="panel-loading">Loading…</div>}
      {!loading && !selected && <BookGrid books={books} onSelect={setSelected} />}
      {!loading && selected && <ReadMode book={selected} onBack={() => setSelected(null)} />}
    </div>
  )
}
