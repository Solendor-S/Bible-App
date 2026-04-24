import React, { useEffect, useState } from 'react'
import type { HistoricalEntry, JosephusEntry, SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
}

const CATEGORY_LABEL: Record<string, string> = {
  ancient_author: 'Ancient Author',
  archaeology: 'Archaeology',
  manuscript: 'Manuscript',
  inscription: 'Inscription',
}

function JosephusEntryView({ entry }: { entry: JosephusEntry }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW_LEN = 320
  const hasMore = entry.text.length > PREVIEW_LEN
  return (
    <div className="historical-entry">
      <div className="historical-header">
        <div className="historical-title-row">
          <span className="historical-title">{entry.ref}</span>
          <span className="historical-author">{entry.work}</span>
        </div>
        <div className="historical-meta-row">
          <span className="historical-category-badge historical-category-badge--ancient_author">Ancient Author</span>
          <span className="historical-date">c. 37–100 AD</span>
          <span className="historical-location">Rome / Judaea</span>
        </div>
      </div>
      {entry.note && (
        <div className="historical-significance">
          <span className="historical-significance-label">Context</span>
          <p className="historical-significance-text">{entry.note}</p>
        </div>
      )}
      <p className="historical-description">
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

function HistoricalEntryView({ entry }: { entry: HistoricalEntry }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW_LEN = 280
  const hasMore = entry.description.length > PREVIEW_LEN
  return (
    <div className="historical-entry">
      <div className="historical-header">
        <div className="historical-title-row">
          <span className="historical-title">{entry.title}</span>
          {entry.author && <span className="historical-author">{entry.author}</span>}
        </div>
        <div className="historical-meta-row">
          <span className={`historical-category-badge historical-category-badge--${entry.category}`}>
            {CATEGORY_LABEL[entry.category] ?? entry.category}
          </span>
          <span className="historical-date">{entry.date_desc}</span>
          {entry.location && <span className="historical-location">{entry.location}</span>}
        </div>
      </div>
      <p className="historical-description">
        {expanded || !hasMore ? entry.description : entry.description.slice(0, PREVIEW_LEN) + '…'}
      </p>
      {hasMore && (
        <button className="expand-inline-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
      <div className="historical-significance">
        <span className="historical-significance-label">Significance</span>
        <p className="historical-significance-text">{entry.significance}</p>
      </div>
      <p className="historical-citation">{entry.citation}</p>
    </div>
  )
}

function BrowseSection({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="history-browse-section">
      <button className="history-browse-heading" onClick={() => setOpen(o => !o)}>
        <span className={`history-browse-chevron${open ? '' : ' history-browse-chevron--closed'}`}>▾</span>
        {title}
        <span className="history-browse-count">{count}</span>
      </button>
      {open && children}
    </div>
  )
}

function BrowseMode() {
  const [all, setAll] = useState<HistoricalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.bibleApi.getHistoricalAll()
      .then(entries => { setAll(entries); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="panel-loading">Loading…</div>

  const ot = all.filter(e => e.testament === 'ot').sort((a, b) => a.sort_year - b.sort_year)
  const nt = all.filter(e => e.testament === 'nt').sort((a, b) => a.sort_year - b.sort_year)

  return (
    <div className="panel-body">
      <BrowseSection title="Old Testament" count={`${ot.length} sources`}>
        {ot.map(e => <HistoricalEntryView key={e.source_key} entry={e} />)}
      </BrowseSection>
      <BrowseSection title="New Testament" count={`${nt.length} sources + Josephus`}>
        {nt.map(e => <HistoricalEntryView key={e.source_key} entry={e} />)}
        <div className="history-josephus-note">
          <span className="history-josephus-note-icon">📜</span>
          <span>Flavius Josephus (c. 37–100 AD) references appear in verse mode when you select a verse. His works — <em>Antiquities of the Jews</em> and <em>The Jewish War</em> — are the primary non-biblical source for the NT world.</span>
        </div>
      </BrowseSection>
    </div>
  )
}

export function JosephusPanel({ selected }: Props) {
  const [mode, setMode] = useState<'verse' | 'browse'>('verse')
  const [josephusEntries, setJosephusEntries] = useState<JosephusEntry[]>([])
  const [historicalEntries, setHistoricalEntries] = useState<HistoricalEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setJosephusEntries([])
    setHistoricalEntries([])
    if (mode !== 'verse' || !selected?.verse) return
    setLoading(true)
    Promise.all([
      window.bibleApi.getJosephusForVerse(selected.book, selected.chapter, selected.verse),
      window.bibleApi.getHistoricalForVerse(selected.book, selected.chapter, selected.verse),
    ]).then(([jos, hist]) => {
      setJosephusEntries(jos)
      setHistoricalEntries(hist)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [mode, selected?.book, selected?.chapter, selected?.verse])

  const total = josephusEntries.length + historicalEntries.length

  return (
    <div className="history-panel-wrap">
      <div className="history-mode-toggle">
        <button
          className={`history-mode-btn${mode === 'verse' ? ' history-mode-btn--active' : ''}`}
          onClick={() => setMode('verse')}
        >
          Verse
        </button>
        <button
          className={`history-mode-btn${mode === 'browse' ? ' history-mode-btn--active' : ''}`}
          onClick={() => setMode('browse')}
        >
          Browse All
        </button>
      </div>

      {mode === 'browse' ? (
        <BrowseMode />
      ) : (
        <>
          {!selected?.verse && (
            <div className="panel-empty">Select a verse to see historical sources.</div>
          )}
          {selected?.verse && loading && <div className="panel-loading">Loading…</div>}
          {selected?.verse && !loading && total === 0 && (
            <div className="panel-body">
              <div className="panel-empty">No historical sources for this verse.</div>
            </div>
          )}
          {selected?.verse && !loading && total > 0 && (
            <div className="panel-body">
              {josephusEntries.map((e, i) => <JosephusEntryView key={`jos-${i}`} entry={e} />)}
              {historicalEntries.map(e => <HistoricalEntryView key={e.source_key} entry={e} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
