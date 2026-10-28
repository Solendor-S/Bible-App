// Search — port of the Android SearchScreen (modes, scope, Greek/Hebrew script, Strong's tags,
// fuzzy correction, recent searches, jump-to refs, book breakdown, Strong's word map), plus the
// desktop commentary search tab.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bibleDb, userDb } from '../db/sqlite'
import {
  addSearchHistory, deleteSearchHistory, detectQueryScript, getCommentaryFatherNames, getSearchHistory,
  searchAnnotatedByStrongs, searchCommentary, searchOriginalLanguage, searchStrongsByEnglishWord, searchVerses, searchVersesAll,
  searchVersesFuzzy, SEARCH_STOP_WORDS,
} from '../db/queries'
import type { CommentaryEntryWithRef, StrongsWordMatch } from '../db/queries'
import { matchBookRefs } from '../lib/matchBookRefs'
import type { BookRef } from '../lib/matchBookRefs'
import { BOOKS, BOOK_ORDER } from '../data/books'
import { stripUsfm } from '../data/redLetter'
import { TRANSLATIONS } from '../data/translations'
import { escapeRegex } from '../utils/regex'
import { usePref } from '../context/Prefs'
import { Chips, Modal } from './Modal'
import { StrongsDialog } from './StrongsModals'
import { EntryCard } from './EntryCard'
import type { SearchResult } from '../types'

type Nav = (book: string, chapter: number, verse: number) => void
type Testament = 'all' | 'OT' | 'NT'
const WORD_TOKEN_RE = /[hg]\d+|[a-z']+/gi
const OT_BOOKS = BOOKS.filter(b => b.testament === 'OT').map(b => b.name)
const NT_BOOKS = BOOKS.filter(b => b.testament === 'NT').map(b => b.name)

function matchesQueryWords(text: string, qWords: string[]): boolean {
  const tokens = text.toLowerCase().match(WORD_TOKEN_RE) ?? ([] as string[])
  return qWords.some(w => {
    if (tokens.includes(w)) return true
    const m = w.match(/^([hg])(\d+)$/i)
    return !!m && tokens.includes((m[1] + String(parseInt(m[2])).padStart(4, '0')).toLowerCase())
  })
}
const sigWords = (q: string[]) => { const s = q.filter(w => !SEARCH_STOP_WORDS.has(w)); return s.length ? s : q }
const booksFor = (t: Testament, sel: Set<string>) => sel.size ? [...sel] : t === 'OT' ? OT_BOOKS : t === 'NT' ? NT_BOOKS : []
const formatRef = (r: BookRef) => !r.chapterSpecified ? r.book : !r.verse ? `${r.book} ${r.chapter}` : `${r.book} ${r.chapter}:${r.verse}${r.verseEnd ? `–${r.verseEnd}` : ''}`

function Highlighted({ text, re, onStrongs, searchedTags }: { text: string; re: RegExp | null; onStrongs?: (s: string) => void; searchedTags: Set<string> }) {
  const clean = stripUsfm(text).replace(/[{}]/g, '').replace(/¶\s*/g, '')
  const tagged = clean.split(/\b([HG]\d+)\b/)
  return (
    <>
      {tagged.map((seg, i) => {
        if (i % 2) {
          if (!onStrongs) return null
          const bare = seg[0] + parseInt(seg.slice(1))
          return <sup key={i} className={`strongs-tag${searchedTags.has(bare) ? ' strongs-tag--hit' : ''}`} onClick={e => { e.stopPropagation(); onStrongs(seg) }}>{seg}</sup>
        }
        if (!re) return seg
        return seg.split(re).map((p, j) => j % 2 ? <mark key={`${i}-${j}`}>{p}</mark> : p)
      })}
    </>
  )
}

export function SearchModal({ open, onClose, onNavigate, onOpenWordStudy, onShowEntry, initialTranslation }: {
  open: boolean
  onClose: () => void
  onNavigate: Nav
  onOpenWordStudy: (strongs: string) => void
  onShowEntry: (e: CommentaryEntryWithRef) => void
  initialTranslation: string
}) {
  const [tab, setTab] = useState<'scripture' | 'commentary'>('scripture')
  const [query, setQuery] = useState('')
  const [translation, setTranslation] = useState(initialTranslation)
  const [mode] = usePref('search_mode')
  const [biblicalOrder] = usePref('search_biblical_order')
  const [strongsInSearch] = usePref('strongs_in_search')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [script, setScript] = useState<'latin' | 'greek' | 'hebrew'>('latin')
  const [corrected, setCorrected] = useState<string[]>([])
  const [testament, setTestament] = useState<Testament>('all')
  const [books, setBooks] = useState<Set<string>>(new Set())
  const [scopeOpen, setScopeOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [breakdown, setBreakdown] = useState<{ book: string; verses: number; matches: number; rows: SearchResult[] }[] | null>(null)
  const [breakdownBook, setBreakdownBook] = useState<string | null>(null)
  const [wordMap, setWordMap] = useState<{ word: string; matches: StrongsWordMatch[] }[] | null>(null)
  const [strongs, setStrongs] = useState<string | null>(null)
  const [commentary, setCommentary] = useState<CommentaryEntryWithRef[]>([])
  const [fathers, setFathers] = useState<string[]>([])
  const [father, setFather] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQuery = useRef('')

  useEffect(() => {
    if (!open) return
    setTranslation(TRANSLATIONS.some(t => t.key === initialTranslation && !t.apiOnly) ? initialTranslation : 'KJV')
    getSearchHistory(userDb).then(setHistory)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, initialTranslation])
  useEffect(() => { if (tab === 'commentary' && !fathers.length) getCommentaryFatherNames(bibleDb).then(setFathers) }, [tab, fathers.length])

  const q = query.trim()
  const bookRefs = useMemo(() => tab === 'scripture' ? matchBookRefs(q) : [], [q, tab])
  const wordBoundary = mode === 'exact_words' || mode === 'exact_all_words'
  const highlightRe = useMemo(() => {
    if (script !== 'latin') return null
    let terms = corrected.length ? corrected : lastQuery.current.split(/\s+/).filter(Boolean)
    if (wordBoundary) { const s = terms.filter(w => !SEARCH_STOP_WORDS.has(w.toLowerCase())); if (s.length) terms = s }
    if (!terms.length) return null
    const esc = terms.map(escapeRegex).join('|')
    return wordBoundary ? new RegExp(`(\\b(?:${esc})\\b)`, 'gi') : new RegExp(`(${esc})`, 'gi')
  }, [script, corrected, wordBoundary, results])
  const searchedTags = useMemo(() => new Set(lastQuery.current.split(/\s+/).map(w => w.match(/^([hg])(\d+)$/i)).filter(Boolean).map(m => m![1].toUpperCase() + parseInt(m![2]))), [results])
  const shown = useMemo(() => !biblicalOrder ? results : [...results].sort((a, b) =>
    (BOOK_ORDER.get(a.book) ?? 999) - (BOOK_ORDER.get(b.book) ?? 999) || a.chapter - b.chapter || a.verse - b.verse), [results, biblicalOrder])

  const filterRows = useCallback((rows: SearchResult[], text: string) => {
    const qw = text.toLowerCase().split(/\s+/).filter(Boolean)
    if (mode === 'exact_words') { const sw = sigWords(qw); return rows.filter(r => matchesQueryWords(r.text, sw)) }
    if (mode === 'exact_all_words') { const sw = sigWords(qw); return rows.filter(r => { const t = r.text.toLowerCase().match(WORD_TOKEN_RE) ?? ([] as string[]); return sw.every(w => t.includes(w)) }) }
    if (mode === 'exact_phrase') return rows.filter(r => r.text.toLowerCase().includes(text.toLowerCase()))
    return rows
  }, [mode])

  const doSearch = useCallback(async (text: string, trans = translation, test = testament, sel = books) => {
    const t = text.trim()
    if (!t) return
    setLoading(true); setSearched(true); setCorrected([]); setBreakdown(null)
    lastQuery.current = t
    addSearchHistory(userDb, t)
    setHistory(h => [t, ...h.filter(x => x !== t)].slice(0, 20))
    if (tab === 'commentary') {
      const rows = await searchCommentary(bibleDb, t)
      setCommentary(rows); setLoading(false); return
    }
    const bks = booksFor(test, sel)
    const sc = detectQueryScript(t)
    setScript(sc)
    if (sc !== 'latin') { setResults(await searchOriginalLanguage(bibleDb, t, sc, bks, trans)); setLoading(false); return }
    if (/^[hg]\d+$/i.test(t) && ['TR+', 'WLC+', 'LXX+'].includes(trans)) { setResults(await searchAnnotatedByStrongs(bibleDb, t, trans, bks)); setLoading(false); return }
    const rows = await searchVerses(bibleDb, t, trans, bks, 200, wordBoundary)
    if (mode !== 'fuzzy') { setResults(filterRows(rows, t)); setLoading(false); return }
    // Fuzzy: correct each typo'd word individually, then re-search
    const qw = t.toLowerCase().split(/\s+/).filter(Boolean)
    const hasTypo = qw.some(w => w.length >= 4 && !rows.some(r => r.text.toLowerCase().includes(w)))
    if (hasTypo || !rows.length) {
      const fixed = await Promise.all(qw.map(async w => w.length < 4 || rows.some(r => r.text.toLowerCase().includes(w)) ? w
        : (await searchVersesFuzzy(bibleDb, w, trans, bks))[0]?.closestWords[0] ?? w))
      if (fixed.some((w, i) => w !== qw[i])) {
        const again = await searchVerses(bibleDb, fixed.join(' '), trans, bks, 200, false)
        setResults(again.length ? again : rows)
        if (again.length) setCorrected(fixed)
      } else setResults(rows)
    } else setResults(rows)
    setLoading(false)
  }, [translation, testament, books, tab, wordBoundary, mode, filterRows])

  async function openBreakdown() {
    setBreakdown([])
    const all = filterRows(await searchVersesAll(bibleDb, lastQuery.current, translation, booksFor(testament, books), wordBoundary), lastQuery.current)
    const qw = lastQuery.current.toLowerCase().split(/\s+/).filter(Boolean)
    const m = new Map<string, { verses: number; matches: number; rows: SearchResult[] }>()
    for (const r of all) {
      const toks = r.text.toLowerCase().match(WORD_TOKEN_RE) ?? ([] as string[])
      const e = m.get(r.book) ?? m.set(r.book, { verses: 0, matches: 0, rows: [] }).get(r.book)!
      e.verses++; e.matches += qw.reduce((s, w) => s + toks.filter(x => x === w).length, 0); e.rows.push(r)
    }
    setBreakdown([...m.entries()].map(([book, v]) => ({ book, ...v })).sort((a, b) => (BOOK_ORDER.get(a.book) ?? 999) - (BOOK_ORDER.get(b.book) ?? 999)))
  }

  async function openWordMap() {
    setWordMap([])
    const words = [...new Set(q.toLowerCase().split(/\s+/).filter(w => w && !SEARCH_STOP_WORDS.has(w)))]
    setWordMap(await Promise.all(words.map(async word => ({ word, matches: await searchStrongsByEnglishWord(bibleDb, word) }))))
  }

  const go: Nav = (b, c, v) => { onClose(); onNavigate(b, c, v) }
  const hasScope = testament !== 'all' || books.size > 0
  const scopeLabel = books.size ? (books.size <= 2 ? [...books].join(', ') : `${books.size} books`) : testament === 'OT' ? 'Old Testament' : testament === 'NT' ? 'New Testament' : 'All Books'
  const commentaryShown = father ? commentary.filter(c => c.father_name === father) : commentary

  return (
    <Modal open={open} onClose={onClose} wide className="search-dlg" title={
      <Chips value={tab} onChange={t => { setTab(t); setSearched(false) }} options={[{ value: 'scripture', label: 'Scripture' }, { value: 'commentary', label: 'Commentary' }]} />
    }>
      <div className="search-bar">
        <input ref={inputRef} className="modal-input" value={query} onChange={e => setQuery(e.target.value)} spellCheck={false}
          placeholder={tab === 'scripture' ? 'Search the Bible… (words, phrase, Greek/Hebrew, or G26 / H430)' : 'Search all Church Fathers commentary…'}
          onKeyDown={e => e.key === 'Enter' && doSearch(query)} />
        <button className="btn btn--primary" onClick={() => doSearch(query)}>Search</button>
      </div>
      {tab === 'scripture' && (
        <div className="search-filters">
          <button className={`btn btn--small${hasScope ? ' btn--primary' : ''}`} onClick={() => setScopeOpen(o => !o)}>⏷ {scopeLabel}</button>
          <select className="map-select" value={translation} onChange={e => { setTranslation(e.target.value); if (searched) doSearch(query, e.target.value) }}>
            {TRANSLATIONS.filter(t => !t.apiOnly).map(t => <option key={t.key} value={t.key}>{t.label} — {t.full}</option>)}
          </select>
          <span className="muted">Mode: {mode.replace(/_/g, ' ')} (Settings)</span>
        </div>
      )}
      {tab === 'commentary' && fathers.length > 0 && (
        <div className="search-filters">
          <select className="map-select" value={father} onChange={e => setFather(e.target.value)}>
            <option value="">All fathers</option>
            {fathers.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}
      {scopeOpen && tab === 'scripture' && (
        <div className="conc-filter">
          <Chips value={testament} onChange={t => { setTestament(t); setBooks(new Set()) }} options={[{ value: 'all', label: 'All' }, { value: 'OT', label: 'Old Testament' }, { value: 'NT', label: 'New Testament' }]} />
          {testament !== 'all' && <div className="chip-wrap">{(testament === 'OT' ? OT_BOOKS : NT_BOOKS).map(b => (
            <button key={b} className={`chip chip--small${books.has(b) ? ' chip--active' : ''}`} onClick={() => setBooks(s => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n })}>{b}</button>
          ))}</div>}
          <div className="dlg-actions">
            <button className="btn" onClick={() => { setTestament('all'); setBooks(new Set()) }}>Clear</button>
            <button className="btn btn--primary" onClick={() => { setScopeOpen(false); if (searched) doSearch(query) }}>Apply</button>
          </div>
        </div>
      )}

      {bookRefs.length > 0 && (
        <div className="jump-row"><span className="section-label">Jump to</span>
          {bookRefs.map((r, i) => <button key={i} className="chip chip--small" onClick={() => go(r.book, r.chapter, r.verse ?? 1)}>{formatRef(r)}</button>)}
        </div>
      )}

      <div className="modal-results">
        {!searched && history.length > 0 && (
          <div>
            <div className="row-between"><span className="section-label">Recent searches</span>
              <button className="link-btn" onClick={() => { deleteSearchHistory(userDb); setHistory([]) }}>Clear</button></div>
            {history.map(h => (
              <div key={h} className="history-row">
                <button className="link-btn" onClick={() => { setQuery(h); doSearch(h) }}>{h}</button>
                <button className="lib-remove" onClick={() => { deleteSearchHistory(userDb, h); setHistory(x => x.filter(y => y !== h)) }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {loading && <div className="panel-loading">Searching…</div>}
        {!loading && searched && tab === 'commentary' && (
          commentaryShown.length === 0 ? <div className="panel-empty">No commentary matches "{lastQuery.current}"</div> : <>
            <div className="list-count">{commentaryShown.length}{commentary.length === 150 ? '+' : ''} results</div>
            {commentaryShown.map(e => (
              <div key={`${e.id}-${e.book}-${e.chapter}-${e.verse}`} onDoubleClick={() => { onClose(); onShowEntry(e) }}>
                <EntryCard entry={e} book={e.book} chapter={e.chapter} verse={e.verse} verseRef={`${e.book} ${e.chapter}:${e.verse}`} onNavigate={go} />
              </div>
            ))}
          </>
        )}
        {!loading && searched && tab === 'scripture' && (
          <>
            {corrected.length > 0 && <div className="source-note">Showing results for <b>{corrected.join(' ')}</b></div>}
            <div className="row-between">
              <span className="list-count">{results.length === 200 ? '200+' : results.length} verse{results.length !== 1 ? 's' : ''}</span>
              {script === 'latin' && results.length > 0 && (
                <span>
                  <button className="link-btn" onClick={openBreakdown}>See all by book</button>{' · '}
                  <button className="link-btn" onClick={openWordMap}>See Strong's</button>
                </span>
              )}
            </div>
            {shown.length === 0 && <div className="panel-empty">No verses found for "{lastQuery.current}"</div>}
            {shown.map(r => (
              <button key={`${r.book}${r.chapter}:${r.verse}`} className="search-result" onClick={() => go(r.book, r.chapter, r.verse)}>
                <span className="conc-ref">{r.book} {r.chapter}:{r.verse}</span>
                <span className={`conc-text${script === 'hebrew' ? ' verse-rtl' : ''}`}>
                  <Highlighted text={script === 'latin' ? r.text : r.text} re={script === 'latin' ? highlightRe
                    : new RegExp(`(${lastQuery.current.split(/\s+/).map(escapeRegex).join('|')})`, 'gi')}
                    onStrongs={strongsInSearch ? setStrongs : undefined} searchedTags={searchedTags} />
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <Modal open={breakdown !== null} onClose={() => { setBreakdown(null); setBreakdownBook(null) }} wide
        title={breakdownBook ? <button className="link-btn" onClick={() => setBreakdownBook(null)}>‹ {breakdownBook}</button> : `"${lastQuery.current}" by book`}>
        {breakdown && !breakdown.length ? <div className="panel-loading">Counting…</div> : breakdownBook
          ? breakdown!.find(b => b.book === breakdownBook)!.rows.map(r => (
            <button key={`${r.chapter}:${r.verse}`} className="search-result" onClick={() => { setBreakdown(null); go(r.book, r.chapter, r.verse) }}>
              <span className="conc-ref">{r.book} {r.chapter}:{r.verse}</span><span className="conc-text"><Highlighted text={r.text} re={highlightRe} searchedTags={searchedTags} /></span>
            </button>))
          : breakdown?.map(b => (
            <button key={b.book} className="variant-row" onClick={() => setBreakdownBook(b.book)}>
              <span>{b.book}</span><span className="variant-count">{b.verses} verses · {b.matches} matches ›</span>
            </button>
          ))}
      </Modal>

      <Modal open={wordMap !== null} onClose={() => setWordMap(null)} wide title="Strong's for this search">
        {wordMap && !wordMap.length ? <div className="panel-loading">Looking up…</div> : wordMap?.map(({ word, matches }) => (
          <div key={word}>
            <div className="era-header">"{word}"</div>
            {!matches.length && <div className="muted">No Strong's entries use this word.</div>}
            {matches.map(m => (
              <button key={m.number} className="list-row" onClick={() => setStrongs(m.number)}>
                <span className="list-row-num">{m.number}</span>
                <span className="list-row-main"><span className="list-row-title">{m.lemma} <span className="muted">{m.translit}</span></span><span className="list-row-sub">{m.kjv_usage}</span></span>
              </button>
            ))}
          </div>
        ))}
      </Modal>

      <StrongsDialog strongs={strongs} onClose={() => setStrongs(null)} onNavigate={go}
        onOpenWordStudy={s => { setStrongs(null); onClose(); onOpenWordStudy(s) }} />
    </Modal>
  )
}

