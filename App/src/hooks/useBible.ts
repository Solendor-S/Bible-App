import { useState, useEffect } from 'react'
import type { Book, BibleVerse, CrossRef } from '../types'

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
  useEffect(() => {
    if (!book || !chapter || !translation) { setVerses([]); return }
    setLoading(true)
    const promise = translation === 'KJV'
      ? window.bibleApi.getVerses(book, chapter)
      : window.translationsApi.getVerses(translation, book, chapter)
    promise.then(v => { setVerses(v); setLoading(false) })
  }, [translation, book, chapter])
  return { verses, loading }
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
