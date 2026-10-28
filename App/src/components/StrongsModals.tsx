// Strong's entry, concordance and translation-variants dialogs — ported from the Android
// reader's StrongsModal and WordStudyPanel's StrongsConcordanceModal / TranslationVariantsModal.
import { useEffect, useMemo, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { getStrongsConcordance, getStrongsEntry } from '../db/queries'
import type { StrongsConcordanceResult, StrongsEntry } from '../db/queries'
import { stripUsfm } from '../data/redLetter'
import { BOOKS } from '../data/books'
import { escapeRegex } from '../utils/regex'
import { Chips, Modal } from './Modal'

const NT_BOOKS = new Set(BOOKS.filter(b => b.testament === 'NT').map(b => b.name))
type Testament = 'all' | 'OT' | 'NT'
type Nav = (book: string, chapter: number, verse: number) => void

export type StrongsLang = 'greek' | 'hebrew' | 'lxx' | 'lxx_a'

/** Loads entry + concordance for a Strong's number; shared by the reader popup and Words tab. */
export function useStrongsData(strongs: string | null, lang: StrongsLang = strongs?.startsWith('H') ? 'hebrew' : 'greek', greekSource: 'sblgnt' | 'tagnt' | 'tr' = 'sblgnt') {
  const [entry, setEntry] = useState<StrongsEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [conc, setConc] = useState<StrongsConcordanceResult[]>([])
  const [concLoading, setConcLoading] = useState(false)

  useEffect(() => {
    setEntry(null); setConc([])
    if (!strongs) return
    let live = true
    setLoading(true); setConcLoading(true)
    const type = lang === 'hebrew' ? 'hebrew' : 'greek'
    getStrongsEntry(bibleDb, type, strongs).then(e => { if (live) { setEntry(e); setLoading(false) } }).catch(() => live && setLoading(false))
    getStrongsConcordance(bibleDb, lang, strongs, greekSource).then(r => { if (live) { setConc(r); setConcLoading(false) } }).catch(() => live && setConcLoading(false))
    return () => { live = false }
  }, [strongs, lang, greekSource])

  return { entry, loading, conc, concLoading }
}

/** Reader popup for a tapped Strong's tag. */
export function StrongsDialog({ strongs, onClose, onNavigate, onOpenWordStudy }: {
  strongs: string | null
  onClose: () => void
  onNavigate: Nav
  onOpenWordStudy: (strongs: string) => void
}) {
  const { entry, loading, conc, concLoading } = useStrongsData(strongs)
  const [view, setView] = useState<'entry' | 'conc' | 'variants'>('entry')
  useEffect(() => setView('entry'), [strongs])
  if (!strongs) return null
  const lang = strongs.startsWith('H') ? 'hebrew' : 'greek'
  const translit = entry?.translit || conc.find(r => r.translit)?.translit || ''

  if (view === 'conc') {
    return <StrongsConcordanceModal open lemma={entry?.lemma ?? strongs} translit={translit} lang={lang}
      results={conc} loading={concLoading} onClose={() => setView('entry')} onNavigate={(b, c, v) => { onClose(); onNavigate(b, c, v) }} />
  }
  if (view === 'variants') {
    return <TranslationVariantsModal open results={conc} entry={entry} strongs={strongs}
      onClose={() => setView('entry')} onNavigate={(b, c, v) => { onClose(); onNavigate(b, c, v) }} />
  }
  return (
    <Modal open onClose={onClose} title={entry ? <>{entry.lemma} <span className="strongs-num">{entry.number}</span></> : loading ? 'Loading…' : strongs}>
      {loading ? <div className="panel-loading">Loading…</div> : !entry ? <div className="panel-empty">No entry found for {strongs}</div> : (
        <>
          {(entry.translit || entry.pronunciation || translit) && (
            <div className="strongs-pron">{[entry.translit || translit, entry.pronunciation].filter(Boolean).join('  ·  ')}</div>
          )}
          <p className="strongs-def">{entry.definition}</p>
          {entry.kjv_usage && <p className="strongs-kjv">KJV: {entry.kjv_usage}</p>}
          <div className="dlg-actions">
            <button className="btn" onClick={() => setView('conc')}>{concLoading ? '…' : `${conc.length} occurrence${conc.length !== 1 ? 's' : ''}`} →</button>
            <button className="btn" onClick={() => setView('variants')}>See uses / translations</button>
            <button className="btn btn--primary" onClick={() => { onClose(); onOpenWordStudy(strongs) }}>Open in Word Study</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function StrongsConcordanceModal({ open, lemma, translit, lang, results, loading, onClose, onNavigate }: {
  open: boolean
  lemma: string
  translit: string
  lang: StrongsLang
  results: StrongsConcordanceResult[]
  loading: boolean
  onClose: () => void
  onNavigate: Nav
}) {
  const [testament, setTestament] = useState<Testament>('all')
  const [books, setBooks] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  useEffect(() => { if (open) { setTestament('all'); setBooks(new Set()); setCollapsed(new Set()); setFilterOpen(false) } }, [open])

  const filtered = useMemo(() => {
    if (books.size) return results.filter(r => books.has(r.book))
    if (testament === 'NT') return results.filter(r => NT_BOOKS.has(r.book))
    if (testament === 'OT') return results.filter(r => !NT_BOOKS.has(r.book))
    return results
  }, [results, testament, books])

  const groups = useMemo(() => {
    const m = new Map<string, StrongsConcordanceResult[]>()
    for (const r of filtered) (m.get(r.book) ?? m.set(r.book, []).get(r.book)!).push(r)
    return [...m.entries()]
  }, [filtered])

  const total = results.reduce((s, r) => s + r.word_count, 0)
  const shown = filtered.reduce((s, r) => s + r.word_count, 0)
  const hasFilter = testament !== 'all' || books.size > 0
  const bookChoices = testament === 'all' ? [] : BOOKS.filter(b => b.testament === testament).map(b => b.name)
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n }

  return (
    <Modal open={open} onClose={onClose} wide title={
      <div>
        <div>{lemma}</div>
        <div className="dlg-subtitle">
          {translit} · {lang === 'hebrew' ? 'Hebrew' : 'Greek'} · {hasFilter
            ? `${filtered.length} of ${results.length} verses · ${shown} of ${total} matches`
            : `${results.length} verse${results.length !== 1 ? 's' : ''} · ${total} matches`}
        </div>
      </div>
    }>
      <div className="conc-toolbar">
        <button className={`btn btn--small${hasFilter ? ' btn--primary' : ''}`} onClick={() => setFilterOpen(o => !o)}>Filter</button>
        {hasFilter && <button className="btn btn--small" onClick={() => { setTestament('all'); setBooks(new Set()) }}>Clear</button>}
      </div>
      {filterOpen && (
        <div className="conc-filter">
          <Chips value={testament} onChange={t => { setTestament(t); setBooks(new Set()) }}
            options={[{ value: 'all', label: 'All' }, { value: 'OT', label: 'Old Testament' }, { value: 'NT', label: 'New Testament' }]} />
          {bookChoices.length > 0 && (
            <div className="chip-wrap">
              {bookChoices.map(b => (
                <button key={b} className={`chip chip--small${books.has(b) ? ' chip--active' : ''}`} onClick={() => setBooks(s => toggle(s, b))}>{b}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {loading ? <div className="panel-loading">Loading…</div> : filtered.length === 0 ? <div className="panel-empty">No results for selected filter</div> : (
        <div className="conc-list">
          {groups.map(([book, rows]) => (
            <div key={book}>
              <button className="conc-book" onClick={() => setCollapsed(s => toggle(s, book))}>
                <span>{book}</span>
                <span className="conc-book-count">{rows.reduce((s, r) => s + r.word_count, 0)} {collapsed.has(book) ? '▸' : '▾'}</span>
              </button>
              {!collapsed.has(book) && rows.map(r => (
                <button key={`${r.chapter}:${r.verse}`} className="conc-row" onClick={() => { onNavigate(r.book, r.chapter, r.verse); onClose() }}>
                  <span className="conc-ref">{r.book} {r.chapter}:{r.verse}</span>
                  {r.word && <span className="conc-word">{r.word}  {r.translit}</span>}
                  <span className="conc-text">{stripUsfm(r.text)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// KJV+ puts the Strong's tag right after the English word it translates.
function extractKjvTranslation(kjvPlusText: string | null, re: RegExp): string | null {
  if (!kjvPlusText) return null
  const m = kjvPlusText.match(re)
  if (!m) return null
  if (/^[GH]\d+$/i.test(m[1])) return null
  const word = m[1].replace(/[{}()[\]]/g, '').replace(/[^a-z']/gi, '').toLowerCase()
  return word || null
}

function HighlightedVerse({ text, word }: { text: string; word: string | null }) {
  if (!word) return <span className="conc-text">{text}</span>
  const parts = text.split(new RegExp(`(${escapeRegex(word)})`, 'gi'))
  return <span className="conc-text">{parts.map((p, i) => i % 2 ? <mark key={i}>{p}</mark> : p)}</span>
}

export function TranslationVariantsModal({ open, onClose, results, entry, strongs, onNavigate }: {
  open: boolean
  onClose: () => void
  results: StrongsConcordanceResult[]
  entry: StrongsEntry | null
  strongs: string
  onNavigate: Nav
}) {
  const [gloss, setGloss] = useState<string | null>(null)
  useEffect(() => { if (!open) setGloss(null) }, [open])

  const { groups, groupMap } = useMemo(() => {
    const re = strongs ? new RegExp(`(\\S+)\\s+${strongs.toUpperCase()}(?=\\s|$)`, 'i') : null
    const map = new Map<string, StrongsConcordanceResult[]>()
    for (const r of results) {
      const key = re ? extractKjvTranslation(r.kjvPlusText, re) ?? '(other)' : '(other)'
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(r)
    }
    return { groups: [...map.entries()].sort((a, b) => b[1].length - a[1].length), groupMap: map }
  }, [results, strongs])

  return (
    <Modal open={open} onClose={onClose} wide title={gloss
      ? <button className="link-btn" onClick={() => setGloss(null)}>‹ "{gloss}"</button>
      : <div><div>{entry ? `${entry.lemma}  ${strongs}` : strongs}</div>
          <div className="dlg-subtitle">Translation variants · {results.length} occurrence{results.length !== 1 ? 's' : ''}</div></div>}>
      <div className="conc-list">
        {gloss
          ? (groupMap.get(gloss) ?? []).map(r => (
            <button key={`${r.book}${r.chapter}:${r.verse}`} className="conc-row" onClick={() => { onNavigate(r.book, r.chapter, r.verse); onClose() }}>
              <span className="conc-ref">{r.book} {r.chapter}:{r.verse}</span>
              {r.word && <span className="conc-word">{r.word}  {r.translit}</span>}
              <HighlightedVerse text={stripUsfm(r.text)} word={gloss === '(other)' ? null : gloss} />
            </button>
          ))
          : groups.map(([g, rows]) => (
            <button key={g} className="variant-row" onClick={() => setGloss(g)}>
              <span>{g}</span><span className="variant-count">{rows.length}× ›</span>
            </button>
          ))}
      </div>
    </Modal>
  )
}
