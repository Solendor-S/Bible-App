import React, { useEffect, useState } from 'react'
import type { CrossRef, SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
  onNavigate?: (book: string, chapter: number, verse: number) => void
  translation?: string
}

export function CrossRefsPanel({ selected, onNavigate, translation = 'KJV' }: Props) {
  const [refs, setRefs] = useState<CrossRef[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selected?.book || !selected?.verse) { setRefs([]); return }
    setLoading(true)
    window.bibleApi.getCrossRefsFull(selected.book, selected.chapter, selected.verse, translation)
      .then(r => { setRefs(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selected?.book, selected?.chapter, selected?.verse, translation])

  if (!selected?.verse) {
    return <div className="panel-empty">Select a verse to see cross-references.</div>
  }
  if (loading) return <div className="panel-loading">Loading...</div>
  if (!refs.length) return <div className="panel-empty">No cross-references found.</div>

  return (
    <div className="crossrefs-panel">
      {refs.map((ref, i) => (
        <div
          key={i}
          className="crossref-entry"
          onClick={() => onNavigate?.(ref.to_book, ref.to_chapter, ref.to_verse)}
        >
          <span className="crossref-location">
            {ref.to_book} {ref.to_chapter}:{ref.to_verse}
          </span>
          <span className="crossref-verse-text">{ref.text}</span>
        </div>
      ))}
    </div>
  )
}
