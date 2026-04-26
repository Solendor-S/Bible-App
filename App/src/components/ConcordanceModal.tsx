import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { SelectedVerse } from '../types'

interface Props {
  word: string
  onClose: () => void
  onNavigate: (loc: SelectedVerse) => void
  translation?: string
}

const PAGE = 100

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, word: string): React.ReactNode {
  const parts = text.split(new RegExp(`(\\b${escapeRegex(word)}\\b)`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    i % 2 === 1 ? <mark key={i} className="search-highlight">{p}</mark> : p
  )
}

export function ConcordanceModal({ word, onClose, onNavigate, translation = 'KJV' }: Props) {
  const [allResults, setAllResults] = useState<Array<{ book: string; chapter: number; verse: number; text: string }>>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [filterBook, setFilterBook] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setShown(PAGE)
    setFocusedIdx(-1)
    setFilterBook(null)
    setFilterOpen(false)
    window.bibleApi.concordance(word, translation).then(({ total, results }) => {
      setTotal(total)
      setAllResults(results)
      setLoading(false)
    })
  }, [word])

  // Reset shown when filter changes
  useEffect(() => { setShown(PAGE); setFocusedIdx(-1) }, [filterBook])

  const bookCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of allResults) map.set(r.book, (map.get(r.book) ?? 0) + 1)
    return map
  }, [allResults])

  const filtered = useMemo(
    () => filterBook ? allResults.filter(r => r.book === filterBook) : allResults,
    [allResults, filterBook]
  )

  const visible = filtered.slice(0, shown)

  const navigate = useCallback((item: { book: string; chapter: number; verse: number }) => {
    onNavigate({ book: item.book, chapter: item.chapter, verse: item.verse })
    onClose()
  }, [onNavigate, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, visible.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, -1))
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        const item = visible[focusedIdx]
        if (item) navigate(item)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, focusedIdx, visible, navigate])

  useEffect(() => {
    if (focusedIdx < 0 || !resultsRef.current) return
    const el = resultsRef.current.querySelector(`[data-idx="${focusedIdx}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [focusedIdx])

  let lastBook = ''

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal concordance-modal">

        <div className="concordance-header">
          <div className="concordance-word">"{word}"</div>
          {!loading && (
            <div className="concordance-count">
              {filterBook
                ? `${filtered.length.toLocaleString()} of ${total.toLocaleString()} in ${filterBook}`
                : `${total.toLocaleString()} occurrence${total !== 1 ? 's' : ''} in the ${translation}`}
            </div>
          )}
          {!loading && total > 0 && (
            <button
              className={`concordance-filter-btn${filterOpen || filterBook ? ' concordance-filter-btn--active' : ''}`}
              onClick={() => setFilterOpen(o => !o)}
              title="Filter by book"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filterBook && <span className="concordance-filter-badge" />}
            </button>
          )}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {filterOpen && !loading && (
          <div className="concordance-filter-panel">
            <button
              className={`concordance-book-chip${!filterBook ? ' concordance-book-chip--active' : ''}`}
              onClick={() => setFilterBook(null)}
            >
              All <span className="concordance-chip-count">{total}</span>
            </button>
            {[...bookCounts.entries()].map(([book, count]) => (
              <button
                key={book}
                className={`concordance-book-chip${filterBook === book ? ' concordance-book-chip--active' : ''}`}
                onClick={() => setFilterBook(b => b === book ? null : book)}
              >
                {book} <span className="concordance-chip-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="modal-results" ref={resultsRef}>
          {loading && <div className="modal-status">Searching…</div>}

          {!loading && filtered.length === 0 && (
            <div className="modal-status">No occurrences found for "{word}"</div>
          )}

          {!loading && visible.map((r, i) => {
            const showBookLabel = r.book !== lastBook
            lastBook = r.book
            return (
              <React.Fragment key={i}>
                {showBookLabel && (
                  <div className="concordance-book-label">{r.book}</div>
                )}
                <button
                  data-idx={i}
                  className={`result-item${focusedIdx === i ? ' result-item--focused' : ''}`}
                  onMouseEnter={() => setFocusedIdx(i)}
                  onClick={() => navigate(r)}
                >
                  <span className="result-ref">{r.book} {r.chapter}:{r.verse}</span>
                  <span className="result-text">{highlight(r.text, word)}</span>
                </button>
              </React.Fragment>
            )
          })}

          {!loading && shown < filtered.length && (
            <div className="search-load-more">
              <button className="search-load-more-btn" onClick={() => setShown(s => s + PAGE)}>
                Load More ({filtered.length - shown} remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
