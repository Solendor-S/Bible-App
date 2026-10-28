// Historical tab — port of the Android StudyScreen HistoricalPanel: Josephus, extra-biblical
// sources and textual variants for the verse, or browse all sources by testament.
import { useEffect, useMemo, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { getJosephusForVerse, getVariantsForVerse } from '../db/queries'
import type { JosephusEntry } from '../db/queries'
import { CATEGORY_LABEL, HISTORICAL_SOURCES, getHistoricalForVerse } from '../data/historicalData'
import type { HistoricalSource } from '../data/historicalData'
import { Chips } from './Modal'
import type { SelectedVerse, TextualVariant } from '../types'

const CATEGORY_COLOR: Record<string, string> = {
  ancient_author: 'var(--accent)', archaeology: '#6dbf6d', manuscript: '#7ab8e8', inscription: '#b07ee8',
}
const VARIANT_BADGE_COLOR: Record<string, string> = {
  K: '#b07ee8', D: '#6dbf6d', A: '#7ab8e8', B: '#7ab8e8', C: '#7ab8e8', H: '#b07ee8', S: '#b07ee8', L: '#7ab8e8',
  X: '#e8c47a', E: '#e89a7a', R: '#e89a7a', WH: '#6dbf6d', Treg: '#7ab8e8', RP: '#b07ee8', NIV: '#e8c47a',
}
const PREVIEW = 280

function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const more = text.length > PREVIEW
  return (
    <>
      <p className="hist-body">{open || !more ? text : text.slice(0, PREVIEW) + '…'}</p>
      {more && <button className="expand-inline-btn" onClick={() => setOpen(o => !o)}>{open ? '▲ Show less' : '▼ Show more'}</button>}
    </>
  )
}

function Badge({ color, children }: { color: string; children: string }) {
  return <span className="hist-badge" style={{ color, borderColor: color }}>{children}</span>
}

function HistoricalCard({ e }: { e: HistoricalSource }) {
  return (
    <div className="hist-card">
      <div className="hist-title">{e.title}{e.author && <span className="hist-author"> · {e.author}</span>}</div>
      <div className="hist-meta"><Badge color={CATEGORY_COLOR[e.category]}>{CATEGORY_LABEL[e.category]}</Badge> {e.date_desc}{e.location ? ` · ${e.location}` : ''}</div>
      <Expandable text={e.description} />
      <div className="hist-significance"><div className="section-label">Significance</div>{e.significance}</div>
      <div className="hist-citation">{e.citation}</div>
    </div>
  )
}

function JosephusCard({ e }: { e: JosephusEntry }) {
  return (
    <div className="hist-card">
      <div className="hist-title">{e.ref}<span className="hist-author"> · {e.work}</span></div>
      <div className="hist-meta"><Badge color={CATEGORY_COLOR.ancient_author}>Ancient Author</Badge> c. 37–100 AD · Rome / Judaea</div>
      {e.note && <div className="hist-significance"><div className="section-label">Context</div>{e.note}</div>}
      <Expandable text={e.text} />
    </div>
  )
}

function VariantCard({ v }: { v: TextualVariant }) {
  const color = VARIANT_BADGE_COLOR[v.variant_source] ?? 'var(--accent)'
  const isOT = v.testament === 'ot'
  return (
    <div className="variant-card">
      <div className="variant-head"><Badge color={color}>{v.variant_source}</Badge> <span>{v.variant_source_label}</span>{v.word_ref && <span className="variant-word">{v.word_ref}</span>}</div>
      {v.description && <p className="hist-body">{v.description}</p>}
      {(v.main_english || v.main_hebrew) && (
        <div className="variant-reading"><span className="section-label">Standard</span>
          {isOT && v.main_hebrew && <span className="verse-rtl">{v.main_hebrew}</span>}{v.main_english && <span>{v.main_english}</span>}</div>
      )}
      {(v.variant_english || v.variant_hebrew) && (
        <div className="variant-reading variant-reading--alt"><span className="section-label">Variant</span>
          {isOT && v.variant_hebrew && <span className="verse-rtl">{v.variant_hebrew}</span>}{v.variant_english && <span>{v.variant_english}</span>}</div>
      )}
    </div>
  )
}

export function HistoricalPanel({ selected }: { selected: SelectedVerse }) {
  const [mode, setMode] = useState<'verse' | 'browse'>('verse')
  const [jos, setJos] = useState<JosephusEntry[]>([])
  const [variants, setVariants] = useState<TextualVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState({ ot: true, nt: true, var: true })
  const historical = useMemo(() => getHistoricalForVerse(selected.book, selected.chapter, selected.verse), [selected.book, selected.chapter, selected.verse])

  useEffect(() => {
    if (mode !== 'verse') return
    let live = true
    setLoading(true)
    Promise.all([
      getJosephusForVerse(bibleDb, selected.book, selected.chapter, selected.verse),
      getVariantsForVerse(bibleDb, selected.book, selected.chapter, selected.verse),
    ]).then(([j, v]) => { if (live) { setJos(j); setVariants(v); setLoading(false) } }).catch(() => live && setLoading(false))
    return () => { live = false }
  }, [mode, selected.book, selected.chapter, selected.verse])

  const ot = useMemo(() => HISTORICAL_SOURCES.filter(s => s.testament === 'ot').sort((a, b) => a.sort_year - b.sort_year), [])
  const nt = useMemo(() => HISTORICAL_SOURCES.filter(s => s.testament === 'nt').sort((a, b) => a.sort_year - b.sort_year), [])
  const toggle = (k: keyof typeof open) => setOpen(o => ({ ...o, [k]: !o[k] }))

  return (
    <div className="panel-body">
      <Chips value={mode} onChange={setMode} options={[{ value: 'verse', label: 'Verse' }, { value: 'browse', label: 'Browse All' }]} />
      {mode === 'verse' ? (
        loading ? <div className="panel-loading">Loading…</div>
          : !jos.length && !historical.length && !variants.length ? <div className="panel-empty">No external sources recorded for this verse</div>
          : <>
              {jos.map((e, i) => <JosephusCard key={i} e={e} />)}
              {historical.map(e => <HistoricalCard key={e.source_key} e={e} />)}
              {variants.length > 0 && (
                <>
                  <button className="section-toggle" onClick={() => toggle('var')}>{open.var ? '▾' : '▸'} Textual Variants <span className="count-pill">{variants.length}</span></button>
                  {open.var && variants.map(v => <VariantCard key={v.id} v={v} />)}
                </>
              )}
            </>
      ) : (
        <>
          <button className="section-toggle" onClick={() => toggle('ot')}>{open.ot ? '▾' : '▸'} Old Testament <span className="count-pill">{ot.length} sources</span></button>
          {open.ot && ot.map(e => <HistoricalCard key={e.source_key} e={e} />)}
          <button className="section-toggle" onClick={() => toggle('nt')}>{open.nt ? '▾' : '▸'} New Testament <span className="count-pill">{nt.length} sources + Josephus</span></button>
          {open.nt && nt.map(e => <HistoricalCard key={e.source_key} e={e} />)}
          {open.nt && <p className="source-note">Flavius Josephus (c. 37–100 AD) references appear in Verse mode when you select a verse. His works — <i>Antiquities of the Jews</i> and <i>The Jewish War</i> — are the primary non-biblical source for the NT world.</p>}
        </>
      )}
    </div>
  )
}
