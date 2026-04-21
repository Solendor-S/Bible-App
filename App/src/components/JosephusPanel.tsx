import React, { useEffect, useState } from 'react'
import type { JosephusEntry, SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
}

function JosephusEntryView({ entry }: { entry: JosephusEntry }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW_LEN = 320
  const hasMore = entry.text.length > PREVIEW_LEN

  return (
    <div className="josephus-entry">
      <div className="josephus-header">
        <span className="josephus-ref">{entry.ref}</span>
        <span className="josephus-work">{entry.work}</span>
      </div>
      {entry.note && <p className="josephus-note">{entry.note}</p>}
      <p className="josephus-text">
        {expanded || !hasMore ? entry.text : entry.text.slice(0, PREVIEW_LEN) + '…'}
      </p>
      {hasMore && (
        <button className="expand-inline-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
    </div>
  )
}

export function JosephusPanel({ selected }: Props) {
  const [entries, setEntries] = useState<JosephusEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setEntries([])
    if (!selected?.verse) return
    setLoading(true)
    window.bibleApi.getJosephusForVerse(selected.book, selected.chapter, selected.verse)
      .then(e => { setEntries(e); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selected?.book, selected?.chapter, selected?.verse])

  if (!selected?.verse) {
    return <div className="panel-empty">Select a verse to see Josephus references.</div>
  }
  if (loading) return <div className="panel-loading">Loading…</div>
  if (!entries.length) {
    return (
      <div className="panel-body">
        <div className="panel-empty">No Josephus references for this verse.</div>
        <p className="josephus-about">
          Flavius Josephus (37–100 AD) was a first-century Jewish historian whose works —
          <em> Antiquities of the Jews</em> and <em>The Jewish War</em> — are the primary
          non-biblical sources for the world of the New Testament.
        </p>
      </div>
    )
  }

  return (
    <div className="panel-body">
      {entries.map((entry, i) => (
        <JosephusEntryView key={i} entry={entry} />
      ))}
    </div>
  )
}
