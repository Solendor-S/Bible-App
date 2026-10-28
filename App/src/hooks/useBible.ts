import { useState, useEffect } from 'react'
import { EsvError, fetchEsvChapter } from '../lib/esv'
import { useEsvKey } from '../lib/esvKey'
import type { Book, BibleVerse, CrossRef, Footnote } from '../types'

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  useEffect(() => {
    window.bibleApi.getBooks().then(setBooks)
  }, [])
  return books
}

export function useChapters(book: string) {
  const [chapters, setChapters] = useState<number[]>([])
  useEffect(() => {
    if (!book) return
    window.bibleApi.getChapters(book).then(setChapters)
  }, [book])
  return chapters
}

export function useVerses(book: string, chapter: number) {
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!book || !chapter) return
    setLoading(true)
    window.bibleApi.getVerses(book, chapter).then(v => {
      setVerses(v)
      setLoading(false)
    })
  }, [book, chapter])
  return { verses, loading }
}

export function useTranslationVerses(translation: string, book: string, chapter: number) {
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [loading, setLoading] = useState(false)
  // Only the ESV can fail to load — it comes over the network, from the renderer, and
  // never touches bible.db. A missing key is unfinished setup, not an error.
  const [esvError, setEsvError] = useState<EsvError | null>(null)
  const esvKey = useEsvKey()

  useEffect(() => {
    if (!book || !chapter || !translation) { setVerses([]); setEsvError(null); return }
    let cancelled = false
    setLoading(true)
    setEsvError(null)
    const promise = translation === 'ESV'
      ? fetchEsvChapter(book, chapter, esvKey)
      : translation === 'KJV'
        ? window.bibleApi.getVerses(book, chapter)
        : window.translationsApi.getVerses(translation, book, chapter)
    promise
      .then(v => { if (!cancelled) { setVerses(v); setLoading(false) } })
      .catch(e => {
        if (cancelled) return
        setVerses([])
        setEsvError(e instanceof EsvError ? e : new EsvError('Could not load that passage.'))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [translation, book, chapter, esvKey])

  return { verses, loading, esvError }
}

export function useHighlights(book: string, chapter: number) {
  const [highlights, setHighlights] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (!book || !chapter) return
    window.highlightApi.get(book, chapter).then(list => {
      setHighlights(new Map(list.map(h => [h.verse, h.color])))
    })
  }, [book, chapter])

  function setHighlight(verse: number, color: string) {
    if (color) {
      window.highlightApi.set(book, chapter, verse, color)
      setHighlights(m => { const n = new Map(m); n.set(verse, color); return n })
    } else {
      window.highlightApi.clear(book, chapter, verse)
      setHighlights(m => { const n = new Map(m); n.delete(verse); return n })
    }
  }

  return { highlights, setHighlight }
}

export function useCrossRefs(book: string, chapter: number, verse: number, translation = 'KJV') {
  const [refs, setRefs] = useState<CrossRef[]>([])
  useEffect(() => {
    if (!book || !chapter || !verse) { setRefs([]); return }
    window.bibleApi.getCrossRefs(book, chapter, verse, translation).then(setRefs)
  }, [book, chapter, verse, translation])
  return refs
}

const EMPTY_FOOTNOTE_MAP: Map<number, Footnote[]> = new Map()

export function useChapterFootnotes(translation: string, book: string, chapter: number): Map<number, Footnote[]> {
  const [fnMap, setFnMap] = useState<Map<number, Footnote[]>>(EMPTY_FOOTNOTE_MAP)
  useEffect(() => {
    if (translation !== 'KJV' || !book || !chapter) { setFnMap(EMPTY_FOOTNOTE_MAP); return }
    window.bibleApi.getChapterFootnotes(book, chapter).then(rows => {
      const m = new Map<number, Footnote[]>()
      for (const row of rows) {
        const arr = m.get(row.verse) ?? []
        arr.push(row)
        m.set(row.verse, arr)
      }
      setFnMap(m)
    })
  }, [translation, book, chapter])
  return fnMap
}
