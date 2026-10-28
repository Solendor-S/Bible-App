// Cross-Refs tab — port of the Android StudyScreen cross-refs: Bible cross-references plus
// "Early Church" (early texts citing this verse) or "Scripture Refs" (for an early-text chapter).
import { useEffect, useMemo, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { getBibleVerseCitedByEarlyTexts, getCrossRefs, getEarlyTextRefs } from '../db/queries'
import type { EarlyTextCitation, EarlyTextRef } from '../db/queries'
import { stripUsfm } from '../data/redLetter'
import { BOOK_ORDER, EARLY_TEXT_MAP } from '../data/books'
import { usePref } from '../context/Prefs'
import { Chips } from './Modal'
import type { CrossRef, SelectedVerse } from '../types'

const byType = (a: { ref_type: string }, b: { ref_type: string }) => (a.ref_type === 'quote' ? 0 : 1) - (b.ref_type === 'quote' ? 0 : 1)

export function CrossRefsPanel({ selected, onNavigate }: {
  selected: SelectedVerse
  onNavigate: (book: string, chapter: number, verse: number) => void
}) {
  const [refs, setRefs] = useState<CrossRef[]>([])
  const [early, setEarly] = useState<(EarlyTextCitation | EarlyTextRef)[]>([])
  const [loading, setLoading] = useState(false)
  const [panel, setPanel] = useState<'bible' | 'early'>('bible')
  const [biblicalOrder] = usePref('crossref_biblical_order')
  const isEarlyBook = !!EARLY_TEXT_MAP[selected.book]

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([
      getCrossRefs(bibleDb, selected.book, selected.chapter, selected.verse),
      isEarlyBook ? getEarlyTextRefs(bibleDb, selected.book, selected.chapter)
        : getBibleVerseCitedByEarlyTexts(bibleDb, selected.book, selected.chapter, selected.verse),
    ]).then(([r, e]) => { if (live) { setRefs(r); setEarly([...e].sort(byType)); setLoading(false) } })
      .catch(() => live && setLoading(false))
    return () => { live = false }
  }, [selected.book, selected.chapter, selected.verse, isEarlyBook])

  const sorted = useMemo(() => !biblicalOrder ? refs : [...refs].sort((a, b) =>
    (BOOK_ORDER.get(a.ref_book) ?? 999) - (BOOK_ORDER.get(b.ref_book) ?? 999) || a.ref_chapter - b.ref_chapter || a.ref_verse - b.ref_verse),
  [refs, biblicalOrder])

  const verseRef = `${selected.book} ${selected.chapter}:${selected.verse}`
  return (
    <div className="panel-body">
      <Chips value={panel} onChange={setPanel} options={[
        { value: 'bible', label: `Cross-Refs${refs.length ? ` (${refs.length})` : ''}` },
        { value: 'early', label: `${isEarlyBook ? 'Scripture Refs' : 'Early Church'}${early.length ? ` (${early.length})` : ''}` },
      ]} />
      {loading ? <div className="panel-loading">Loading…</div> : panel === 'bible' ? (
        sorted.length === 0 ? <div className="panel-empty">No cross-references recorded for {verseRef}</div> : sorted.map(r => (
          <button key={`${r.ref_book}-${r.ref_chapter}-${r.ref_verse}`} className="crossref-card" onClick={() => onNavigate(r.ref_book, r.ref_chapter, r.ref_verse)}>
            <span className="crossref-ref">{r.ref_book} {r.ref_chapter}:{r.ref_verse}</span>
            {r.text && <span className="crossref-text">{stripUsfm(r.text).replace(/¶\s*/g, '').replace(/[{}]/g, '')}</span>}
            <span className="crossref-go">→ Go to verse</span>
          </button>
        ))
      ) : early.length === 0 ? (
        <div className="panel-empty">{isEarlyBook ? 'No mapped scripture references for this chapter' : 'This verse is not cited in the early church texts'}</div>
      ) : early.map((e, i) => 'ref_book' in e ? (
        <button key={i} className="early-cite-row" onClick={() => onNavigate(e.ref_book, e.ref_chapter, e.ref_verse)}>
          <span><b>{e.ref_book}</b> {e.ref_chapter}:{e.ref_verse}</span>
          <span className={`cite-badge${e.ref_type === 'quote' ? ' cite-badge--quote' : ''}`}>{e.ref_type}</span><span className="chev">›</span>
        </button>
      ) : (
        <button key={i} className="early-cite-row" onClick={() => onNavigate(e.book, e.chapter, e.verse)}>
          <span><b>{e.book}</b> ch. {e.chapter}</span>
          <span className={`cite-badge${e.ref_type === 'quote' ? ' cite-badge--quote' : ''}`}>{e.ref_type}</span><span className="chev">›</span>
        </button>
      ))}
    </div>
  )
}
