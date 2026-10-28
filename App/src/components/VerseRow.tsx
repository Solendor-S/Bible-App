// One verse in the reader — DOM port of the Android VerseRow (ReaderScreen.tsx), plus the
// desktop extras: bookmark star, note marker, Words-tab word highlight, right-click menu.
import React, { memo, useEffect, useMemo, useRef } from 'react'
import { isRedLetter, splitByWMarkers, splitRedLetterVerse, stripUsfm } from '../data/redLetter'
import type { Segment } from '../data/redLetter'
import type { OtQuoteSpan } from '../db/queries'
import {
  applyItalics, applyOtQuoteCaps, buildFnByWord, focusSplit, formatBsbText, INLINE_BOOK_RE,
  INLINE_SCRIPTURE_RE, parseDssMarkers, parseKJVPlus,
} from '../lib/verseText'
import { resolveHighlightIndices } from '../lib/wordHighlight'
import type { WordHighlight } from '../lib/wordHighlight'
import { ANNOTATED_TRANSLATIONS, HEBREW_TRANSLATIONS } from '../data/translations'
import type { BsbFootnote, CrossRef, ElxxNote, Footnote } from '../types'

export interface NoteTarget { marker: string; content: string; rect: DOMRect; refs?: boolean }

export interface VerseRowProps {
  book: string
  chapter: number
  verse: number
  text: string
  translation: string
  kind?: 'apocrypha' | 'early'
  selected: boolean
  hlColor?: string
  bookmarked: boolean
  hasNote: boolean
  compareText?: string
  compareTrans?: string | null
  footnotes?: Footnote[]
  bsbFootnotes?: BsbFootnote[]
  elxxNotes?: ElxxNote[]
  otSpans?: OtQuoteSpan[]
  crossRefs?: CrossRef[]
  redLetter: boolean
  focusMode: boolean
  bsbFolded: boolean
  dssAllReadings: boolean
  wordHighlight?: WordHighlight | null
  onSelect: (verse: number) => void
  onContextMenu: (verse: number, rect: DOMRect) => void
  onWordClick: (word: string) => void
  onStrongs: (strongs: string) => void
  onNote: (n: NoteTarget) => void
  onEarlyFootnote: (marker: number, rect: DOMRect) => void
  onCrossRef: (ref: CrossRef) => void
  onInlineRef: (book: string, chapter: number, verse: number) => void
  onBookmarkToggle: (verse: number) => void
}

const rectOf = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).getBoundingClientRect()

function segClass(seg: Segment) {
  return [seg.red && 'verse-speech', seg.italic && 'verse-italic', seg.caps && 'verse-caps'].filter(Boolean).join(' ') || undefined
}

function Annotated({ text, lazy, onStrongs, className }: { text: string; lazy: boolean; onStrongs: (s: string) => void; className: string }) {
  const tokens = useMemo(() => parseKJVPlus(text, lazy), [text, lazy])
  return (
    <span className={className}>
      {tokens.map((tok, i) => (
        <React.Fragment key={i}>
          <span className={tok.italic ? 'verse-italic' : undefined}>{tok.word}</span>
          {tok.strongs?.map(s => (
            <sup key={s} className="strongs-tag" onClick={e => { e.stopPropagation(); onStrongs(s) }}>{s}</sup>
          ))}{' '}
        </React.Fragment>
      ))}
    </span>
  )
}

export const VerseRow = memo(function VerseRow(p: VerseRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isBsb = p.translation === 'BSB'
  const isHebrew = HEBREW_TRANSLATIONS.has(p.translation) && !p.kind
  const isAnnotated = ANNOTATED_TRANSLATIONS.has(p.translation) && !p.kind
  const isDss = p.translation === 'DSS' && !p.kind

  useEffect(() => { if (p.selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [p.selected])

  const cleanText = useMemo(() => {
    const stripped = stripUsfm(p.text)
    return isBsb ? formatBsbText(stripped, p.bsbFolded) : stripped
  }, [p.text, isBsb, p.bsbFolded])

  const segments = useMemo<Segment[]>(() => {
    if (isAnnotated || isDss || p.kind === 'early') return []
    const markerSegs = p.redLetter ? splitByWMarkers(p.text) : null
    const heuristic = p.translation !== 'KJV' && p.translation !== 'WEB'
    const isRL = p.redLetter && !p.kind && isRedLetter(p.book, p.chapter, p.verse)
    const base = markerSegs ?? (isRL && heuristic ? splitRedLetterVerse(cleanText) : [{ t: cleanText, red: false }])
    let segs = cleanText.includes('{') ? base.flatMap(applyItalics) : base
    for (const span of p.otSpans ?? []) segs = applyOtQuoteCaps(segs, span.word_start, span.word_end)
    return segs
  }, [isAnnotated, isDss, p.kind, p.text, cleanText, p.redLetter, p.translation, p.book, p.chapter, p.verse, p.otSpans])

  const fnByWord = useMemo(() => p.footnotes?.length ? buildFnByWord(cleanText, p.footnotes) : null, [cleanText, p.footnotes])
  const bsbByWord = useMemo(() => p.bsbFootnotes?.length ? new Map(p.bsbFootnotes.map(f => [f.word_index, f])) : null, [p.bsbFootnotes])
  const elxxByWord = useMemo(() => p.elxxNotes?.length ? new Map(p.elxxNotes.map(n => [n.word_index, n])) : null, [p.elxxNotes])

  const body = (() => {
    if (isDss) {
      const all = p.text.split(/\s*׃\s*/).map(s => s.trim()).filter(Boolean)
      return (
        <span className="verse-text verse-rtl dss-verse">
          {(p.dssAllReadings ? all : all.slice(0, 1)).map((reading, ri) => (
            <React.Fragment key={ri}>
              {ri > 0 && <span className="dss-reading-divider" />}
              {parseDssMarkers(reading).map((seg, i) => (
                <span key={i} className={seg.lacuna ? 'dss-lacuna' : seg.uncertain && seg.supralinear ? 'dss-uncertain-supra'
                  : seg.uncertain ? 'dss-uncertain' : seg.supralinear ? 'dss-supralinear' : undefined}>{seg.t}</span>
              ))}
            </React.Fragment>
          ))}
        </span>
      )
    }

    if (p.kind === 'early') {
      return (
        <span className="verse-text early-text">
          {p.text.split(/\n{2,}/).map((para, pi) => (
            <span key={pi} className={pi > 0 ? 'early-para' : undefined}>
              {para.split(INLINE_SCRIPTURE_RE).map((part, i) => {
                const fn = part.match(/^\[(\d+)\]$/)
                if (fn) return <sup key={i} className="fn-marker" onClick={e => { e.stopPropagation(); p.onEarlyFootnote(+fn[1], rectOf(e)) }}>{part}</sup>
                const r = part.match(INLINE_BOOK_RE)
                if (r) return <button key={i} className="inline-ref" onClick={e => { e.stopPropagation(); p.onInlineRef(r[1].replace(/\s+/g, ' ').trim(), +r[2], +r[3]) }}>{part}</button>
                return <React.Fragment key={i}>{part}</React.Fragment>
              })}
            </span>
          ))}
        </span>
      )
    }

    if (isAnnotated) return <Annotated text={cleanText} lazy={p.translation === 'KJV+'} onStrongs={p.onStrongs} className="verse-text" />

    // Word-by-word path: selection (clickable words), word highlight, focus mode, note markers
    const hasMarkers = !!(fnByWord || bsbByWord?.size || elxxByWord?.size)
    const useFocus = p.focusMode && !isHebrew
    const vtCls = `verse-text${isHebrew ? ' verse-rtl' : ''}`
    if (!p.selected && !hasMarkers && !useFocus) {
      return <span className={vtCls}>{segments.map((s, i) => <span key={i} className={segClass(s)}>{s.t}</span>)}</span>
    }

    let hlIdx: Set<number> | null = null
    if (p.selected && p.wordHighlight) {
      const words = segments.flatMap(s => s.t.split(/\s+/).filter(Boolean))
      hlIdx = resolveHighlightIndices(words, p.wordHighlight)
    }
    let wordIdx = 0
    const out: React.ReactNode[] = []
    segments.forEach((seg, si) => {
      seg.t.split(/(\s+)/).forEach((tok, ti) => {
        const key = `${si}-${ti}`
        if (!tok || /^\s+$/.test(tok)) { out.push(tok); return }
        const idx = wordIdx++
        const cls = [segClass(seg), hlIdx?.has(idx) && 'word-highlight', p.selected && 'verse-word-clickable'].filter(Boolean).join(' ') || undefined
        const [bold, rest] = useFocus ? focusSplit(tok) : [tok, '']
        out.push(
          <span key={key} className={cls} onClick={p.selected ? e => { e.stopPropagation(); p.onWordClick(tok) } : undefined}>
            {rest ? <><b className="focus-bold">{bold}</b>{rest}</> : bold}
          </span>
        )
        const fn = fnByWord?.get(idx + 1)
        if (fn) out.push(<sup key={`fn${key}`} className="fn-marker" onClick={e => { e.stopPropagation(); p.onNote({ marker: fn.marker, content: fn.content, rect: rectOf(e) }) }}>{fn.marker}</sup>)
        const bfn = bsbByWord?.get(idx)
        if (bfn) out.push(<sup key={`b${key}`} className="fn-marker" onClick={e => { e.stopPropagation(); p.onNote({ marker: bfn.word, content: bfn.footnote, rect: rectOf(e), refs: true }) }}>[fn]</sup>)
        const en = elxxByWord?.get(idx)
        if (en) out.push(<sup key={`e${key}`} className="fn-marker" onClick={e => { e.stopPropagation(); p.onNote({ marker: 'Note', content: en.note, rect: rectOf(e), refs: true }) }}>[fn]</sup>)
      })
    })
    return <span className={vtCls}>{out}</span>
  })()

  const compare = p.compareText !== undefined && (
    p.compareTrans && ANNOTATED_TRANSLATIONS.has(p.compareTrans)
      ? <Annotated text={stripUsfm(p.compareText)} lazy={p.compareTrans === 'KJV+'} onStrongs={p.onStrongs} className="verse-text verse-text--compare" />
      : <span className={`verse-text verse-text--compare${p.compareTrans && HEBREW_TRANSLATIONS.has(p.compareTrans) ? ' verse-rtl' : ''}`}>
          {p.compareTrans === 'BSB' ? formatBsbText(stripUsfm(p.compareText), p.bsbFolded).replace(/[{}]/g, '') : stripUsfm(p.compareText)}
        </span>
  )

  return (
    <div
      ref={ref}
      className={`verse-row${p.selected ? ' verse-row-selected' : ''}${p.hlColor ? ` verse-hl-${p.hlColor}` : ''}${compare ? ' verse-row--parallel' : ''}`}
      onClick={() => p.onSelect(p.verse)}
      onContextMenu={e => { e.preventDefault(); p.onContextMenu(p.verse, rectOf(e)) }}
    >
      <sup className="verse-num">
        {p.verse}
        {p.crossRefs?.length ? <span className="crossref-marker" title="Old Testament reference" onClick={e => { e.stopPropagation(); p.onCrossRef(p.crossRefs![0]) }}>†</span> : null}
      </sup>
      {compare ? <div className="verse-cols">{body}{compare}</div> : body}
      {p.hasNote && <span className="verse-note-dot" title="Has a note">✎</span>}
      <button
        className={`verse-bookmark-btn${p.bookmarked ? ' verse-bookmark-btn--on' : ''}`}
        onClick={e => { e.stopPropagation(); p.onBookmarkToggle(p.verse) }}
        title={p.bookmarked ? 'Remove bookmark' : 'Bookmark verse'}
      >{p.bookmarked ? '★' : '☆'}</button>
    </div>
  )
})
