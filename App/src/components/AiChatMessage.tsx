import React, { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ResolvedCitation } from '../types'
import { lookupWorkByTitle } from '../lib/sourceLinks'
import { buildFallbackSearchUrl } from '../lib/geminiClient'

interface CitationPopup {
  fatherName: string
  workTitle: string
  url: string
  aiSuggested: boolean
  x: number
  y: number
}

interface Props {
  message: ChatMessage
  streaming?: boolean
  onNavigateVerse: (book: string, chapter: number, verse: number) => void
  onNavigateFather: (fatherName: string, book?: string, chapter?: number, verse?: number) => void
  resolvedCitations?: Record<string, ResolvedCitation>
  alwaysLinkCitations?: boolean
}

function parseVerseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)/)
  if (!m) return null
  return { book: m[1].trim(), chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) }
}

function linkLabel(url: string): string {
  if (url.includes('newadvent.org')) return 'Read on New Advent ↗'
  if (url.includes('ccel.org')) return 'Read on CCEL ↗'
  if (url.includes('tertullian.org')) return 'Read on Tertullian.org ↗'
  return 'Search online ↗'
}

export function AiChatMessage({ message, streaming, onNavigateVerse, onNavigateFather, resolvedCitations = {}, alwaysLinkCitations = false }: Props) {
  const isUser = message.role === 'user'
  const [popup, setPopup] = useState<CitationPopup | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popup) return
    function handler(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [popup])

  function handleFatherClick(
    name: string,
    source: string | undefined,
    fBook: string | undefined,
    fChapter: number | undefined,
    fVerse: number | undefined,
    e: React.MouseEvent,
  ) {
    if (source) {
      const key = `${name.toLowerCase()}|${source.toLowerCase()}`
      const resolved = resolvedCitations[key]

      // DB Nav mode: navigate if we have a confirmed DB match
      if (!alwaysLinkCitations && resolved?.hasDbMatch) {
        onNavigateFather(name, fBook, fChapter, fVerse)
        return
      }

      // Always Link mode, or no confirmed DB match — show popup immediately
      const url = resolved?.url ?? lookupWorkByTitle(name, source) ?? buildFallbackSearchUrl(name, source)
      const aiSuggested = resolved ? (resolved.aiSuggested ?? false) : !lookupWorkByTitle(name, source)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = Math.min(rect.left, window.innerWidth - 320)
      const y = rect.bottom + 6
      setPopup({ fatherName: name, workTitle: source, url, aiSuggested, x, y })
      return
    }
    onNavigateFather(name, fBook, fChapter, fVerse)
  }

  // Parse [VERSE: ...] and [FATHER: ...] tags into React nodes
  const regex = /\[(VERSE|FATHER): ([^\]]+)\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let nodeKey = 0
  const content = message.content

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index))

    const type = match[1]
    const value = match[2].trim()

    if (type === 'VERSE') {
      const m = value.match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/)
      if (m) {
        const book = m[1].trim()
        const chapter = parseInt(m[2], 10)
        const verse = parseInt(m[3], 10)
        parts.push(
          <button key={nodeKey++} className="ai-citation-verse" onClick={() => onNavigateVerse(book, chapter, verse)}>
            {value}
          </button>
        )
      } else {
        parts.push(<span key={nodeKey++} className="ai-citation-verse">{value}</span>)
      }
    } else if (type === 'FATHER') {
      const [name, source, verseRef] = value.split('|').map(s => s.trim())
      const parsed = verseRef ? parseVerseRef(verseRef) : null
      parts.push(
        <button
          key={nodeKey++}
          className="ai-citation-father"
          onClick={e => handleFatherClick(name, source, parsed?.book, parsed?.chapter, parsed?.verse, e)}
        >
          {name}{source ? ` · ${source}` : ''}
        </button>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex))

  return (
    <div className={`ai-message ${isUser ? 'ai-message-user' : 'ai-message-assistant'}`}>
      <div className="ai-message-bubble">
        <span className="ai-message-text">{parts}</span>
        {streaming && <span className="ai-cursor">▊</span>}
      </div>

      {popup && (
        <div
          ref={popupRef}
          className="citation-no-match-popup"
          style={{ position: 'fixed', left: popup.x, top: popup.y }}
        >
          <div className="citation-popup-father">{popup.fatherName}</div>
          <div className="citation-popup-work">{popup.workTitle}</div>
          <button
            className="citation-popup-link"
            onClick={() => { window.bibleApi.openExternal(popup.url); setPopup(null) }}
          >
            {linkLabel(popup.url)}
          </button>
          {popup.aiSuggested && (
            <div className="citation-popup-warning">⚠ AI-suggested link — verify before trusting</div>
          )}
        </div>
      )}
    </div>
  )
}
