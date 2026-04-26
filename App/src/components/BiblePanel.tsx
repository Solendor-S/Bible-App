import React, { useEffect, useRef, useState } from 'react'
import { useTranslationVerses, useCrossRefs, useHighlights } from '../hooks/useBible'
import { CrossRefTooltip } from './CrossRefTooltip'
import { CopyRangePopover } from './CopyRangePopover'
import { BookPrefacePanel } from './BookPrefacePanel'
import { isRedLetter, splitRedLetterVerse } from '../data/redLetter'
import type { Segment } from '../data/redLetter'
import type { WordHighlight } from './WordStudyPanel'
import type { SelectedVerse, PassageRef } from '../types'

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Important',  hex: '#eab308' },
  { id: 'red',    label: 'Conviction', hex: '#ef4444' },
  { id: 'blue',   label: 'Promise',    hex: '#60a5fa' },
  { id: 'green',  label: 'Blessing',   hex: '#4ade80' },
]

// KJV archaic irregular forms → modern base
const KJV_IRREG: Record<string, string> = {
  // Copula (to be) — gloss "to be" maps to these KJV forms
  was: 'be', were: 'be', is: 'be', am: 'be', been: 'be',
  // Archaic 2nd-person copula
  art: 'be', wast: 'be',
  // Common -eth forms
  saith: 'say', hath: 'have', doth: 'do', doeth: 'do', goeth: 'go',
  seeth: 'see', cometh: 'come', knoweth: 'know', giveth: 'give',
  // Short -est forms (< 6 chars, can't be caught by suffix rule below)
  doest: 'do', goest: 'go',
  // Other archaics
  hast: 'have', wilt: 'will', shalt: 'shall',
  canst: 'can', wouldst: 'would', shouldst: 'should',
}

// Normalize a word for matching: handles KJV archaic forms, standard stemming, silent 'e'
function normalizeForMatch(s: string): string {
  let w = s.replace(/[^\w']/g, '').toLowerCase()
  if (KJV_IRREG[w]) return KJV_IRREG[w]
  // Strip KJV -eth suffix: maketh→mak, loveth→lov, speaketh→speak
  if (w.endsWith('eth') && w.length >= 5) w = w.slice(0, -3)
  // Strip KJV -est suffix (2nd person singular): makest→mak, knowest→know, sayest→say
  // Guard length >= 6 to avoid words like "chest", "best", "west"
  if (w.endsWith('est') && w.length >= 6) w = w.slice(0, -3)
  // Standard stemming
  const r = w.replace(/(ing|tion|ed|es|ly|s)$/, '')
  if (r.length >= 3) w = r
  // Strip trailing silent 'e' for consistent comparison: make→mak, love→lov
  if (w.endsWith('e') && w.length >= 4) w = w.slice(0, -1)
  return w
}

// Pronoun prefixes common in TAHOT verbal glosses ("he created", "she said", "they went")
const VERBAL_PREFIXES = new Set(['he', 'she', 'it', 'they', 'we', 'i', 'you', 'ye'])

// Phase 1: match a single specific gloss term (OpenGNT / TAHOT context-sensitive)
function resolveHighlightIndices(tokens: string[], hl: WordHighlight): Set<number> {
  const normalized = tokens.map(normalizeForMatch)

  if (hl.gloss) {
    // Try gloss words from most specific (longest) to least, skipping verbal pronoun prefixes.
    // This handles both single-word NT glosses ("beginning") and multi-word OT glosses ("he created").
    const glossWords = hl.gloss.split(/\s+/).map(normalizeForMatch).filter(w => w.length >= 2)
    const target = hl.positionRatio * (tokens.length - 1)

    // Sort: skip pronoun prefixes first, then prefer longer words
    const candidates = glossWords
      .filter(w => !VERBAL_PREFIXES.has(w))
      .sort((a, b) => b.length - a.length)
    // Fallback: if only pronoun prefix words, use them too
    const tryWords = candidates.length > 0 ? candidates : glossWords

    for (const g of tryWords) {
      const hits = normalized.map((_, i) => i).filter(i => normalized[i] === g)
      if (hits.length === 1) return new Set(hits)
      if (hits.length > 1) {
        hits.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
        return new Set([hits[0]])
      }
    }
    // Gloss not found (KJV/Berean divergence) — fall through to Phase 2
  }

  return resolveHighlightIndicesFuzzy(normalized, hl.glossTerms, hl.positionRatio, tokens.length)
}

// Phase 2: improved fuzzy fallback used for OT and NT cases where gloss is null/unmatched
function resolveHighlightIndicesFuzzy(
  normalized: string[],
  glossTerms: string[],
  positionRatio: number,
  tokenCount: number
): Set<number> {
  if (!glossTerms.length) return new Set()

  // Score each candidate token index by term priority + match type
  const scores = new Map<number, number>()

  for (let termIdx = 0; termIdx < glossTerms.length; termIdx++) {
    const termWeight = 1 / (termIdx + 1)
    const termParts = glossTerms[termIdx].split(/\s+/).map(normalizeForMatch)

    if (termParts.length === 1) {
      const t = termParts[0]
      for (let i = 0; i < normalized.length; i++) {
        const w = normalized[i]
        if (!w) continue
        if (w === t) scores.set(i, (scores.get(i) ?? 0) + termWeight * 2)
      }
    } else {
      // Multi-word phrase
      outer: for (let i = 0; i <= normalized.length - termParts.length; i++) {
        for (let j = 0; j < termParts.length; j++) {
          if (normalized[i + j] !== termParts[j]) continue outer
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
  compareText?: string
  selected: boolean
  highlightColor?: string
  wordHighlight?: WordHighlight | null
  redLetterOn: boolean
  isBookmarked: boolean
  translation: string
  onSelect: () => void
  onContextMenu: (verseNum: number, rect: DOMRect, text: string) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onWordClick?: (word: string) => void
  onBookmarkToggle: () => void
}

function VerseRow({ book, chapter, verseNum, text, compareText, selected, highlightColor, wordHighlight, redLetterOn, isBookmarked, translation, onSelect, onContextMenu, onNavigate, onWordClick, onBookmarkToggle }: VerseRowProps) {
  const refs = useCrossRefs(book, chapter, selected ? verseNum : 0, translation)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onContextMenu(verseNum, (e.currentTarget as HTMLElement).getBoundingClientRect(), text)
  }

  const primaryContent = (() => {
        const isRL = redLetterOn && isRedLetter(book, chapter, verseNum)
        const segs: Segment[] = isRL ? splitRedLetterVerse(text) : [{ t: text, red: false }]

        // Word-study highlight active — takes priority, no red letter
        if (selected && wordHighlight) {
          const tokens = text.split(/(\s+)/)
          const wordTokens = tokens.filter(t => /\S/.test(t))
          const highlighted = resolveHighlightIndices(wordTokens, wordHighlight)
          let wordIdx = 0
          return (
            <span className="verse-text">
              {tokens.map((token, i) => {
                if (!/\S/.test(token)) return token
                const idx = wordIdx++
                return <span key={i} className={highlighted.has(idx) ? 'word-highlight' : undefined}>{token}</span>
              })}
            </span>
          )
        }

        // Selected + concordance word-click mode — split attribution from speech, each word clickable
        if (selected && onWordClick) {
          let key = 0
          return (
            <span className="verse-text">
              {segs.flatMap(seg =>
                seg.t.split(/(\s+)/).map(token => {
                  const k = key++
                  if (!/\S/.test(token)) return token
                  const word = token.replace(/^[^a-zA-Z'-]+|[^a-zA-Z'-]+$/g, '')
                  if (!word) return <span key={k}>{token}</span>
                  return (
                    <span
                      key={k}
                      className={`verse-word-clickable${seg.red ? ' verse-speech' : ''}`}
                      onClick={e => { e.stopPropagation(); onWordClick(word) }}
                    >
                      {token}
                    </span>
                  )
                })
              )}
            </span>
          )
        }

        // Normal (non-selected) — render attribution in default color, speech in red
        return (
          <span className="verse-text">
            {segs.map((seg, i) =>
              seg.red
                ? <span key={i} className="verse-speech">{seg.t}</span>
                : <span key={i}>{seg.t}</span>
            )}
          </span>
        )
  })()

  return (
    <div
      ref={ref}
      className={`verse-row ${selected ? 'verse-row-selected' : ''} ${highlightColor ? `verse-hl-${highlightColor}` : ''} ${compareText !== undefined ? 'verse-row--parallel' : ''}`}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
    >
      <sup className="verse-num">{verseNum}</sup>
      {compareText !== undefined ? (
        <div className="verse-cols">
          {primaryContent}
          <span className="verse-text verse-text--compare">{compareText}</span>
        </div>
      ) : primaryContent}
      <button
        className={`verse-bookmark-btn${isBookmarked ? ' verse-bookmark-btn--on' : ''}`}
        onClick={e => { e.stopPropagation(); onBookmarkToggle() }}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark verse'}
      >
        {isBookmarked ? '★' : '☆'}
      </button>
      {selected && <CrossRefTooltip refs={refs} onNavigate={onNavigate} />}
    </div>
  )
}

interface ContextTarget {
  verse: number
  rect: DOMRect
  text: string
}

interface PassageSectionProps {
  passage: PassageRef
  activeVerse: SelectedVerse
  wordHighlight?: WordHighlight | null
  redLetterOn: boolean
  primaryTrans: string
  compareTrans: string | null
  bookmarkedKeys: Set<string>
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onAddNote: (book: string, chapter: number, verse: number, text: string) => void
  onWordClick?: (word: string) => void
  onViewParallels?: (book: string, chapter: number, verse: number) => void
  onBookmarkToggle: (book: string, chapter: number, verse: number, text: string) => void
}

function PassageSection({ passage, activeVerse, wordHighlight, redLetterOn, primaryTrans, compareTrans, bookmarkedKeys, onVerseClick, onNavigate, onAddNote, onWordClick, onViewParallels, onBookmarkToggle }: PassageSectionProps) {
  const { verses, loading } = useTranslationVerses(primaryTrans, passage.book, passage.chapter)
  const { verses: compareVerses } = useTranslationVerses(compareTrans ?? '', passage.book, passage.chapter)
  const compareMap = new Map(compareVerses.map(v => [v.verse, v.text]))
  const { highlights, setHighlight } = useHighlights(passage.book, passage.chapter)
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null)
  const [copyTarget, setCopyTarget] = useState<ContextTarget | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextTarget) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextTarget(null)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [contextTarget])

  const displayed = passage.verseStart
    ? verses.filter(v =>
        v.verse >= passage.verseStart! &&
        v.verse <= (passage.verseEnd ?? passage.verseStart!)
      )
    : verses

  if (passage.bookOnly) {
    return (
      <div className="passage-section">
        <BookPrefacePanel book={passage.book} onNavigate={onNavigate} />
      </div>
    )
  }

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
          highlightColor={highlights.get(v.verse)}
          wordHighlight={
            activeVerse.book === passage.book &&
            activeVerse.chapter === passage.chapter &&
            activeVerse.verse === v.verse ? wordHighlight : null
          }
          compareText={compareTrans ? compareMap.get(v.verse) : undefined}
          redLetterOn={redLetterOn}
          isBookmarked={bookmarkedKeys.has(`${passage.book}|${passage.chapter}|${v.verse}`)}
          translation={primaryTrans}
          onSelect={() => onVerseClick(passage.book, passage.chapter, v.verse)}
          onContextMenu={(verse, rect, text) => setContextTarget({ verse, rect, text })}
          onNavigate={onNavigate}
          onWordClick={onWordClick}
          onBookmarkToggle={() => onBookmarkToggle(passage.book, passage.chapter, v.verse, v.text)}
        />
      ))}
      {contextTarget && (
        <div
          ref={menuRef}
          className="verse-context-menu"
          style={{
            position: 'fixed',
            top: contextTarget.rect.bottom + 4,
            left: Math.min(contextTarget.rect.left, window.innerWidth - 160),
          }}
        >
          <button
            className="verse-context-item"
            onClick={() => { setCopyTarget(contextTarget); setContextTarget(null) }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Range
          </button>
          <button
            className="verse-context-item"
            onClick={() => {
              onAddNote(passage.book, passage.chapter, contextTarget.verse, contextTarget.text)
              setContextTarget(null)
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Add Note
          </button>
          {onViewParallels && (
            <button
              className="verse-context-item"
              onClick={() => {
                onViewParallels(passage.book, passage.chapter, contextTarget.verse)
                setContextTarget(null)
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="9" height="18" rx="1" />
                <rect x="13" y="3" width="9" height="18" rx="1" />
              </svg>
              Open Parallels
            </button>
          )}
          <div className="verse-context-hl-row">
            {HIGHLIGHT_COLORS.map(({ id, label, hex }) => {
              const active = highlights.get(contextTarget.verse) === id
              return (
                <button
                  key={id}
                  className={`hl-swatch${active ? ' hl-swatch--active' : ''}`}
                  style={{ background: hex }}
                  title={label}
                  onClick={() => {
                    setHighlight(contextTarget.verse, active ? '' : id)
                    setContextTarget(null)
                  }}
                />
              )
            })}
            {highlights.has(contextTarget.verse) && (
              <button
                className="hl-swatch-clear"
                title="Remove highlight"
                onClick={() => { setHighlight(contextTarget.verse, ''); setContextTarget(null) }}
              >✕</button>
            )}
          </div>
        </div>
      )}
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
  redLetterOn: boolean
  onRedLetterToggle: () => void
  bookmarkedKeys: Set<string>
  primaryTrans: string
  compareTrans: string | null
  availableTranslations: string[]
  onVerseClick: (book: string, chapter: number, verse: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onAddNote: (book: string, chapter: number, verse: number, text: string) => void
  onWordClick?: (word: string) => void
  onViewParallels?: (book: string, chapter: number, verse: number) => void
  onBookmarkToggle: (book: string, chapter: number, verse: number, text: string) => void
  onPrimaryTransChange: (t: string) => void
  onCompareTransChange: (t: string | null) => void
}

export function BiblePanel({ passages, activeVerse, wordHighlight, redLetterOn, onRedLetterToggle, bookmarkedKeys, primaryTrans, compareTrans, availableTranslations, onVerseClick, onNavigate, onAddNote, onWordClick, onViewParallels, onBookmarkToggle, onPrimaryTransChange, onCompareTransChange }: Props) {
  const otherTrans = availableTranslations.filter(t => t !== primaryTrans)
  return (
    <div className="panel bible-panel">
      <div className="panel-header">
        <div className="trans-bar">
          <select
            className="trans-select"
            value={primaryTrans}
            onChange={e => onPrimaryTransChange(e.target.value)}
          >
            {availableTranslations.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {otherTrans.length > 0 && (
            <button
              className={`parallel-btn${compareTrans ? ' parallel-btn--on' : ''}`}
              onClick={() => onCompareTransChange(compareTrans ? null : otherTrans[0])}
              title="Toggle parallel mode"
            >
              ∥
            </button>
          )}
          {compareTrans && (
            <select
              className="trans-select"
              value={compareTrans}
              onChange={e => onCompareTransChange(e.target.value)}
            >
              {otherTrans.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <button
          className={`rl-toggle-btn${redLetterOn ? ' rl-toggle-btn--on' : ''}`}
          onClick={onRedLetterToggle}
          title={redLetterOn ? 'Red letter on' : 'Red letter off'}
        >
          RL
        </button>
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
            redLetterOn={redLetterOn}
            primaryTrans={primaryTrans}
            compareTrans={compareTrans}
            bookmarkedKeys={bookmarkedKeys}
            onVerseClick={onVerseClick}
            onNavigate={onNavigate}
            onAddNote={onAddNote}
            onWordClick={onWordClick}
            onViewParallels={onViewParallels}
            onBookmarkToggle={onBookmarkToggle}
          />
        ))}
      </div>
    </div>
  )
}
