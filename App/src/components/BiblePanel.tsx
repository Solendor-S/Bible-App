import React, { useEffect, useRef, useState } from 'react'
import { useVerses, useCrossRefs } from '../hooks/useBible'
import { CrossRefTooltip } from './CrossRefTooltip'
import { CopyRangePopover } from './CopyRangePopover'
import type { WordHighlight } from './WordStudyPanel'
import type { SelectedVerse, PassageRef } from '../types'

// Returns the set of word indices to highlight in verseText given a WordHighlight.
// Strips punctuation for comparison, disambiguates multiple hits by positionRatio.
function resolveHighlightIndices(tokens: string[], hl: WordHighlight): Set<number> {
  const { glossTerms, positionRatio } = hl
  if (!glossTerms.length) return new Set()

  const clean = (s: string) => s.replace(/[^\w']/g, '').toLowerCase()
  const cleaned = tokens.map(clean)

  const candidateSets: number[][] = []

  for (const term of glossTerms) {
    const termParts = term.toLowerCase().split(/\s+/)

    if (termParts.length === 1) {
      const t = termParts[0]
      const stem = (s: string) => s.replace(/(ing|tion|ed|es|ly|s)$/, '')
      const tStem = t.length >= 4 ? stem(t) : null
      for (let i = 0; i < cleaned.length; i++) {
        const w = cleaned[i]
        if (!w) continue
        if (w === t) {
          candidateSets.push([i])
        } else if (tStem && tStem.length >= 3 && (w === tStem || stem(w) === tStem)) {
          candidateSets.push([i])
        }
      }
    } else {
      // Multi-word phrase — look for all parts appearing consecutively
      outer: for (let i = 0; i <= cleaned.length - termParts.length; i++) {
        for (let j = 0; j < termParts.length; j++) {
          if (cleaned[i + j] !== termParts[j]) continue outer
        }
        candidateSets.push(Array.from({ length: termParts.length }, (_, j) => i + j))
      }
    }
  }

  if (!candidateSets.length) return new Set()

  // Deduplicate by first index
  const seen = new Set<number>()
  const unique = candidateSets.filter(s => {
    if (seen.has(s[0])) return false
    seen.add(s[0]); return true
  })

  if (unique.length === 1) return new Set(unique[0])

  // Disambiguate: pick the set whose midpoint is closest to positionRatio
  const target = positionRatio * (tokens.length - 1)
  unique.sort((a, b) => {
    const midA = a.reduce((s, i) => s + i, 0) / a.length
    const midB = b.reduce((s, i) => s + i, 0) / b.length
    return Math.abs(midA - target) - Math.abs(midB - target)
  })
  return new Set(unique[0])
}

interface VerseRowProps {
  book: string
  chapter: number
  verseNum: number
  text: string
  selected: boolean
  wordHighlight?: WordHighlight | null
  onSelect: () => void
  onContextMenu: (verseNum: number, rect: DOMRect) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

function VerseRow({ book, chapter, verseNum, text, selected, wordHighlight, onSelect, onContextMenu, onNavigate }: VerseRowProps) {
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
      {selected && wordHighlight ? (() => {
        const tokens = text.split(/(\s+)/)
        const wordTokens = tokens.filter(t => /\S/.test(t))
        const highlighted = resolveHighlightIndices(wordTokens, wordHighlight)
        let wordIdx = 0
        return (
          <span className="verse-text">
            {tokens.map((token, i) => {
              if (!/\S/.test(token)) return token
              const idx = wordIdx++
              return (
                <span key={i} className={highlighted.has(idx) ? 'word-highlight' : undefined}>
                  {token}
                </span>
              )
            })}
          </span>
        )
      })() : (
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
  wordHighlight?: WordHighlight | null
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

function PassageSection({ passage, activeVerse, wordHighlight, onVerseClick, onNavigate }: PassageSectionProps) {
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
          wordHighlight={
            activeVerse.book === passage.book &&
            activeVerse.chapter === passage.chapter &&
            activeVerse.verse === v.verse ? wordHighlight : null
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
  wordHighlight?: WordHighlight | null
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}

export function BiblePanel({ passages, activeVerse, wordHighlight, onVerseClick, onNavigate }: Props) {
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
            wordHighlight={wordHighlight}
            onVerseClick={onVerseClick}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}
