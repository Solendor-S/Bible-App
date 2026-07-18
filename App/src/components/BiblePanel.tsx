import React, { useEffect, useRef, useState } from 'react'
import { useTranslationVerses, useCrossRefs, useHighlights, useChapterFootnotes } from '../hooks/useBible'
import { CrossRefTooltip } from './CrossRefTooltip'
import { CopyRangePopover } from './CopyRangePopover'
import { BookPrefacePanel } from './BookPrefacePanel'
import { isRedLetter, splitRedLetterVerse } from '../data/redLetter'
import type { Segment } from '../data/redLetter'
import type { WordHighlight } from './WordStudyPanel'
import type { Footnote, SelectedVerse, PassageRef, StrongsEntry } from '../types'

const ANNOTATED_TRANS = new Set(['KJV+', 'I_KJV+'])

// ── DSS parser ────────────────────────────────────────────────

interface DssSeg { t: string; lacuna: boolean; uncertain: boolean; supralinear: boolean }

function parseDssMarkers(text: string): DssSeg[] {
  const segs: DssSeg[] = []
  let cur = ''
  let lacuna = false, uncertain = false, supralinear = false

  const flush = (l: boolean, u: boolean, s: boolean) => {
    if (cur) segs.push({ t: cur, lacuna, uncertain, supralinear })
    cur = ''; lacuna = l; uncertain = u; supralinear = s
  }

  let i = 0
  while (i < text.length) {
    const ch = text[i], next = text[i + 1]
    if (ch === '#' || ch === '?') { i++; continue }
    if (ch === '(' && next === '^') {
      flush(lacuna, true, true); i += 2
      if (text[i] === ' ') i++
    } else if (ch === '^' && next === ')') {
      if (cur.endsWith(' ')) cur = cur.slice(0, -1)
      flush(lacuna, false, false); i += 2
    } else if (ch === '[') { flush(true,  uncertain, supralinear); i++ }
      else if (ch === ']') { flush(false, uncertain, supralinear); i++ }
      else if (ch === '(') { flush(lacuna, true,  supralinear); i++ }
      else if (ch === ')') { flush(lacuna, false, supralinear); i++ }
      else { cur += ch; i++ }
  }
  if (cur) segs.push({ t: cur, lacuna, uncertain, supralinear })
  return segs.filter(s => s.t)
}

const DSS_KEY_ENTRIES = [
  { label: 'Normal text',             desc: 'Clearly preserved consonants',                                         color: undefined, small: false },
  { label: 'Reconstructed',           desc: 'Lacuna — letters restored by scholars from context',                   color: '#808080',  small: true  },
  { label: 'Uncertain',               desc: 'Letter is readable but not fully certain in the manuscript',           color: '#5B9BD5',  small: false },
  { label: 'Uncertain + supralinear', desc: 'Unclear and written above the line — scribal insertion (shown smaller)', color: '#5B9BD5', small: true  },
] as const

// ── KJV+ parser ───────────────────────────────────────────────

interface StrongsToken { word: string; strongs?: string; italic?: boolean }

function parseKJVPlus(text: string): StrongsToken[] {
  const tokens: StrongsToken[] = []
  const parts = text.split(' ')
  let pending: string | null = null
  let pendingItalic = false
  for (const p of parts) {
    if (p && /^[GH]\d+$/.test(p)) {
      if (pending !== null) { tokens.push({ word: pending, strongs: p, italic: pendingItalic || undefined }); pending = null; pendingItalic = false }
    } else {
      if (pending !== null) tokens.push({ word: pending, italic: pendingItalic || undefined })
      const italic = p.includes('{')
      pending = p ? (italic ? p.replace(/[{}]/g, '') : p) : null
      pendingItalic = italic
    }
  }
  if (pending !== null) tokens.push({ word: pending, italic: pendingItalic || undefined })
  return tokens
}

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Important',  hex: '#eab308' },
  { id: 'red',    label: 'Conviction', hex: '#ef4444' },
  { id: 'blue',   label: 'Promise',    hex: '#60a5fa' },
  { id: 'green',  label: 'Blessing',   hex: '#4ade80' },
]

const TRANS_GROUPS: { label: string; items: string[] }[] = [
  { label: 'English',              items: ['KJV', 'BSB', 'ASV', 'WEB'] },
  { label: 'English Interlinear',  items: ['KJV+', 'I_KJV+'] },
  { label: 'Greek OT (Septuagint)', items: ['LXX', 'E_LXX'] },
  { label: 'Hebrew OT',            items: ['WLC', 'DSS'] },
  { label: 'Greek NT',             items: ['SBLGNT', 'TAGNT', 'TR'] },
]

function TranslationDropdown({ value, options, onChange }: {
  value: string
  options: string[]
  onChange: (t: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="trans-dropdown" ref={ref}>
      <button className="trans-select trans-dropdown-btn" onClick={() => setOpen(o => !o)}>
        {value}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="trans-dropdown-menu">
          {TRANS_GROUPS.map(group => {
            const available = group.items.filter(t => options.includes(t))
            if (!available.length) return null
            return (
              <div key={group.label} className="book-group">
                <div className="book-group-label">{group.label}</div>
                <div className="book-group-items">
                  {available.map(t => (
                    <button
                      key={t}
                      className={`book-group-item${t === value ? ' book-group-item--active' : ''}`}
                      onClick={() => { onChange(t); setOpen(false) }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

interface FnPopupInfo {
  marker: string
  content: string
  x: number
  y: number
}

interface VerseRowProps {
  book: string
  chapter: number
  verseNum: number
  text: string
  compareText?: string
  compareTrans?: string | null
  selected: boolean
  highlightColor?: string
  wordHighlight?: WordHighlight | null
  redLetterOn: boolean
  isBookmarked: boolean
  translation: string
  footnotes?: Footnote[]
  onSelect: () => void
  onContextMenu: (verseNum: number, rect: DOMRect, text: string) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onWordClick?: (word: string) => void
  onBookmarkToggle: () => void
  onFnClick?: (info: FnPopupInfo) => void
  onStrongsClick?: (strongs: string, e: React.MouseEvent) => void
}

// Expands a text segment into React nodes, rendering {word} as italic.
function renderWithItalics(t: string, red: boolean, keyPfx: string): React.ReactNode[] {
  const ITALIC_RE = /\{([^}]+)\}/g
  const nodes: React.ReactNode[] = []
  let last = 0; let m: RegExpExecArray | null; let i = 0
  while ((m = ITALIC_RE.exec(t)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyPfx}-${i++}`} className={red ? 'verse-speech' : undefined}>{t.slice(last, m.index)}</span>)
    nodes.push(<em key={`${keyPfx}-${i++}`} className={`verse-italic${red ? ' verse-speech' : ''}`}>{m[1]}</em>)
    last = m.index + m[0].length
  }
  if (last < t.length) nodes.push(<span key={`${keyPfx}-${i++}`} className={red ? 'verse-speech' : undefined}>{t.slice(last)}</span>)
  return nodes
}

function VerseRow({ book, chapter, verseNum, text, compareText, compareTrans, selected, highlightColor, wordHighlight, redLetterOn, isBookmarked, translation, footnotes, onSelect, onContextMenu, onNavigate, onWordClick, onBookmarkToggle, onFnClick, onStrongsClick }: VerseRowProps) {
  const refs = useCrossRefs(book, chapter, selected ? verseNum : 0, translation)
  const ref = useRef<HTMLDivElement>(null)

  // Strip USFM inline markers e.g. \+w, \+w*, \+add, \+add*
  const dispText = text.replace(/\\[+]\w+\*?/g, '')

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onContextMenu(verseNum, (e.currentTarget as HTMLElement).getBoundingClientRect(), text)
  }

  // Build a map of actual word position → Footnote using anchor-phrase search.
  // USFM text word counts differ from our DB text, so stored word_index is unreliable.
  // Instead, extract the anchor phrase (text before ':' in content) and find it in the verse.
  const fnByWord: Map<number, Footnote> | null = (() => {
    if (!footnotes?.length) return null
    const rawWords = text.split(/\s+/).filter(w => w)
    const normWords = rawWords.map(w => w.toLowerCase().replace(/[^a-z'-]/g, ''))
    const map = new Map<number, Footnote>()
    for (const fn of footnotes) {
      const colonIdx = fn.content.indexOf(':')
      let insertAt = -1
      if (colonIdx > 0) {
        const anchor = fn.content.slice(0, colonIdx)
          .replace(/[…�â\xa6…]+/g, '').trim()
        const anchorWords = anchor.split(/\s+/)
          .map(w => w.toLowerCase().replace(/[^a-z'-]/g, '')).filter(w => w)
        if (anchorWords.length) {
          const last = anchorWords[anchorWords.length - 1]
          for (let i = normWords.length - 1; i >= 0; i--) {
            if (normWords[i] !== last) continue
            if (anchorWords.length === 1) { insertAt = i + 1; break }
            let match = true
            for (let j = 0; j < anchorWords.length; j++) {
              const vi = i - (anchorWords.length - 1 - j)
              if (vi < 0 || normWords[vi] !== anchorWords[j]) { match = false; break }
            }
            if (match) { insertAt = i + 1; break }
          }
        }
      }
      // Fallback: use stored word_index if anchor search failed and it's in range
      if (insertAt < 0 && fn.word_index <= normWords.length) insertAt = fn.word_index
      if (insertAt > 0 && !map.has(insertAt)) map.set(insertAt, fn)
    }
    return map.size ? map : null
  })()

  function emitFnMarker(fn: Footnote, key: string) {
    return (
      <sup
        key={key}
        className="fn-marker"
        onClick={e => {
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          onFnClick?.({ marker: fn.marker, content: fn.content, x: rect.left, y: rect.bottom + 6 })
        }}
      >{fn.marker}</sup>
    )
  }

  const primaryContent = (() => {
    // DSS: parse editorial markers and render multiple readings
    if (translation === 'DSS') {
      const readings = dispText.split(/\s*׃\s*/).map(s => s.trim()).filter(Boolean)
      return (
        <span className="verse-text dss-verse">
          {readings.map((reading, ri) => (
            <React.Fragment key={ri}>
              {ri > 0 && <span className="dss-reading-divider" />}
              {parseDssMarkers(reading).map((seg, i) => {
                const cls = seg.lacuna
                  ? 'dss-lacuna'
                  : seg.uncertain && seg.supralinear
                  ? 'dss-uncertain-supra'
                  : seg.uncertain
                  ? 'dss-uncertain'
                  : seg.supralinear
                  ? 'dss-supralinear'
                  : undefined
                return <span key={i} className={cls}>{seg.t}</span>
              })}
            </React.Fragment>
          ))}
        </span>
      )
    }

    // KJV+ interlinear: parse tokens and render clickable Strongs tags
    if (ANNOTATED_TRANS.has(translation)) {
      const tokens = parseKJVPlus(dispText)
      return (
        <span className="verse-text">
          {tokens.map((tok, i) => (
            <React.Fragment key={i}>
              <span className={tok.italic ? 'verse-italic' : undefined}>{tok.word}</span>
              {tok.strongs && (
                <sup
                  className="strongs-tag"
                  onClick={e => { e.stopPropagation(); onStrongsClick?.(tok.strongs!, e) }}
                >{tok.strongs}</sup>
              )}
              {' '}
            </React.Fragment>
          ))}
        </span>
      )
    }

    const isRL = redLetterOn && isRedLetter(book, chapter, verseNum)
    const segs: Segment[] = isRL ? splitRedLetterVerse(dispText) : [{ t: dispText, red: false }]
    const vtCls = translation === 'WLC' ? 'verse-text verse-rtl' : 'verse-text'

    // Word-study highlight active — takes priority over red letter
    // Strip {} markers for clean word-boundary matching
    if (selected && wordHighlight) {
      const cleanText = dispText.replace(/\{([^}]+)\}/g, '$1')
      const tokens = cleanText.split(/(\s+)/)
      const wordTokens = tokens.filter(t => /\S/.test(t))
      const highlighted = resolveHighlightIndices(wordTokens, wordHighlight)
      let wordIdx = 0
      const elems: React.ReactNode[] = []
      tokens.forEach((token, i) => {
        if (!/\S/.test(token)) { elems.push(token); return }
        const idx = wordIdx++
        elems.push(<span key={i} className={highlighted.has(idx) ? 'word-highlight' : undefined}>{token}</span>)
        const fn = fnByWord?.get(wordIdx)
        if (fn) elems.push(emitFnMarker(fn, `fn-${i}`))
      })
      return <span className={vtCls}>{elems}</span>
    }

    // Selected + concordance word-click mode
    if (selected && onWordClick) {
      let wordIdx = 0
      let key = 0
      const elems: React.ReactNode[] = []
      segs.forEach(seg => {
        // Strip {} for word extraction but keep display clean
        seg.t.replace(/\{([^}]+)\}/g, '$1').split(/(\s+)/).forEach(token => {
          const k = key++
          if (!/\S/.test(token)) { elems.push(token); return }
          wordIdx++
          const word = token.replace(/^[^a-zA-Z'-]+|[^a-zA-Z'-]+$/g, '')
          elems.push(
            word
              ? <span key={k} className={`verse-word-clickable${seg.red ? ' verse-speech' : ''}`}
                  onClick={e => { e.stopPropagation(); onWordClick(word) }}>{token}</span>
              : <span key={k}>{token}</span>
          )
          const fn = fnByWord?.get(wordIdx)
          if (fn) elems.push(emitFnMarker(fn, `fn-${k}`))
        })
      })
      return <span className={vtCls}>{elems}</span>
    }

    // Normal mode — red letter + {italic} rendering + optional footnote markers
    if (!fnByWord) {
      // Fast path: no footnotes
      return (
        <span className={vtCls}>
          {segs.map((seg, i) => renderWithItalics(seg.t, seg.red, `s${i}`))}
        </span>
      )
    }
    // Slow path: walk word-by-word to inject footnote markers (strip {} for word count)
    let wordIdx = 0
    let key = 0
    const elems: React.ReactNode[] = []
    segs.forEach(seg => {
      const cleanSeg = seg.t.replace(/\{([^}]+)\}/g, '$1')
      cleanSeg.split(/(\s+)/).forEach(token => {
        const k = key++
        if (!/\S/.test(token)) { elems.push(token); return }
        wordIdx++
        elems.push(seg.red
          ? <span key={k} className="verse-speech">{token}</span>
          : <span key={k}>{token}</span>
        )
        const fn = fnByWord.get(wordIdx)
        if (fn) elems.push(emitFnMarker(fn, `fn-${k}`))
      })
    })
    return <span className={vtCls}>{elems}</span>
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
          {compareTrans && ANNOTATED_TRANS.has(compareTrans) && compareText ? (
            <span className="verse-text verse-text--compare">
              {parseKJVPlus(compareText.replace(/\\[+]\w+\*?/g, '')).map((tok, i) => (
                <React.Fragment key={i}>
                  <span className={tok.italic ? 'verse-italic' : undefined}>{tok.word}</span>
                  {tok.strongs && (
                    <sup className="strongs-tag" onClick={e => { e.stopPropagation(); onStrongsClick?.(tok.strongs!, e) }}>{tok.strongs}</sup>
                  )}
                  {' '}
                </React.Fragment>
              ))}
            </span>
          ) : (
            <span className="verse-text verse-text--compare">{compareText}</span>
          )}
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
  onStrongsView?: (strongs: string) => void
}

interface StrongsPopupState {
  strongs: string
  x: number
  y: number
  entry: StrongsEntry | null
  loading: boolean
}

function passageLabel(p: PassageRef): string {
  if (!p.verseStart) return `${p.book} ${p.chapter}`
  const end = p.verseEnd && p.verseEnd < 999 ? `–${p.verseEnd}` : ''
  return `${p.book} ${p.chapter}:${p.verseStart}${end}`
}

function PassageSection({ passage, activeVerse, wordHighlight, redLetterOn, primaryTrans, compareTrans, bookmarkedKeys, onVerseClick, onNavigate, onAddNote, onWordClick, onViewParallels, onBookmarkToggle, onStrongsView }: PassageSectionProps) {
  const { verses, loading } = useTranslationVerses(primaryTrans, passage.book, passage.chapter)
  const { verses: compareVerses } = useTranslationVerses(compareTrans ?? '', passage.book, passage.chapter)
  const compareMap = new Map(compareVerses.map(v => [v.verse, v.text]))
  const { highlights, setHighlight } = useHighlights(passage.book, passage.chapter)
  const footnotesMap = useChapterFootnotes(primaryTrans, passage.book, passage.chapter)
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null)
  const [copyTarget, setCopyTarget] = useState<ContextTarget | null>(null)
  const [fnPopup, setFnPopup] = useState<FnPopupInfo | null>(null)
  const [strongsPopup, setStrongsPopup] = useState<StrongsPopupState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const strongsPopupRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextTarget) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextTarget(null)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [contextTarget])

  // Close footnote popup on any click
  useEffect(() => {
    if (!fnPopup) return
    function handler() { setFnPopup(null) }
    const id = setTimeout(() => document.addEventListener('click', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('click', handler) }
  }, [fnPopup])

  // Close Strongs popup on outside click
  useEffect(() => {
    if (!strongsPopup) return
    function handler(e: MouseEvent) {
      if (strongsPopupRef.current && !strongsPopupRef.current.contains(e.target as Node)) setStrongsPopup(null)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [strongsPopup])

  function handleStrongsClick(strongs: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 280)
    const y = rect.bottom + 6
    setStrongsPopup({ strongs, x, y, entry: null, loading: true })
    const lang = strongs.startsWith('G') ? 'greek' : 'hebrew'
    window.bibleApi.getStrongsEntry(lang as 'greek' | 'hebrew', strongs)
      .then(entry => setStrongsPopup(p => p?.strongs === strongs ? { ...p, entry, loading: false } : p))
      .catch(() => setStrongsPopup(p => p?.strongs === strongs ? { ...p, loading: false } : p))
  }

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
      <div className="passage-section-header">{passageLabel(passage)}</div>
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
          compareTrans={compareTrans}
          redLetterOn={redLetterOn}
          isBookmarked={bookmarkedKeys.has(`${passage.book}|${passage.chapter}|${v.verse}`)}
          translation={primaryTrans}
          footnotes={footnotesMap.get(v.verse)}
          onSelect={() => onVerseClick(passage.book, passage.chapter, v.verse)}
          onContextMenu={(verse, rect, text) => setContextTarget({ verse, rect, text })}
          onNavigate={onNavigate}
          onWordClick={onWordClick}
          onBookmarkToggle={() => onBookmarkToggle(passage.book, passage.chapter, v.verse, v.text)}
          onFnClick={setFnPopup}
          onStrongsClick={handleStrongsClick}
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
      {fnPopup && (
        <div
          className="fn-popup"
          style={{
            top: Math.min(fnPopup.y, window.innerHeight - 100),
            left: Math.min(fnPopup.x, window.innerWidth - 320),
          }}
        >
          <span className="fn-popup-marker">{fnPopup.marker}</span>
          {fnPopup.content}
        </div>
      )}
      {strongsPopup && (
        <div
          ref={strongsPopupRef}
          className="strongs-popup"
          style={{
            top: Math.min(strongsPopup.y, window.innerHeight - 180),
            left: strongsPopup.x,
          }}
        >
          {strongsPopup.loading ? (
            <div className="strongs-popup-loading">Loading…</div>
          ) : strongsPopup.entry ? (
            <>
              <div className="strongs-popup-header">
                <span className="strongs-popup-lemma">{strongsPopup.entry.lemma}</span>
                <span className="strongs-popup-num">{strongsPopup.strongs}</span>
              </div>
              <div className="strongs-popup-translit">{strongsPopup.entry.translit}{strongsPopup.entry.pronunciation ? ` · ${strongsPopup.entry.pronunciation}` : ''}</div>
              <div className="strongs-popup-def">{strongsPopup.entry.definition}</div>
              {strongsPopup.entry.kjv_usage && (
                <div className="strongs-popup-kjv">KJV: {strongsPopup.entry.kjv_usage}</div>
              )}
            </>
          ) : (
            <div className="strongs-popup-loading">No entry found</div>
          )}
          {onStrongsView && (
            <button
              className="strongs-popup-view-btn"
              onClick={() => { setStrongsPopup(null); onStrongsView(strongsPopup.strongs) }}
            >
              View in Study Panel →
            </button>
          )}
        </div>
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
  onStrongsView?: (strongs: string) => void
}

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24]
const FONT_SIZE_KEY = 'bible-font-size'

export function BiblePanel({ passages, activeVerse, wordHighlight, redLetterOn, onRedLetterToggle, bookmarkedKeys, primaryTrans, compareTrans, availableTranslations, onVerseClick, onNavigate, onAddNote, onWordClick, onViewParallels, onBookmarkToggle, onPrimaryTransChange, onCompareTransChange, onStrongsView }: Props) {
  const otherTrans = availableTranslations.filter(t => t !== primaryTrans)
  const [dssKeyOpen, setDssKeyOpen] = useState(false)
  const dssKeyRef = useRef<HTMLDivElement>(null)
  const [fontSizeIdx, setFontSizeIdx] = useState(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY)
    if (saved) { const idx = FONT_SIZES.indexOf(Number(saved)); if (idx !== -1) return idx }
    return FONT_SIZES.indexOf(15)
  })

  useEffect(() => {
    if (!dssKeyOpen) return
    function handler(e: MouseEvent) {
      if (dssKeyRef.current && !dssKeyRef.current.contains(e.target as Node)) setDssKeyOpen(false)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [dssKeyOpen])

  return (
    <div className="panel bible-panel">
      <div className="panel-header">
        <div className="trans-bar">
          <TranslationDropdown
            value={primaryTrans}
            options={availableTranslations}
            onChange={onPrimaryTransChange}
          />
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
            <TranslationDropdown
              value={compareTrans}
              options={otherTrans}
              onChange={onCompareTransChange}
            />
          )}
        </div>
        {primaryTrans === 'DSS' && (
          <div className="dss-key-wrap" ref={dssKeyRef}>
            <button className="dss-key-btn" onClick={() => setDssKeyOpen(o => !o)}>Key</button>
            {dssKeyOpen && (
              <div className="dss-key-popup">
                <div className="dss-key-title">DSS Notation Key</div>
                {DSS_KEY_ENTRIES.map(entry => (
                  <div key={entry.label} className="dss-key-row">
                    <span
                      className="dss-key-sample"
                      style={{ color: entry.color, fontSize: entry.small ? '0.8em' : undefined }}
                    >
                      אבג
                    </span>
                    <div className="dss-key-info">
                      <span className="dss-key-label" style={{ color: entry.color }}>{entry.label}</span>
                      <span className="dss-key-desc">{entry.desc}</span>
                    </div>
                  </div>
                ))}
                <div className="dss-key-note">
                  Multiple readings per verse reflect different scroll manuscripts attesting the same passage.
                </div>
              </div>
            )}
          </div>
        )}
        <div className="font-size-controls">
          <button
            className="font-size-btn"
            onClick={() => setFontSizeIdx(i => { const n = Math.max(0, i - 1); localStorage.setItem(FONT_SIZE_KEY, String(FONT_SIZES[n])); return n })}
            disabled={fontSizeIdx === 0}
            title="Decrease font size"
          >A−</button>
          <button
            className="font-size-btn font-size-btn--reset"
            onClick={() => { const def = FONT_SIZES.indexOf(15); setFontSizeIdx(def); localStorage.setItem(FONT_SIZE_KEY, '15') }}
            disabled={FONT_SIZES[fontSizeIdx] === 15}
            title="Reset font size"
          >A</button>
          <button
            className="font-size-btn"
            onClick={() => setFontSizeIdx(i => { const n = Math.min(FONT_SIZES.length - 1, i + 1); localStorage.setItem(FONT_SIZE_KEY, String(FONT_SIZES[n])); return n })}
            disabled={fontSizeIdx === FONT_SIZES.length - 1}
            title="Increase font size"
          >A+</button>
        </div>
        <button
          className={`rl-toggle-btn${redLetterOn ? ' rl-toggle-btn--on' : ''}`}
          onClick={onRedLetterToggle}
          title={redLetterOn ? 'Red letter on' : 'Red letter off'}
        >
          RL
        </button>
      </div>
      <div className="panel-body" style={{ '--verse-font-size': `${FONT_SIZES[fontSizeIdx]}px` } as React.CSSProperties}>
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
            onStrongsView={onStrongsView}
          />
        ))}
      </div>
    </div>
  )
}
