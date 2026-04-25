import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { SearchResult, SelectedVerse } from '../types'

type Tab = 'all' | 'scripture' | 'commentary'

const PAGE_ALL = 10
const PAGE_SECTION = 20

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, query: string): React.ReactNode {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return text
  const pattern = new RegExp(`(${words.map(escapeRegex).join('|')})`, 'gi')
  const parts = text.split(pattern)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="search-highlight">{part}</mark> : part
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (loc: SelectedVerse) => void
}

export function SearchModal({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [book, setBook] = useState('')
  const [father, setFather] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [books, setBooks] = useState<string[]>([])
  const [fathers, setFathers] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setFocusedIdx(-1); return }
    setTimeout(() => inputRef.current?.focus(), 50)
    if (books.length === 0) {
      window.bibleApi.getBooks().then(bs => setBooks(bs.map(b => b.book)))
    }
    if (fathers.length === 0) {
      window.bibleApi.getFathers().then(setFathers)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults(null); setFocusedIdx(-1); return }
    const limit = tab === 'all' ? PAGE_ALL : PAGE_SECTION
    const timer = setTimeout(async () => {
      setLoading(true)
      setFocusedIdx(-1)
      const r = await window.bibleApi.search({ query, tab, book, father, offset: 0, limit })
      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, tab, book, father])

  const flatResults = useMemo(() => {
    if (!results) return [] as Array<{ book: string; chapter: number; verse: number }>
    const list: Array<{ book: string; chapter: number; verse: number }> = []
    if (tab !== 'commentary') results.verses.forEach(v => list.push(v))
    if (tab !== 'scripture') results.commentary.forEach(c => list.push(c))
    return list
  }, [results, tab])

  const navigate = useCallback((item: { book: string; chapter: number; verse: number }) => {
    onNavigate({ book: item.book, chapter: item.chapter, verse: item.verse })
    onClose()
  }, [onNavigate, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, -1))
        if (focusedIdx <= 0) inputRef.current?.focus()
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        const item = flatResults[focusedIdx]
        if (item) navigate(item)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, focusedIdx, flatResults, navigate])

  useEffect(() => {
    if (focusedIdx < 0 || !resultsRef.current) return
    const el = resultsRef.current.querySelector(`[data-idx="${focusedIdx}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [focusedIdx])

  const loadMore = useCallback(async () => {
    if (!results || !query.trim() || tab === 'all') return
    const offset = tab === 'scripture' ? results.verses.length : results.commentary.length
    setLoadingMore(true)
    const r = await window.bibleApi.search({ query, tab, book, father, offset, limit: PAGE_SECTION })
    setResults(prev => {
      if (!prev) return r
      return {
        verses: tab === 'scripture' ? [...prev.verses, ...r.verses] : prev.verses,
        commentary: tab === 'commentary' ? [...prev.commentary, ...r.commentary] : prev.commentary,
        totalVerses: r.totalVerses,
        totalCommentary: r.totalCommentary,
      }
    })
    setLoadingMore(false)
  }, [results, query, tab, book, father])

  if (!open) return null

  const hasMore = tab === 'scripture'
    ? (results?.totalVerses ?? 0) > (results?.verses.length ?? 0)
    : tab === 'commentary'
    ? (results?.totalCommentary ?? 0) > (results?.commentary.length ?? 0)
    : false

  const total = tab === 'scripture'
    ? (results?.totalVerses ?? 0)
    : tab === 'commentary'
    ? (results?.totalCommentary ?? 0)
    : (results?.totalVerses ?? 0) + (results?.totalCommentary ?? 0)

  let globalIdx = -1

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
            onChange={e => { setQuery(e.target.value); setFocusedIdx(-1) }}
          />
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="search-tabs">
          {(['all', 'scripture', 'commentary'] as Tab[]).map(t => (
            <button
              key={t}
              className={`search-tab${tab === t ? ' search-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'All' : t === 'scripture' ? 'Scripture' : 'Commentary'}
            </button>
          ))}
        </div>

        {query.trim() && (
          <div className="search-filters">
            <select className="search-filter-select" value={book} onChange={e => setBook(e.target.value)}>
              <option value="">All Books</option>
              {books.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {tab !== 'scripture' && (
              <select className="search-filter-select" value={father} onChange={e => setFather(e.target.value)}>
                <option value="">All Fathers</option>
                {fathers.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="modal-results" ref={resultsRef}>
          {loading && <div className="modal-status">Searching...</div>}

          {!loading && query.trim() && results && total === 0 && (
            <div className="modal-status">No results for "{query}"</div>
          )}

          {!loading && results && total > 0 && (
            <>
              <div className="search-result-count">
                {total.toLocaleString()} result{total !== 1 ? 's' : ''}
                {tab === 'all' && results.totalVerses > PAGE_ALL && results.totalCommentary > PAGE_ALL && ' (showing first 10 per section)'}
              </div>

              {tab !== 'commentary' && results.verses.length > 0 && (
                <div className="result-group">
                  <div
                    className={`result-group-label${tab === 'all' ? ' result-group-label--clickable' : ''}`}
                    onClick={() => tab === 'all' ? setTab('scripture') : undefined}
                  >
                    Scripture ({results.totalVerses.toLocaleString()})
                    {tab === 'all' && results.totalVerses > PAGE_ALL && (
                      <span className="result-group-more">View all →</span>
                    )}
                  </div>
                  {results.verses.map((v, i) => {
                    globalIdx++
                    const idx = globalIdx
                    return (
                      <button
                        key={i}
                        data-idx={idx}
                        className={`result-item${focusedIdx === idx ? ' result-item--focused' : ''}`}
                        onMouseEnter={() => setFocusedIdx(idx)}
                        onClick={() => navigate(v)}
                      >
                        <span className="result-ref">{v.book} {v.chapter}:{v.verse}</span>
                        <span className="result-text">{highlight(v.text, query)}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {tab !== 'scripture' && results.commentary.length > 0 && (
                <div className="result-group">
                  <div
                    className={`result-group-label${tab === 'all' ? ' result-group-label--clickable' : ''}`}
                    onClick={() => tab === 'all' ? setTab('commentary') : undefined}
                  >
                    Commentary ({results.totalCommentary.toLocaleString()})
                    {tab === 'all' && results.totalCommentary > PAGE_ALL && (
                      <span className="result-group-more">View all →</span>
                    )}
                  </div>
                  {results.commentary.map((c, i) => {
                    globalIdx++
                    const idx = globalIdx
                    return (
                      <button
                        key={i}
                        data-idx={idx}
                        className={`result-item${focusedIdx === idx ? ' result-item--focused' : ''}`}
                        onMouseEnter={() => setFocusedIdx(idx)}
                        onClick={() => navigate(c)}
                      >
                        <span className="result-ref">{c.book} {c.chapter}:{c.verse} — {c.father_name}</span>
                        <span className="result-text">{highlight(c.text, query)}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {tab !== 'all' && hasMore && (
                <div className="search-load-more">
                  <button className="search-load-more-btn" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
