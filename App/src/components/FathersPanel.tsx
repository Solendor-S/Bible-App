// Church Fathers tab — port of the Android StudyScreen fathers mode: this-verse commentary
// (hand-picked / legacy), consensus by tradition, corpus search, and Browse Fathers.
import { useEffect, useMemo, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { getAllCommentaryByFather, getCommentaryFromDb, searchCommentary } from '../db/queries'
import type { CommentaryEntryWithRef } from '../db/queries'
import { FATHER_DATES, getFatherInfo } from '../data/fatherDates'
import { getFatherInfluences } from '../data/fatherInfluences'
import { TRADITION_COLORS } from '../data/traditionColors'
import { EntryCard } from './EntryCard'
import { Chips } from './Modal'
import { usePref } from '../context/Prefs'
import type { CommentaryEntry, SelectedVerse } from '../types'

type Nav = (book: string, chapter: number, verse: number) => void
const TRADITIONS = ['All', 'Eastern', 'Western', 'Alexandrian', 'Syrian', 'North African'] as const

// Deduped + chronologically sorted father list (computed once)
const FATHER_LIST = (() => {
  const seen = new Set<string>()
  return Object.entries(FATHER_DATES)
    .filter(([, i]) => i.sort >= 30 && i.sort <= 800)
    .filter(([name, i]) => { const k = `${i.sort}-${name.split(' ')[0]}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort(([, a], [, b]) => a.sort - b.sort)
})()

const bySort = (a: CommentaryEntry, b: CommentaryEntry) =>
  (getFatherInfo(a.father_name)?.sort ?? 9999) - (getFatherInfo(b.father_name)?.sort ?? 9999)

function TraditionChips({ value, onChange }: { value: string | null; onChange: (t: string | null) => void }) {
  return <Chips small value={value ?? 'All'} onChange={t => onChange(t === 'All' ? null : t)} options={TRADITIONS.map(t => ({ value: t, label: t }))} />
}

export function FathersPanel({ selected, onNavigate, browseFather, onBrowseFather, returnLabel, onReturn }: {
  selected: SelectedVerse
  onNavigate: Nav
  browseFather: string | null
  onBrowseFather: (name: string | null) => void
  returnLabel?: string | null
  onReturn?: () => void
}) {
  const [mode, setMode] = useState<'verse' | 'browse'>(browseFather ? 'browse' : 'verse')
  const [source, setSource] = usePref('commentary_source')
  const [entries, setEntries] = useState<CommentaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [tradition, setTradition] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommentaryEntryWithRef[] | null>(null)
  const [fatherQuery, setFatherQuery] = useState('')
  const [browseEntries, setBrowseEntries] = useState<CommentaryEntryWithRef[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  useEffect(() => { if (browseFather) setMode('browse') }, [browseFather])

  useEffect(() => {
    let live = true
    setLoading(true)
    getCommentaryFromDb(bibleDb, source, selected.book, selected.chapter, selected.verse)
      .then(rows => { if (live) { setEntries([...rows].sort(bySort)); setLoading(false) } })
      .catch(() => live && setLoading(false))
    return () => { live = false }
  }, [selected.book, selected.chapter, selected.verse, source])

  // Corpus-wide search, debounced (Android: 700 ms, min 2 chars)
  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return }
    const id = setTimeout(() => searchCommentary(bibleDb, query.trim()).then(setResults), 500)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    if (!browseFather) { setBrowseEntries([]); return }
    setBrowseLoading(true)
    getAllCommentaryByFather(bibleDb, browseFather).then(rows => { setBrowseEntries(rows); setBrowseLoading(false) })
  }, [browseFather])

  const filtered = useMemo(() => tradition ? entries.filter(e => getFatherInfo(e.father_name)?.tradition === tradition) : entries, [entries, tradition])
  const consensus = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of entries) { const t = getFatherInfo(e.father_name)?.tradition ?? 'Other'; c[t] = (c[t] ?? 0) + 1 }
    return c
  }, [entries])
  const fathers = useMemo(() => {
    const q = fatherQuery.trim().toLowerCase()
    return FATHER_LIST.filter(([name, i]) =>
      (!q || [name, i.role, i.location, i.tradition].some(s => s?.toLowerCase().includes(q))) && (!tradition || i.tradition === tradition))
  }, [fatherQuery, tradition])

  const verseRef = `${selected.book} ${selected.chapter}:${selected.verse}`
  const openFather = (name: string) => onBrowseFather(name)
  const card = (e: CommentaryEntryWithRef) => (
    <EntryCard key={`${e.id}-${e.book}-${e.chapter}-${e.verse}`} entry={e} book={e.book} chapter={e.chapter} verse={e.verse}
      verseRef={`${e.book} ${e.chapter}:${e.verse}`} onNavigate={onNavigate} onOpenFather={openFather} />
  )

  const modeToggle = (
    <Chips value={mode} onChange={m => { setMode(m); setTradition(null); if (m === 'verse') onBrowseFather(null) }}
      options={[{ value: 'verse', label: 'This Verse' }, { value: 'browse', label: 'Browse Fathers' }]} />
  )

  // ── Browse: father detail
  if (mode === 'browse' && browseFather) {
    const info = FATHER_DATES[browseFather] ?? getFatherInfo(browseFather)
    const { influencedBy, influenced } = getFatherInfluences(browseFather)
    return (
      <div className="panel-body">
        <div className="browse-header">
          <button className="link-btn" onClick={() => { onBrowseFather(null); if (returnLabel) onReturn?.() }}>‹ {returnLabel ?? 'Fathers'}</button>
          <div>
            <div className="browse-name">{browseFather}</div>
            {info?.role && <div className="browse-role">{info.role}{info.location ? ` · ${info.location}` : ''}{info.dates ? ` · ${info.dates}` : ''}</div>}
          </div>
        </div>
        {info?.keyWorks && <div className="info-card"><div className="section-label">Key works</div>{info.keyWorks}</div>}
        {(influencedBy.length > 0 || influenced.length > 0) && (
          <div className="info-card">
            <div className="section-label">Influence network</div>
            {influencedBy.length > 0 && <div className="influence-row"><span>Shaped by</span>{influencedBy.map(l => <button key={l.to} className="chip chip--small" title={l.note} onClick={() => openFather(l.to)}>{l.to}</button>)}</div>}
            {influenced.length > 0 && <div className="influence-row"><span>Shaped</span>{influenced.map(l => <button key={l.from} className="chip chip--small" title={l.note} onClick={() => openFather(l.from)}>{l.from}</button>)}</div>}
          </div>
        )}
        {browseLoading ? <div className="panel-loading">Loading…</div>
          : browseEntries.length === 0 ? <div className="panel-empty">No commentary entries found for {browseFather}</div>
          : <><div className="list-count">{browseEntries.length} entries</div>{browseEntries.map(card)}</>}
      </div>
    )
  }

  // ── Browse: father list
  if (mode === 'browse') {
    return (
      <div className="panel-body">
        {modeToggle}
        <input className="panel-search" placeholder="Search fathers…" value={fatherQuery} onChange={e => setFatherQuery(e.target.value)} spellCheck={false} />
        <TraditionChips value={tradition} onChange={setTradition} />
        {fathers.length === 0 && <div className="panel-empty">No fathers match "{fatherQuery}"</div>}
        {fathers.map(([name, i]) => (
          <button key={name} className="father-row" onClick={() => openFather(name)}>
            <span className="father-row-main">
              <span className="father-row-name">{name}</span>
              {i.role && <span className="father-row-role">{i.role}</span>}
              <span className="father-row-meta">{i.location ? `${i.location} · ` : ''}{i.dates}</span>
            </span>
            {i.tradition && <span className="tradition-badge" style={{ color: TRADITION_COLORS[i.tradition] }}>{i.tradition}</span>}
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    )
  }

  // ── This verse (+ corpus search)
  const searchResults = results && tradition ? results.filter(e => getFatherInfo(e.father_name)?.tradition === tradition) : results
  const keys = Object.keys(consensus).filter(k => k !== 'Other')
  return (
    <div className="panel-body">
      {modeToggle}
      <Chips small value={source} onChange={setSource} options={[{ value: 'fathers', label: 'Hand-picked' }, { value: 'legacy', label: 'Legacy' }]} />
      {source === 'legacy' && <p className="source-note">Legacy collection (HCF and e-Catena) — a wider historical range, less tightly matched to each verse than the hand-picked set.</p>}
      {(keys.length > 0 || consensus.Other) && (
        <div className="consensus-bar">
          {keys.map(t => <span key={t} className="consensus-item"><span className="tradition-dot" style={{ background: TRADITION_COLORS[t] ?? '#94a3b8' }} />{t} <b>{consensus[t]}</b></span>)}
          {consensus.Other ? <span className="consensus-item"><span className="tradition-dot" style={{ background: '#94a3b8' }} />Other <b>{consensus.Other}</b></span> : null}
        </div>
      )}
      <input className="panel-search" placeholder="Search all commentaries…" value={query} onChange={e => setQuery(e.target.value)} spellCheck={false} />
      <TraditionChips value={tradition} onChange={setTradition} />
      {searchResults ? (
        searchResults.length === 0 ? <div className="panel-empty">No {tradition ?? ''} commentary matches "{query}"</div>
          : <><div className="list-count">{searchResults.length}{searchResults.length === 150 ? '+' : ''} results</div>{searchResults.map(card)}</>
      ) : loading ? <div className="panel-loading">Loading…</div>
        : entries.length === 0 ? <div className="panel-empty">No {source === 'fathers' ? 'hand-picked' : 'legacy'} commentary recorded for {verseRef} — try "{source === 'fathers' ? 'Legacy' : 'Hand-picked'}".</div>
        : filtered.length === 0 ? <div className="panel-empty">No {tradition} commentary recorded for {verseRef}</div>
        : filtered.map(e => <EntryCard key={e.id} entry={e} book={selected.book} chapter={selected.chapter} verse={selected.verse} onNavigate={onNavigate} onOpenFather={openFather} />)}
    </div>
  )
}
