import React from 'react'
import type { ChatMessage } from '../types'

interface Props {
  message: ChatMessage
  streaming?: boolean
  onNavigateVerse: (book: string, chapter: number, verse: number) => void
  onNavigateFather: (fatherName: string, book?: string, chapter?: number, verse?: number) => void
}

// Parse [VERSE: John 3:16] and [FATHER: Augustine | City of God] tags into React nodes
function parseContent(
  content: string,
  onVerse: (book: string, chapter: number, verse: number) => void,
  onFather: (name: string, book?: string, chapter?: number, verse?: number) => void
): React.ReactNode[] {
  const regex = /\[(VERSE|FATHER): ([^\]]+)\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    const type = match[1]
    const value = match[2].trim()

    if (type === 'VERSE') {
      const m = value.match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/)
      if (m) {
        const book = m[1].trim()
        const chapter = parseInt(m[2], 10)
        const verse = parseInt(m[3], 10)
        parts.push(
          <button key={key++} className="ai-citation-verse" onClick={() => onVerse(book, chapter, verse)}>
            {value}
          </button>
        )
      } else {
        parts.push(<span key={key++} className="ai-citation-verse">{value}</span>)
      }
    } else if (type === 'FATHER') {
      const [name, source, verseRef] = value.split('|').map(s => s.trim())
      let fBook: string | undefined, fChapter: number | undefined, fVerse: number | undefined
      if (verseRef) {
        const vm = verseRef.match(/^(.+?)\s+(\d+):(\d+)/)
        if (vm) { fBook = vm[1].trim(); fChapter = parseInt(vm[2], 10); fVerse = parseInt(vm[3], 10) }
      }
      parts.push(
        <button key={key++} className="ai-citation-father" onClick={() => onFather(name, fBook, fChapter, fVerse)}>
          {name}{source ? ` · ${source}` : ''}
        </button>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

export function AiChatMessage({ message, streaming, onNavigateVerse, onNavigateFather }: Props) {
  const isUser = message.role === 'user'
  const nodes = parseContent(message.content, onNavigateVerse, onNavigateFather)

  return (
    <div className={`ai-message ${isUser ? 'ai-message-user' : 'ai-message-assistant'}`}>
      <div className="ai-message-bubble">
        <span className="ai-message-text">{nodes}</span>
        {streaming && <span className="ai-cursor">▊</span>}
      </div>
    </div>
  )
}
