// Reader — feature parity with the Android ReaderScreen in the desktop multi-passage layout.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChapter, useCompareText } from '../hooks/useChapter'
import type { ChapterData } from '../hooks/useChapter'
import { VerseRow } from './VerseRow'
import type { NoteTarget } from './VerseRow'
import { CopyRangePopover } from './CopyRangePopover'
import { PrefaceView } from './PrefaceView'
import { EsvSetupModal } from './EsvSetupModal'
import { ScripturePreviewModal } from './ScripturePreviewModal'
import type { PreviewTarget } from './ScripturePreviewModal'
import { StrongsDialog } from './StrongsModals'
import { Toggle, useOutsideClick } from './Modal'
import { ESV_COPYRIGHT } from '../lib/esv'
import { stripUsfm } from '../data/redLetter'
import { abbrevBook, ELXX_REF_RE, parseBsbRef, parseElxxRef, parseItalicSegments } from '../lib/verseText'
import type { WordHighlight } from '../lib/wordHighlight'
import { APOCRYPHA_BOOK_MAP, BOOK_MAP, BOOKS, EARLY_TEXT_MAP } from '../data/books'
import { HIGHLIGHT_COLORS } from '../theme/highlightColors'
import {
  GREEK_TRANSLATIONS, INCOMPLETE_DATASET_NOTE, OT_TRANSLATIONS, TRANSLATION_GROUPS, TRANSLATION_MAP,
} from '../data/translations'
import type { Translation } from '../data/translations'
import { parsePassage } from '../lib/parsePassage'
import { usePref } from '../context/Prefs'
import { userDb } from '../db/sqlite'
import { addBookmark, recordHistory, removeBookmark, removeHighlight, setHighlight } from '../db/queries'
import type { EarlyTextRef } from '../db/queries'
import type { PassageRef, SelectedVerse } from '../types'

type Nav = (book: string, chapter: number, verse: number) => void

export interface ReaderCallbacks {
  onVerseClick: Nav
  onNavigate: Nav
  onAddNote: (book: string, chapter: number, verse: number) => void
  onWordClick: (word: string) => void
  onViewParallels: Nav
  onStrongsView: (strongs: string) => void
  onBookmarksChanged: () => void
}

// ── Translation picker ────────────────────────────────────

function TranslationPicker({ value, onChange, exclude, allowEsv = true, onSetupEsv }: {
  value: string
  onChange: (t: Translation) => void
  exclude?: string | null
  allowEsv?: boolean
  onSetupEsv?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))
  return (
    <div className="trans-dropdown" ref={ref}>
      <button className="trans-select trans-dropdown-btn" onClick={() => setOpen(o => !o)} title={TRANSLATION_MAP[value as Translation]?.full}>
        {TRANSLATION_MAP[value as Translation]?.label ?? value} ▾
      </button>
      {open && (
        <div className="trans-dropdown-menu">
          {TRANSLATION_GROUPS.map(g => (
            <div key={g.label} className="trans-group">
              <div className="book-group-label">{g.label}</div>
              {g.keys.filter(k => k !== exclude && (allowEsv || !TRANSLATION_MAP[k].apiOnly)).map(k => (
                <button key={k} className={`trans-item${k === value ? ' trans-item--active' : ''}`} onClick={() => { onChange(k); setOpen(false) }}>
                  <span className="trans-item-key">{TRANSLATION_MAP[k].label}</span>
                  <span className="trans-item-full">{TRANSLATION_MAP[k].full}</span>
                  {INCOMPLETE_DATASET_NOTE[k] && <span className="trans-item-note">{INCOMPLETE_DATASET_NOTE[k]}</span>}
                </button>
              ))}
            </div>
          ))}
          {allowEsv && onSetupEsv && (
            <button className="trans-dropdown-setup" onClick={() => { setOpen(false); onSetupEsv() }}>Set up the ESV…</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Key popovers (DSS / BSB) ──────────────────────────────

const DSS_KEY = [
  { label: 'Normal text', desc: 'Clearly preserved consonants', cls: '' },
  { label: 'Reconstructed', desc: 'Lacuna — letters restored by scholars from context', cls: 'dss-lacuna' },
  { label: 'Uncertain', desc: 'Letter is readable but not fully certain in the manuscript', cls: 'dss-uncertain' },
  { label: 'Supralinear', desc: 'Added above the main line — scribal correction or insertion (shown smaller)', cls: 'dss-supralinear' },
  { label: 'Uncertain + supralinear', desc: 'Both unclear and written above the line (shown smaller, in blue)', cls: 'dss-uncertain-supra' },
]

function KeyPopover({ kind }: { kind: 'DSS' | 'BSB' }) {
  const [open, setOpen] = useState(false)
  const [dssAll, setDssAll] = usePref('dss_all_readings')
  const [folded, setFolded] = usePref('bsb_folded')
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))
  return (
    <div className="dss-key-wrap" ref={ref}>
      <button className="dss-key-btn" onClick={() => setOpen(o => !o)}>Key</button>
      {open && (
        <div className="dss-key-popup">
          {kind === 'DSS' ? (
            <>
              <div className="dss-key-title">DSS Notation Key</div>
              {DSS_KEY.map(k => (
                <div key={k.label} className="dss-key-row">
                  <span className={`dss-key-sample ${k.cls}`}>אבג</span>
                  <div className="dss-key-info"><span className="dss-key-label">{k.label}</span><span className="dss-key-desc">{k.desc}</span></div>
                </div>
              ))}
              <Toggle on={dssAll} onChange={setDssAll} label="All readings" desc="Show all manuscript attestations per verse" />
              <div className="dss-key-note">Multiple readings per verse reflect different scroll manuscripts attesting the same passage.</div>
            </>
          ) : (
            <>
              <div className="dss-key-title">BSB Key</div>
              <Toggle on={folded} onChange={setFolded} label=". . ." desc="One or more Greek words folded into the surrounding English phrase — shown for transparency" />
              <div className="dss-key-row"><span className="dss-key-sample verse-italic">italic</span><div className="dss-key-info"><span className="dss-key-desc">Supplied word not present in the original — added for English readability</span></div></div>
              <div className="dss-key-row"><span className="dss-key-sample fn-marker">[fn]</span><div className="dss-key-info"><span className="dss-key-desc">Click to view a translator footnote for that word</span></div></div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Reading-mode prose ────────────────────────────────────

function ProseChapter({ verses }: { verses: { verse: number; text: string }[] }) {
  const paragraphs = useMemo(() => {
    const groups: { verse: number; segs: { t: string; italic: boolean }[] }[][] = []
    let cur: typeof groups[number] = []
    for (const v of verses) {
      if (v.text.startsWith('¶') && cur.length) { groups.push(cur); cur = [] }
      cur.push({ verse: v.verse, segs: parseItalicSegments(stripUsfm(v.text.replace(/^¶\s*/, ''))) })
    }
    if (cur.length) groups.push(cur)
    return groups
  }, [verses])
  return (
    <div className="prose">
      {paragraphs.map((g, gi) => (
        <p key={gi}>{g.map(v => (
          <React.Fragment key={v.verse}>
            <sup className="prose-num">{v.verse}</sup>
            {v.segs.map((s, si) => s.italic ? <em key={si}>{s.t}</em> : <React.Fragment key={si}>{s.t}</React.Fragment>)}{' '}
          </React.Fragment>
        ))}</p>
      ))}
    </div>
  )
}

function EarlyRefs({ refs, onPress }: { refs: EarlyTextRef[]; onPress: Nav }) {
  if (!refs.length) return null
  const chips = (list: EarlyTextRef[]) => (
    <div className="chip-wrap">{list.map((r, i) => (
      <button key={i} className="chip chip--small" onClick={() => onPress(r.ref_book, r.ref_chapter, r.ref_verse)}>
        {abbrevBook(r.ref_book)} {r.ref_chapter}:{r.ref_verse}
      </button>
    ))}</div>
  )
  const quotes = refs.filter(r => r.ref_type === 'quote')
  const allusions = refs.filter(r => r.ref_type === 'allusion')
  return (
    <div className="early-refs">
      <div className="section-label">Scripture References</div>
      {quotes.length > 0 && <><div className="early-refs-kind">Quotes</div>{chips(quotes)}</>}
      {allusions.length > 0 && <><div className="early-refs-kind">Allusions</div>{chips(allusions)}</>}
    </div>
  )
}

/** Renders a note with its scripture refs clickable (BSB "See John 3:16", Brenton "Mat. 3. 3"). */
function NoteText({ text, onRef }: { text: string; onRef: Nav }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(new RegExp(ELXX_REF_RE.source, 'g'))) {
    const r = parseElxxRef(m[1], m[2], m[3], m[4])
    if (!r) continue
    if (m.index! > last) parts.push(text.slice(last, m.index))
    parts.push(<button key={m.index} className="inline-ref" onClick={() => onRef(r.book, r.chapter, r.verse)}>{m[0]}</button>)
    last = m.index! + m[0].length
  }
  const rest = text.slice(last)
  const bsb = rest.split(/((?:See\s+)?[1-3]?\s*[A-Z][a-z]+(?:\s+[A-Za-z]+)?\s+\d+:\d+)/)
  bsb.forEach((s, i) => {
    const r = i % 2 ? parseBsbRef(s) : null
    parts.push(r ? <button key={`b${i}`} className="inline-ref" onClick={() => onRef(r.book, r.chapter, r.verse)}>{s}</button> : s)
  })
  return <>{parts}</>
}

// ── Passage ───────────────────────────────────────────────

function passageLabel(p: PassageRef): string {
  if (!p.verseStart) return `${p.book} ${p.chapter}`
  const end = p.verseEnd && p.verseEnd < 999 ? `–${p.verseEnd}` : ''
  return `${p.book} ${p.chapter}:${p.verseStart}${end}`
}

function adjacentChapter(p: PassageRef, delta: number): { book: string; chapter: number } | null {
  if (p.kind === 'apocrypha' || p.kind === 'early') {
    const total = (p.kind === 'early' ? EARLY_TEXT_MAP : APOCRYPHA_BOOK_MAP)[p.book]?.chapters ?? 1
    const next = p.chapter + delta
    const min = p.kind === 'early' ? 0 : 1  // early chapter 0 = preface
    return next < min || next > total ? null : { book: p.book, chapter: next }
  }
  const idx = BOOKS.findIndex(b => b.name === p.book)
  const total = BOOK_MAP[p.book]?.chapters ?? 1
  if (delta > 0 && p.chapter >= total) return BOOKS[idx + 1] ? { book: BOOKS[idx + 1].name, chapter: 1 } : null
  if (delta < 0 && p.chapter <= 1) return BOOKS[idx - 1] ? { book: BOOKS[idx - 1].name, chapter: BOOKS[idx - 1].chapters } : null
  return { book: p.book, chapter: p.chapter + delta }
}

function rangeNotice(book: string, translation: string): string | null {
  const t = BOOK_MAP[book]?.testament
  if (t === 'OT' && GREEK_TRANSLATIONS.has(translation)) return `${translation} is a Greek New Testament only translation.`
  if (t === 'NT' && OT_TRANSLATIONS.has(translation)) return `${translation} is an Old Testament only translation.`
  return null
}

interface PassageProps extends ReaderCallbacks {
  passage: PassageRef
  translation: string
  compareTrans: string | null
  activeVerse: SelectedVerse
  wordHighlight?: WordHighlight | null
  bookmarkedKeys: Set<string>
  userVersion: number
  onSetupEsv: () => void
  onPreview: (t: PreviewTarget) => void
  onStrongs: (s: string) => void
  onUserChange: () => void
  showChapterNav: boolean
}

function PassageSection(props: PassageProps) {
  const { passage, translation, compareTrans, activeVerse } = props
  const [redLetter] = usePref('red_letter_on')
  const [focusMode] = usePref('focus_mode')
  const [readingMode] = usePref('reading_mode')
  const [otCaps] = usePref('ot_quote_caps')
  const [bsbFolded] = usePref('bsb_folded')
  const [dssAll] = usePref('dss_all_readings')
  const kind = passage.kind
  const isPreface = passage.bookOnly || (kind === 'early' && passage.chapter === 0)
  const effTrans = kind ? 'KJV' : translation
  const data: ChapterData = useChapter(passage.book, isPreface ? 0 : passage.chapter, effTrans, kind, otCaps, props.userVersion)
  const compareMap = useCompareText(passage.book, isPreface ? 0 : passage.chapter, kind ? null : compareTrans)
  const [menu, setMenu] = useState<{ verse: number; rect: DOMRect } | null>(null)
  const [copyAt, setCopyAt] = useState<{ verse: number; rect: DOMRect } | null>(null)
  const [note, setNote] = useState<NoteTarget | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)
  useOutsideClick(menuRef, !!menu, () => setMenu(null))
  useOutsideClick(noteRef, !!note, () => setNote(null))

  useEffect(() => {
    if (!isPreface && !passage.verseStart) recordHistory(userDb, passage.book, passage.chapter)
  }, [passage.book, passage.chapter, isPreface, passage.verseStart])

  const shown = passage.verseStart
    ? data.verses.filter(v => v.verse >= passage.verseStart! && v.verse <= (passage.verseEnd ?? passage.verseStart!))
    : data.verses
  const isSel = (v: number) => activeVerse.book === passage.book && activeVerse.chapter === passage.chapter && activeVerse.verse === v

  const onSelect = useCallback((v: number) => props.onVerseClick(passage.book, passage.chapter, v), [props.onVerseClick, passage.book, passage.chapter])
  const onContextMenu = useCallback((verse: number, rect: DOMRect) => setMenu({ verse, rect }), [])
  const onNote = useCallback((n: NoteTarget) => setNote(n), [])
  const onEarlyFootnote = useCallback((marker: number, rect: DOMRect) => {
    const txt = data.earlyFootnotes.get(marker)
    if (txt) setNote({ marker: `[${marker}]`, content: txt, rect })
  }, [data.earlyFootnotes])
  const onCrossRef = useCallback((r: { ref_book: string; ref_chapter: number; ref_verse: number }) =>
    props.onPreview({ book: r.ref_book, chapter: r.ref_chapter, verse: r.ref_verse }), [props.onPreview])
  const onInlineRef = useCallback((b: string, c: number, v: number) => props.onPreview({ book: b, chapter: c, verse: v }), [props.onPreview])
  const onBookmarkToggle = useCallback(async (v: number) => {
    const key = `${passage.book}|${passage.chapter}|${v}`
    if (props.bookmarkedKeys.has(key)) await removeBookmark(userDb, passage.book, passage.chapter, v)
    else await addBookmark(userDb, passage.book, passage.chapter, v)
    props.onBookmarksChanged()
  }, [passage.book, passage.chapter, props.bookmarkedKeys, props.onBookmarksChanged])

  async function pickColor(v: number, color: string | null) {
    if (color) await setHighlight(userDb, passage.book, passage.chapter, v, color)
    else await removeHighlight(userDb, passage.book, passage.chapter, v)
    setMenu(null)
    props.onUserChange()
  }

  const prev = props.showChapterNav ? adjacentChapter(passage, -1) : null
  const next = props.showChapterNav ? adjacentChapter(passage, 1) : null
  const notice = kind ? null : rangeNotice(passage.book, translation)

  return (
    <div className="passage-section">
      <div className="passage-section-header">
        <span>{passage.bookOnly ? passage.book : kind === 'early' && passage.chapter === 0 ? `${passage.book} — Introduction` : passageLabel(passage)}</span>
        {kind && <span className="passage-badge">{kind === 'early' ? 'Early Text' : 'Apocrypha'}</span>}
      </div>

      {isPreface ? (
        <PrefaceView book={passage.book} kind={kind === 'early' ? 'early' : undefined} onNavigate={props.onNavigate} />
      ) : (
        <>
          {data.psalmHeading && <div className="psalm-heading">{data.psalmHeading}</div>}
          {notice && <div className="panel-empty">{notice}</div>}
          {data.loading && <div className="panel-loading">Loading…</div>}
          {!data.loading && data.esvError && (
            <div className="esv-notice">
              {data.esvError.needsKey ? (
                <>
                  <div className="esv-notice-title">The ESV needs a free key from Crossway</div>
                  <p className="esv-notice-body">The ESV is copyrighted, so it is read through Crossway's own service rather than bundled with the app. Setting it up takes about a minute and costs nothing.</p>
                  <button className="esv-notice-btn" onClick={props.onSetupEsv}>Set up the ESV</button>
                </>
              ) : (
                <>
                  <div className="esv-notice-title">{data.esvError.message}</div>
                  <button className="esv-notice-btn" onClick={props.onSetupEsv}>ESV settings</button>
                </>
              )}
            </div>
          )}
          {!data.loading && !data.esvError && !notice && shown.length === 0 && <div className="panel-empty">No verses found.</div>}

          {readingMode && !compareTrans ? <ProseChapter verses={shown} /> : shown.map(v => (
            <VerseRow
              key={v.verse}
              book={passage.book} chapter={passage.chapter} verse={v.verse} text={v.text}
              translation={effTrans} kind={kind}
              selected={isSel(v.verse)}
              hlColor={data.highlights.get(v.verse)}
              bookmarked={props.bookmarkedKeys.has(`${passage.book}|${passage.chapter}|${v.verse}`)}
              hasNote={data.noteVerses.has(v.verse)}
              compareText={compareTrans && !kind ? compareMap.get(v.verse) ?? '' : undefined}
              compareTrans={compareTrans}
              footnotes={data.footnotes.get(v.verse)}
              bsbFootnotes={data.bsbFootnotes.get(v.verse)}
              elxxNotes={data.elxxNotes.get(v.verse)}
              otSpans={data.otSpans.get(v.verse)}
              crossRefs={data.crossRefs.get(v.verse)}
              redLetter={redLetter} focusMode={focusMode} bsbFolded={bsbFolded} dssAllReadings={dssAll}
              wordHighlight={isSel(v.verse) ? props.wordHighlight : null}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onWordClick={props.onWordClick}
              onStrongs={props.onStrongs}
              onNote={onNote}
              onEarlyFootnote={onEarlyFootnote}
              onCrossRef={onCrossRef}
              onInlineRef={onInlineRef}
              onBookmarkToggle={onBookmarkToggle}
            />
          ))}

          {kind === 'early' && <EarlyRefs refs={data.earlyRefs} onPress={(b, c, v) => props.onPreview({ book: b, chapter: c, verse: v })} />}
          {shown.length > 0 && (translation === 'ESV' || compareTrans === 'ESV') && !kind && <div className="esv-copyright">{ESV_COPYRIGHT}</div>}
        </>
      )}

      {(prev || next) && (
        <div className="chapter-nav">
          <button className="btn" disabled={!prev} onClick={() => prev && props.onNavigate(prev.book, prev.chapter, 1)}>
            ‹ {prev ? (prev.chapter === 0 ? 'Introduction' : `${abbrevBook(prev.book)} ${prev.chapter}`) : ''}
          </button>
          <button className="btn" disabled={!next} onClick={() => next && props.onNavigate(next.book, next.chapter, 1)}>
            {next ? `${abbrevBook(next.book)} ${next.chapter}` : ''} ›
          </button>
        </div>
      )}

      {menu && (
        <div ref={menuRef} className="verse-context-menu" style={{ position: 'fixed', top: Math.min(menu.rect.bottom + 4, window.innerHeight - 230), left: Math.min(menu.rect.left + 40, window.innerWidth - 200) }}>
          <div className="verse-context-title">{abbrevBook(passage.book)} {passage.chapter}:{menu.verse}</div>
          <button className="verse-context-item" onClick={() => { setCopyAt(menu); setMenu(null) }}>Copy / share range…</button>
          <button className="verse-context-item" onClick={() => { props.onAddNote(passage.book, passage.chapter, menu.verse); setMenu(null) }}>Add note…</button>
          <button className="verse-context-item" onClick={() => { onBookmarkToggle(menu.verse); setMenu(null) }}>
            {props.bookmarkedKeys.has(`${passage.book}|${passage.chapter}|${menu.verse}`) ? 'Remove bookmark' : 'Bookmark'}
          </button>
          {!kind && <button className="verse-context-item" onClick={() => { props.onViewParallels(passage.book, passage.chapter, menu.verse); setMenu(null) }}>Open parallels</button>}
          <div className="verse-context-hl-row">
            {HIGHLIGHT_COLORS.map(c => {
              const active = data.highlights.get(menu.verse) === c.key
              return <button key={c.key} className={`hl-swatch${active ? ' hl-swatch--active' : ''}`} style={{ background: c.swatch }} title={c.key}
                onClick={() => pickColor(menu.verse, active ? null : c.key)} />
            })}
            {data.highlights.has(menu.verse) && <button className="hl-swatch-clear" title="Remove highlight" onClick={() => pickColor(menu.verse, null)}>✕</button>}
          </div>
        </div>
      )}
      {copyAt && (
        <CopyRangePopover book={passage.book} chapter={passage.chapter} allVerses={data.verses} translation={effTrans}
          initialVerse={copyAt.verse} anchorRect={copyAt.rect} onClose={() => setCopyAt(null)} />
      )}
      {note && (
        <div ref={noteRef} className="fn-popup" style={{ top: Math.min(note.rect.bottom + 6, window.innerHeight - 160), left: Math.min(note.rect.left, window.innerWidth - 340) }}>
          <span className="fn-popup-marker">{note.marker}</span>{' '}
          {note.refs ? <NoteText text={note.content} onRef={(b, c, v) => { setNote(null); props.onPreview({ book: b, chapter: c, verse: v }) }} /> : note.content}
        </div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────

interface Props extends ReaderCallbacks {
  passages: PassageRef[]
  activeVerse: SelectedVerse
  wordHighlight?: WordHighlight | null
  bookmarkedKeys: Set<string>
  userVersion: number
  onUserChange: () => void
}

const FONT_MIN = 12, FONT_MAX = 30, FONT_DEFAULT = 17

export function BiblePanel(props: Props) {
  const [translation, setTranslation] = usePref('last_used_translation')
  const [parallelOn, setParallelOn] = usePref('parallel_on')
  const [compareTrans, setCompareTrans] = usePref('parallel_translation')
  const [splitOn, setSplitOn] = usePref('split_on')
  const [splitPassage, setSplitPassage] = usePref('split_passage')
  const [splitTrans, setSplitTrans] = usePref('split_translation')
  const [redLetter, setRedLetter] = usePref('red_letter_on')
  const [readingMode, setReadingMode] = usePref('reading_mode')
  const [fontSize, setFontSize] = usePref('font_size')
  const [esvOpen, setEsvOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [strongs, setStrongs] = useState<string | null>(null)
  const [splitInput, setSplitInput] = useState(splitPassage)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Android: split view replaces the parallel column while it is open
  const compare = parallelOn && !splitOn && compareTrans !== translation ? compareTrans : null
  const splitPassages = useMemo(() => parsePassage(splitPassage), [splitPassage])
  const outsideCanon = props.passages.length > 0 && props.passages.every(p => p.kind)

  // Ctrl+wheel / Ctrl+= / Ctrl+- resize verse text (desktop stand-in for pinch-zoom)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setFontSize(Math.max(FONT_MIN, Math.min(FONT_MAX, fontSize + (e.deltaY < 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [fontSize, setFontSize])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setFontSize(Math.min(FONT_MAX, fontSize + 1)) }
      if (e.key === '-') { e.preventDefault(); setFontSize(Math.max(FONT_MIN, fontSize - 1)) }
      if (e.key === '0') { e.preventDefault(); setFontSize(FONT_DEFAULT) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fontSize, setFontSize])

  const common = {
    activeVerse: props.activeVerse, wordHighlight: props.wordHighlight, bookmarkedKeys: props.bookmarkedKeys,
    userVersion: props.userVersion, onUserChange: props.onUserChange,
    onVerseClick: props.onVerseClick, onNavigate: props.onNavigate, onAddNote: props.onAddNote,
    onWordClick: props.onWordClick, onViewParallels: props.onViewParallels, onStrongsView: props.onStrongsView,
    onBookmarksChanged: props.onBookmarksChanged, onSetupEsv: () => setEsvOpen(true), onPreview: setPreview, onStrongs: setStrongs,
  }

  return (
    <div className="panel bible-panel">
      <div className="panel-header">
        <div className="trans-bar">
          {outsideCanon ? <span className="passage-badge">Apocrypha / Early Texts</span> : (
            <>
              <TranslationPicker value={translation} onChange={t => setTranslation(t)} onSetupEsv={() => setEsvOpen(true)} />
              <button className={`parallel-btn${parallelOn ? ' parallel-btn--on' : ''}`} onClick={() => setParallelOn(!parallelOn)} title="Parallel translation column">∥</button>
              {parallelOn && !splitOn && <TranslationPicker value={compareTrans} onChange={t => setCompareTrans(t)} exclude={translation} allowEsv={false} />}
            </>
          )}
          <button className={`parallel-btn${splitOn ? ' parallel-btn--on' : ''}`} onClick={() => setSplitOn(!splitOn)} title="Split view — read a second passage side by side">⧉</button>
          {translation === 'DSS' && !outsideCanon && <KeyPopover kind="DSS" />}
          {(translation === 'BSB' || compare === 'BSB') && !outsideCanon && <KeyPopover kind="BSB" />}
        </div>
        <div className="font-size-controls">
          <button className="font-size-btn" onClick={() => setFontSize(Math.max(FONT_MIN, fontSize - 1))} title="Smaller text (Ctrl −)">A−</button>
          <button className="font-size-btn font-size-btn--reset" onClick={() => setFontSize(FONT_DEFAULT)} title="Reset (Ctrl 0)">A</button>
          <button className="font-size-btn" onClick={() => setFontSize(Math.min(FONT_MAX, fontSize + 1))} title="Larger text (Ctrl +)">A+</button>
        </div>
        <button className={`rl-toggle-btn${readingMode ? ' rl-toggle-btn--on' : ''}`} onClick={() => setReadingMode(!readingMode)} title="Reading mode (prose paragraphs)">¶</button>
        <button className={`rl-toggle-btn${redLetter ? ' rl-toggle-btn--on' : ''}`} onClick={() => setRedLetter(!redLetter)} title={redLetter ? 'Red letter on' : 'Red letter off'}>RL</button>
      </div>
      <div className={`reader-panes${splitOn ? ' reader-panes--split' : ''}`} ref={bodyRef}>
        <div className="panel-body reader-pane">
          {props.passages.length === 0 && <div className="panel-empty">Enter a passage above, e.g. John 3:16</div>}
          {props.passages.map((p, i) => (
            <PassageSection key={`${p.book}-${p.chapter}-${p.verseStart ?? 0}-${i}`} passage={p} translation={translation} compareTrans={compare}
              showChapterNav={props.passages.length === 1 && !p.verseStart} {...common} />
          ))}
        </div>
        {splitOn && (
          <div className="panel-body reader-pane reader-pane--split">
            <div className="split-bar">
              <input className="nav-passage-field" value={splitInput} onChange={e => setSplitInput(e.target.value)} spellCheck={false}
                onKeyDown={e => { if (e.key === 'Enter' && parsePassage(splitInput).length) setSplitPassage(splitInput) }} placeholder="Second passage…" />
              <TranslationPicker value={splitTrans} onChange={t => setSplitTrans(t)} allowEsv={false} />
            </div>
            {splitPassages.map((p, i) => (
              <PassageSection key={`s-${p.book}-${p.chapter}-${i}`} passage={p} translation={splitTrans} compareTrans={null}
                showChapterNav={splitPassages.length === 1 && !p.verseStart} {...common}
                onNavigate={(b, c) => { const s = `${b} ${c}`; setSplitInput(s); setSplitPassage(s) }} />
            ))}
          </div>
        )}
      </div>
      <EsvSetupModal open={esvOpen} onClose={() => setEsvOpen(false)} />
      <ScripturePreviewModal target={preview} onClose={() => setPreview(null)} onNavigate={props.onNavigate} />
      <StrongsDialog strongs={strongs} onClose={() => setStrongs(null)} onNavigate={props.onNavigate} onOpenWordStudy={props.onStrongsView} />
    </div>
  )
}
