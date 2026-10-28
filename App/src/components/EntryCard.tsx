// Commentary card — DOM port of the Android EntryCard.
import { useMemo, useState, type ReactNode } from 'react'
import { getFatherInfo } from '../data/fatherDates'
import { TRADITION_COLORS } from '../data/traditionColors'
import { getEarlyTextBook, getSourceUrl } from '../data/sourceLinks'
import { escapeRegex } from '../utils/regex'
import type { CommentaryEntry } from '../types'

// Citation text sometimes names the book differently from our canonical name
const REF_BOOK_VARIANTS: Record<string, string[]> = {
  'Psalms': ['Psalms', 'Psalm'],
  'Wisdom of Solomon': ['Wisdom of Solomon', 'Wisdom'],
  'Song of Solomon': ['Song of Solomon', 'Song of Songs', 'Songs'],
}

function refCoversVerse(versePart: string, verse?: number): boolean {
  if (!verse) return true
  return versePart.split(',').some(part => {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/)
    if (!m) return false
    const a = parseInt(m[1], 10)
    const b = m[2] ? parseInt(m[2], 10) : a
    return verse >= a && verse <= b
  })
}

/** Underline scripture refs in the text that match the current verse. */
function highlightVerseRefs(text: string, book: string, chapter?: number, verse?: number): ReactNode {
  const names = (REF_BOOK_VARIANTS[book] ?? [book]).map(escapeRegex).join('|')
  const re = new RegExp(`(?:${names})\\s+(\\d+):(\\d+(?:-\\d+)?(?:,\\s*\\d+(?:-\\d+)?)*)`, 'g')
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if ((!chapter || +m[1] === chapter) && refCoversVerse(m[2], verse)) {
      parts.push(text.slice(last, m.index), <mark key={m.index} className="ref-highlight">{m[0]}</mark>)
      last = m.index! + m[0].length
    }
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return parts
}

export function EntryCard({ entry, book, chapter, verse, verseRef, onNavigate, onOpenFather }: {
  entry: CommentaryEntry
  book: string
  chapter?: number
  verse?: number
  verseRef?: string
  onNavigate: (book: string, chapter: number, verse: number) => void
  onOpenFather?: (name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const info = useMemo(() => getFatherInfo(entry.father_name), [entry.father_name])
  const earlyNav = useMemo(() => getEarlyTextBook(entry.father_name, entry.source), [entry.father_name, entry.source])
  const url = useMemo(() => earlyNav ? null : getSourceUrl(entry.father_name, book, entry.source_url, entry.excerpt),
    [earlyNav, entry.father_name, book, entry.source_url, entry.excerpt])
  const hasMore = entry.full_text.length > entry.excerpt.length
  const body = expanded ? entry.full_text : entry.excerpt

  return (
    <div className="commentary-entry">
      <div className="commentary-header">
        <div className="commentary-father">
          <span className="tradition-dot" style={{ background: TRADITION_COLORS[info?.tradition ?? ''] ?? '#94a3b8' }} />
          {onOpenFather
            ? <button className="father-name link-btn" onClick={() => onOpenFather(entry.father_name)}>{entry.father_name}</button>
            : <span className="father-name">{entry.father_name}</span>}
          <span className="father-era">{info?.dates ?? entry.father_era}</span>
        </div>
        {earlyNav ? (
          <button className="source-link-btn" onClick={() => onNavigate(earlyNav.book, earlyNav.chapter, 1)}>Read in app</button>
        ) : url ? (
          <button className="source-link-btn" onClick={() => window.api.openExternal(url)} title="Read full text online">Read full text ↗</button>
        ) : null}
      </div>
      {verseRef && (
        <button className="commentary-verse-chip" onClick={() => onNavigate(book, chapter ?? 1, verse ?? 1)}>{verseRef}</button>
      )}
      <p className="commentary-excerpt">{expanded ? highlightVerseRefs(body, book, chapter, verse) : body}</p>
      {entry.source && <p className="commentary-source">{entry.source}</p>}
      {hasMore && <button className="expand-inline-btn" onClick={() => setExpanded(e => !e)}>{expanded ? '▲ Show less' : '▼ Show more'}</button>}
    </div>
  )
}
