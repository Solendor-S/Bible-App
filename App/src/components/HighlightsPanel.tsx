import React, { useEffect, useState } from 'react'
import { HIGHLIGHT_COLORS } from './BiblePanel'
import type { Highlight } from '../types'

const BOOK_ORDER: Record<string, number> = {
  'Genesis': 0, 'Exodus': 1, 'Leviticus': 2, 'Numbers': 3, 'Deuteronomy': 4,
  'Joshua': 5, 'Judges': 6, 'Ruth': 7, '1 Samuel': 8, '2 Samuel': 9,
  '1 Kings': 10, '2 Kings': 11, '1 Chronicles': 12, '2 Chronicles': 13,
  'Ezra': 14, 'Nehemiah': 15, 'Esther': 16, 'Job': 17, 'Psalms': 18, 'Proverbs': 19,
  'Ecclesiastes': 20, 'Song of Solomon': 21, 'Isaiah': 22, 'Jeremiah': 23,
  'Lamentations': 24, 'Ezekiel': 25, 'Daniel': 26, 'Hosea': 27, 'Joel': 28, 'Amos': 29,
  'Obadiah': 30, 'Jonah': 31, 'Micah': 32, 'Nahum': 33, 'Habakkuk': 34, 'Zephaniah': 35,
  'Haggai': 36, 'Zechariah': 37, 'Malachi': 38,
  'Matthew': 39, 'Mark': 40, 'Luke': 41, 'John': 42, 'Acts': 43, 'Romans': 44,
  '1 Corinthians': 45, '2 Corinthians': 46, 'Galatians': 47, 'Ephesians': 48,
  'Philippians': 49, 'Colossians': 50, '1 Thessalonians': 51, '2 Thessalonians': 52,
  '1 Timothy': 53, '2 Timothy': 54, 'Titus': 55, 'Philemon': 56, 'Hebrews': 57,
  'James': 58, '1 Peter': 59, '2 Peter': 60, '1 John': 61, '2 John': 62, '3 John': 63,
  'Jude': 64, 'Revelation': 65,
}

interface Props {
  onNavigate?: (book: string, chapter: number, verse: number) => void
  translation?: string
}

export function HighlightsPanel({ onNavigate, translation = 'KJV' }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    window.highlightApi.getAll(translation)
      .then(h => { setHighlights(h); setLoading(false) })
      .catch(() => setLoading(false))
  }, [translation])

  function toggleGroup(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <div className="panel-loading">Loading…</div>

  if (!highlights.length) {
    return (
      <div className="panel-body">
        <div className="panel-empty">No highlights yet. Right-click any verse to highlight it.</div>
      </div>
    )
  }

  return (
    <div className="highlights-panel">
      {HIGHLIGHT_COLORS.map(({ id, label, hex }) => {
        const group = highlights
          .filter(h => h.color === id)
          .sort((a, b) =>
            (BOOK_ORDER[a.book] ?? 99) - (BOOK_ORDER[b.book] ?? 99) ||
            a.chapter - b.chapter ||
            a.verse - b.verse
          )
        if (!group.length) return null
        const isCollapsed = collapsed.has(id)
        return (
          <div key={id} className="highlights-group">
            <button className="highlights-group-header" onClick={() => toggleGroup(id)}>
              <span className="highlights-color-dot" style={{ background: hex }} />
              <span className="highlights-group-label">{label}</span>
              <span className="highlights-group-count">{group.length}</span>
              <span className="highlights-group-chevron">{isCollapsed ? '▼' : '▲'}</span>
            </button>
            {!isCollapsed && group.map((h, i) => (
              <button
                key={i}
                className={`highlights-item highlights-item--${id}`}
                onClick={() => onNavigate?.(h.book, h.chapter, h.verse)}
              >
                <span className="highlights-item-ref">{h.book} {h.chapter}:{h.verse}</span>
                {h.text && <span className="highlights-item-text">{h.text}</span>}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
