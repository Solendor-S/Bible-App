import React, { useEffect, useRef, useState } from 'react'
import { useVerses, useCrossRefs } from '../hooks/useBible'
import { CrossRefTooltip } from './CrossRefTooltip'
import { CopyRangePopover } from './CopyRangePopover'
import type { SelectedVerse, PassageRef } from '../types'

interface VerseRowProps {
  book: string
  chapter: number
  verseNum: number
  text: string
  selected: boolean
  activeWordPos?: number | null
  onSelect: () => void
  onContextMenu: (verseNum: number, rect: DOMRect) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

function VerseRow({ book, chapter, verseNum, text, selected, activeWordPos, onSelect, onContextMenu, onNavigate }: VerseRowProps) {
  const refs = useCrossRefs(book, chapter, selected ? verseNum : 0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onContextMenu(verseNum, (e.currentTarget as HTMLElement).getBoundingClientRect())
  }

  return (
    <div
      ref={ref}
      className={`verse-row ${selected ? 'verse-row-selected' : ''}`}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
    >
      <sup className="verse-num">{verseNum}</sup>
      {selected && activeWordPos != null ? (
        <span className="verse-text">
          {text.split(/(\s+)/).map((token, i, arr) => {
            // Count only non-whitespace tokens to build word index
            const wordIndex = arr.slice(0, i).filter(t => /\S/.test(t)).length
            if (!/\S/.test(token)) return token
            const highlighted = wordIndex === activeWordPos - 1
            return (
              <span key={i} className={highlighted ? 'word-highlight' : undefined}>
                {token}
              </span>
            )
          })}
        </span>
      ) : (
        <span className="verse-text">{text}</span>
      )}
      {selected && <CrossRefTooltip refs={refs} onNavigate={onNavigate} />}
    </div>
  )
}

interface CopyTarget {
  verse: number
  rect: DOMRect
}

interface PassageSectionProps {
  passage: PassageRef
  activeVerse: SelectedVerse
  activeWordPos?: number | null
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

function PassageSection({ passage, activeVerse, activeWordPos, onVerseClick, onNavigate }: PassageSectionProps) {
  const { verses, loading } = useVerses(passage.book, passage.chapter)
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null)

  const displayed = passage.verseStart
    ? verses.filter(v =>
        v.verse >= passage.verseStart! &&
        v.verse <= (passage.verseEnd ?? passage.verseStart!)
      )
    : verses

  return (
    <div className="passage-section">
      <div className="passage-section-header">{passage.raw}</div>
      {loading && <div className="panel-loading">Loading...</div>}
      {!loading && displayed.length === 0 && (
        <div className="panel-empty">No verses found.</div>
      )}
      {displayed.map(v => (
        <VerseRow
          key={`${passage.book}-${passage.chapter}-${v.verse}`}
          book={passage.book}
          chapter={passage.chapter}
          verseNum={v.verse}
          text={v.text}
          selected={
            activeVerse.book === passage.book &&
            activeVerse.chapter === passage.chapter &&
            activeVerse.verse === v.verse
          }
          activeWordPos={
            activeVerse.book === passage.book &&
            activeVerse.chapter === passage.chapter &&
            activeVerse.verse === v.verse ? activeWordPos : null
          }
          onSelect={() => onVerseClick(passage.book, passage.chapter, v.verse)}
          onContextMenu={(verse, rect) => setCopyTarget({ verse, rect })}
          onNavigate={onNavigate}
        />
      ))}
      {copyTarget && (
        <CopyRangePopover
          book={passage.book}
          chapter={passage.chapter}
          allVerses={verses}
          initialVerse={copyTarget.verse}
          anchorRect={copyTarget.rect}
          onClose={() => setCopyTarget(null)}
        />
      )}
    </div>
  )
}

interface Props {
  passages: PassageRef[]
  activeVerse: SelectedVerse
  activeWordPos?: number | null
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

export function BiblePanel({ passages, activeVerse, activeWordPos, onVerseClick, onNavigate }: Props) {
  return (
    <div className="panel bible-panel">
      <div className="panel-header">
        <span className="panel-label">Scripture</span>
      </div>
      <div className="panel-body">
        {passages.length === 0 && (
          <div className="panel-empty">Enter a passage above, e.g. John 3:16</div>
        )}
        {passages.map((p, i) => (
          <PassageSection
            key={`${p.book}-${p.chapter}-${p.verseStart ?? 0}-${i}`}
            passage={p}
            activeVerse={activeVerse}
            activeWordPos={activeWordPos}
            onVerseClick={onVerseClick}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}
