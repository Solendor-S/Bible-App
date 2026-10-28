import React, { useEffect, useState } from 'react'
import { stripUsfm } from '../data/redLetter'
import { bibleDb } from '../db/sqlite'
import { getCrossRefs } from '../db/queries'
import type { CrossRef, SelectedVerse } from '../types'

interface Props {
  verse: SelectedVerse
  onClose: () => void
  onNavigate: (loc: SelectedVerse) => void
  onAdd: (book: string, chapter: number, verse: number) => void
}

export function ParallelModal({ verse, onClose, onNavigate, onAdd }: Props) {
  const [refs, setRefs] = useState<CrossRef[]>([])
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState<Set<number>>(new Set())

  useEffect(() => {
    setLoading(true)
    setAdded(new Set())
    getCrossRefs(bibleDb, verse.book, verse.chapter, verse.verse).then(r => {
      setRefs(r)
      setLoading(false)
    })
  }, [verse.book, verse.chapter, verse.verse])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const label = `${verse.book} ${verse.chapter}:${verse.verse}`

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal parallel-modal">
        <div className="concordance-header">
          <div className="concordance-word">{label}</div>
          {!loading && (
            <div className="concordance-count">
              {refs.length} parallel passage{refs.length !== 1 ? 's' : ''}
            </div>
          )}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-results">
          {loading && <div className="modal-status">Loading…</div>}

          {!loading && refs.length === 0 && (
            <div className="modal-status">No parallel passages found for {label}</div>
          )}

          {!loading && refs.map((r, i) => (
            <div key={i} className="parallel-row">
              <button
                className="parallel-row-main"
                onClick={() => {
                  onNavigate({ book: r.ref_book, chapter: r.ref_chapter, verse: r.ref_verse })
                  onClose()
                }}
              >
                <span className="result-ref">{r.ref_book} {r.ref_chapter}:{r.ref_verse}</span>
                <span className="result-text">{stripUsfm(r.text)}</span>
              </button>
              <button
                className={`parallel-add-btn${added.has(i) ? ' parallel-add-btn--done' : ''}`}
                title={added.has(i) ? 'Added' : 'Add to scripture panel'}
                onClick={() => {
                  if (added.has(i)) return
                  onAdd(r.ref_book, r.ref_chapter, r.ref_verse)
                  setAdded(s => new Set([...s, i]))
                }}
              >
                {added.has(i) ? '✓' : '+'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
