import React, { useEffect, useRef, useState } from 'react'
import { useVerses, useCrossRefs } from '../hooks/useBible'
import { CrossRefTooltip } from './CrossRefTooltip'
import { CopyRangePopover } from './CopyRangePopover'
import type { WordHighlight } from './WordStudyPanel'
import type { SelectedVerse, PassageRef } from '../types'

const clean = (s: string) => s.replace(/[^\w']/g, '').toLowerCase()
const stem = (s: string) => { const r = s.replace(/(ing|tion|ed|es|ly|s)$/, ''); return r.length >= 3 ? r : s }

// Phase 1: match a single specific gloss term (OpenGNT context-sensitive)
function resolveHighlightIndices(tokens: string[], hl: WordHighlight): Set<number> {
  const cleaned = tokens.map(clean)

  if (hl.gloss) {
    const g = clean(hl.gloss)
    const hits = cleaned.map((_, i) => i).filter(i => cleaned[i] === g || stem(cleaned[i]) === stem(g))
    if (hits.length === 1) return new Set(hits)
    if (hits.length > 1) {
      // Same word appears multiple times — positionRatio tiebreaker
      const target = hl.positionRatio * (tokens.length - 1)
      hits.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
      return new Set([hits[0]])
    }
    // Gloss not found (KJV/Berean divergence) — fall through to Phase 2
  }

  return resolveHighlightIndicesFuzzy(cleaned, hl.glossTerms, hl.positionRatio, tokens.length)
}

// Phase 2: improved fuzzy fallback used for OT and NT cases where gloss is null/unmatched
function resolveHighlightIndicesFuzzy(
  cleaned: string[],
  glossTerms: string[],
  positionRatio: number,
  tokenCount: number
): Set<number> {
  if (!glossTerms.length) return new Set()

  // Score each candidate token index by term priority + match type
  const scores = new Map<number, number>()

  for (let termIdx = 0; termIdx < glossTerms.length; termIdx++) {
    const termWeight = 1 / (termIdx + 1)
    const term = glossTerms[termIdx]
    const termParts = term.split(/\s+/)

    if (termParts.length === 1) {
      const t = termParts[0]
      const tStem = t.length >= 4 ? stem(t) : null
      for (let i = 0; i < cleaned.length; i++) {
        const w = cleaned[i]
        if (!w) continue
        if (w === t) {
          scores.set(i, (scores.get(i) ?? 0) + termWeight * 2)         // exact match bonus
        } else if (tStem && (w === tStem || stem(w) === tStem)) {
          scores.set(i, (scores.get(i) ?? 0) + termWeight * 0.8)       // stem match penalty
        }
      }
    } else {
      // Multi-word phrase
      outer: for (let i = 0; i <= cleaned.length - termParts.length; i++) {
        for (let j = 0; j < termParts.length; j++) {
          if (cleaned[i + j] !== termParts[j]) continue outer
        }
        scores.set(i, (scores.get(i) ?? 0) + termWeight * 2)
      }
    }
  }

  if (!scores.size) return new Set()

  // Apply position window — drop candidates more than 45% away from target position
  const target = positionRatio * (tokenCount - 1)
  const window = tokenCount * 0.45
  const windowed = [...scores.entries()].filter(([i]) => Math.abs(i - target) <= window)
  const pool = windowed.length > 0 ? windowed : [...scores.entries()]

  // Pick highest-scoring candidate; positionRatio breaks ties
  pool.sort((a, b) => b[1] - a[1] || Math.abs(a[0] - target) - Math.abs(b[0] - target))
  return new Set([pool[0][0]])
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
