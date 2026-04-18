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

export function useCrossRefs(book: string, chapter: number, verse: number) {
  const [refs, setRefs] = useState<CrossRef[]>([])
  useEffect(() => {
    if (!book || !chapter || !verse) { setRefs([]); return }
    window.bibleApi.getCrossRefs(book, chapter, verse).then(setRefs)
  }, [book, chapter, verse])
  return refs
}
