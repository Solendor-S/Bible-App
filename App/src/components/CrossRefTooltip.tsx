import React, { useState } from 'react'
import type { CrossRef } from '../types'

interface Props {
  refs: CrossRef[]
  onNavigate: (book: string, chapter: number, verse: number) => void
}

export function CrossRefTooltip({ refs, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  if (refs.length === 0) return null

  return (
    <span className="crossref-wrap">
      <button
        className="crossref-badge"
        onClick={() => setOpen(o => !o)}
        title="Cross-references"
      >
        cf {refs.length}
      </button>
      {open && (
        <div className="crossref-popup">
          <div className="crossref-popup-header">Cross-references</div>
          {refs.map((r, i) => (
            <button
              key={i}
              className="crossref-item"
              onClick={() => { onNavigate(r.to_book, r.to_chapter, r.to_verse); setOpen(false) }}
            >
              <span className="crossref-ref">{r.to_book} {r.to_chapter}:{r.to_verse}</span>
              <span className="crossref-text">{r.text}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  )
}
