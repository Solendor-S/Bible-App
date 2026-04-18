import { useState, useEffect } from 'react'
import type { CommentaryEntry } from '../types'

export function useCommentary(book: string, chapter: number, verse: number) {
  const [entries, setEntries] = useState<CommentaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!book || !chapter || !verse) { setEntries([]); return }
    setLoading(true)
    window.bibleApi.getCommentary(book, chapter, verse).then(e => {
      setEntries(e)
      setLoading(false)
    })
  }, [book, chapter, verse])
  return { entries, loading }
}
