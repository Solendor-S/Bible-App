import React, { useState, useEffect, useRef } from 'react'
import type { SearchResult, SelectedVerse } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (loc: SelectedVerse) => void
}

export function SearchModal({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const r = await window.bibleApi.search(query)
      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const total = (results?.verses.length ?? 0) + (results?.commentary.length ?? 0)

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="modal-input"
            placeholder="Search scripture and commentary..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-results">
          {loading && <div className="modal-status">Searching...</div>}
          {!loading && results && total === 0 && (
            <div className="modal-status">No results for "{query}"</div>
          )}

          {results && results.verses.length > 0 && (
            <div className="result-group">
              <div className="result-group-label">Scripture ({results.verses.length})</div>
              {results.verses.map((v, i) => (
                <button
                  key={i}
                  className="result-item"
                  onClick={() => { onNavigate({ book: v.book, chapter: v.chapter, verse: v.verse }); onClose() }}
                >
                  <span className="result-ref">{v.book} {v.chapter}:{v.verse}</span>
                  <span className="result-text">{v.text}</span>
                </button>
              ))}
            </div>
          )}

          {results && results.commentary.length > 0 && (
            <div className="result-group">
              <div className="result-group-label">Commentary ({results.commentary.length})</div>
              {results.commentary.map((c, i) => (
                <button
                  key={i}
                  className="result-item"
                  onClick={() => { onNavigate({ book: c.book, chapter: c.chapter, verse: c.verse }); onClose() }}
                >
                  <span className="result-ref">{c.book} {c.chapter}:{c.verse} — {c.father_name}</span>
                  <span className="result-text">{c.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
