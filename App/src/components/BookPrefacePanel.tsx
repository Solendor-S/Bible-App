import React, { useState } from 'react'
import { getBookPreface } from '../lib/bookPrefaces'

interface Props {
  book: string
  onNavigate: (book: string, chapter: number, verse: number) => void
}

export function BookPrefacePanel({ book, onNavigate }: Props) {
  const preface = getBookPreface(book)
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  if (!preface) {
    return (
      <div className="book-preface">
        <div className="book-preface-title">{book}</div>
        <div className="panel-empty">No preface available for this book.</div>
        <button className="book-preface-read-btn" onClick={() => onNavigate(book, 1, 0)}>
          Read Chapter 1 →
        </button>
      </div>
    )
  }

  return (
    <div className="book-preface">
      <div className="book-preface-title">{book}</div>

      <div className="book-preface-section">
        <div className="book-preface-label">Summary</div>
        <p className="book-preface-text">{preface.summary}</p>
      </div>

      <div className="book-preface-section">
        <div className="book-preface-label">Themes</div>
        <ul className="book-preface-themes">
          {preface.themes.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="book-preface-section book-preface-meta">
        <div className="book-preface-meta-row">
          <span className="book-preface-meta-label">Author</span>
          <span className="book-preface-meta-value">{preface.author}</span>
        </div>
        <div className="book-preface-meta-row">
          <span className="book-preface-meta-label">Dating</span>
          <span className="book-preface-meta-value">{preface.dating}</span>
        </div>
      </div>

      {preface.evidence && preface.evidence.length > 0 && (
        <div className="book-preface-section">
          <button
            className="book-preface-evidence-toggle"
            onClick={() => setEvidenceOpen(o => !o)}
          >
            <span>{evidenceOpen ? '▼' : '▶'} Evidence & Authenticity</span>
          </button>
          {evidenceOpen && (
            <ul className="book-preface-evidence">
              {preface.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preface.sources.length > 0 && (
        <div className="book-preface-section book-preface-sources">
          <div className="book-preface-label">Sources</div>
          <div className="book-preface-source-list">
            {preface.sources.map((s, i) => (
              <span key={i} className="book-preface-source-chip">{s}</span>
            ))}
          </div>
        </div>
      )}

      <button className="book-preface-read-btn" onClick={() => onNavigate(book, 1, 0)}>
        Read Chapter 1 →
      </button>
    </div>
  )
}
