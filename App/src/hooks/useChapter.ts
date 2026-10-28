// Loads one reader chapter plus everything drawn around it — mirrors the Android reader's
// chapter-load effect (ReaderScreen.tsx), minus the pack/online routing desktop doesn't need.
import { useEffect, useState } from 'react'
import { bibleDb, userDb } from '../db/sqlite'
import {
  getApocryphaChapter, getBsbChapterFootnotes, getChapter, getChapterCrossRefMarkers, getChapterFootnotes,
  getChapterHighlights, getChapterNoteVerses, getEarlyTextChapter, getEarlyTextFootnotes, getEarlyTextRefs,
  getElxxChapterNotes, getOtQuoteSpans, getPsalmHeading,
} from '../db/queries'
import type { EarlyTextRef, OtQuoteSpan } from '../db/queries'
import { EsvError, fetchEsvChapter } from '../lib/esv'
import { useEsvKey } from '../lib/esvKey'
import { buildVerseMap } from '../lib/verseText'
import { BOOK_MAP } from '../data/books'
import type { BibleVerse, BsbFootnote, CrossRef, ElxxNote, Footnote } from '../types'

export type Kind = 'apocrypha' | 'early' | undefined

export interface ChapterData {
  verses: BibleVerse[]
  loading: boolean
  esvError: EsvError | null
  footnotes: Map<number, Footnote[]>
  bsbFootnotes: Map<number, BsbFootnote[]>
  elxxNotes: Map<number, ElxxNote[]>
  otSpans: Map<number, OtQuoteSpan[]>
  crossRefs: Map<number, CrossRef[]>
  earlyFootnotes: Map<number, string>
  earlyRefs: EarlyTextRef[]
  psalmHeading: string | null
  highlights: Map<number, string>
  noteVerses: Set<number>
}

const EMPTY: Omit<ChapterData, 'loading'> = {
  verses: [], esvError: null, footnotes: new Map(), bsbFootnotes: new Map(), elxxNotes: new Map(),
  otSpans: new Map(), crossRefs: new Map(), earlyFootnotes: new Map(), earlyRefs: [], psalmHeading: null,
  highlights: new Map(), noteVerses: new Set(),
}

const none = <T,>(v: T) => Promise.resolve(v)

/** `userVersion` bumps re-read highlights/notes after an edit without refetching text. */
export function useChapter(book: string, chapter: number, translation: string, kind: Kind, otCaps: boolean, userVersion = 0): ChapterData {
  const [data, setData] = useState<Omit<ChapterData, 'loading'>>(EMPTY)
  const [loading, setLoading] = useState(true)
  const esvKey = useEsvKey()
  const canon = !kind
  const nt = canon && BOOK_MAP[book]?.testament === 'NT'

  useEffect(() => {
    if (!book || chapter < 1) { setData(EMPTY); setLoading(false); return }
    let live = true
    setLoading(true)
    const text: Promise<BibleVerse[]> =
      kind === 'early' ? getEarlyTextChapter(bibleDb, book, chapter)
      : kind === 'apocrypha' ? getApocryphaChapter(bibleDb, book, chapter)
      : translation === 'ESV' ? fetchEsvChapter(book, chapter, esvKey)
      : getChapter(bibleDb, book, chapter, translation)

    Promise.all([
      text.catch(e => (e instanceof EsvError ? e : new EsvError('Could not load that passage.'))),
      canon && translation === 'KJV' ? getChapterFootnotes(bibleDb, book, chapter) : none([] as Footnote[]),
      canon && translation === 'BSB' ? getBsbChapterFootnotes(bibleDb, book, chapter) : none([] as BsbFootnote[]),
      canon && translation === 'E_LXX' ? getElxxChapterNotes(bibleDb, book, chapter) : none([] as ElxxNote[]),
      nt && otCaps ? getOtQuoteSpans(bibleDb, book, chapter) : none([] as OtQuoteSpan[]),
      nt ? getChapterCrossRefMarkers(bibleDb, book, chapter) : none(new Map<number, CrossRef[]>()),
      kind === 'early' ? getEarlyTextFootnotes(bibleDb, book, chapter) : none(new Map<number, string>()),
      kind === 'early' ? getEarlyTextRefs(bibleDb, book, chapter) : none([] as EarlyTextRef[]),
      canon && book === 'Psalms' ? getPsalmHeading(bibleDb, chapter) : none(null),
    ]).then(([rows, fns, bsb, elxx, spans, cr, efn, erefs, heading]) => {
      if (!live) return
      const esvError = rows instanceof EsvError ? rows : null
      setData(d => ({
        ...d,
        verses: esvError ? [] : rows as BibleVerse[],
        esvError,
        footnotes: buildVerseMap(fns), bsbFootnotes: buildVerseMap(bsb), elxxNotes: buildVerseMap(elxx),
        otSpans: buildVerseMap(spans), crossRefs: cr, earlyFootnotes: efn, earlyRefs: erefs, psalmHeading: heading,
      }))
      setLoading(false)
    }).catch(() => { if (live) { setData(EMPTY); setLoading(false) } })
    return () => { live = false }
  }, [book, chapter, translation, kind, otCaps, esvKey, canon, nt])

  useEffect(() => {
    if (!book || chapter < 1) return
    let live = true
    Promise.all([getChapterHighlights(userDb, book, chapter), getChapterNoteVerses(userDb, book, chapter)])
      .then(([hl, notes]) => {
        if (live) setData(d => ({ ...d, highlights: new Map(hl.map(h => [h.verse, h.color])), noteVerses: notes }))
      })
    return () => { live = false }
  }, [book, chapter, userVersion])

  return { ...data, loading }
}

/** Parallel column text (local translations only — never the API-only ESV). */
export function useCompareText(book: string, chapter: number, translation: string | null): Map<number, string> {
  const [map, setMap] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    if (!translation || translation === 'ESV' || !book || chapter < 1) { setMap(new Map()); return }
    let live = true
    getChapter(bibleDb, book, chapter, translation).then(rows => { if (live) setMap(new Map(rows.map(v => [v.verse, v.text]))) })
    return () => { live = false }
  }, [book, chapter, translation])
  return map
}
