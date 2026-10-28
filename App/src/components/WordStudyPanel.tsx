// Words tab — port of the Android WordStudyPanel: interlinear words per source, Strong's +
// Thayer's/BDB, morphology tags, scripture index, concordance. Desktop extra: the selected
// word is highlighted in the reader (onWordSelect).
import { useEffect, useMemo, useRef, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import {
  getBdbEntry, getGreekWords, getHebrewWords, getLxxWords, getStrongsEntry, getThayersEntry, getVerse, normalizeStrongsNumber,
} from '../db/queries'
import type { GreekSource, GreekWord, HebrewSource, HebrewWord, LexiconEntry, LxxSource, StrongsEntry } from '../db/queries'
import { compactMorph, decodeMorphology, GREEK_TAG_EXAMPLES, HEBREW_TAG_EXAMPLES, TAG_DEFINITIONS } from '../utils/morphology'
import { stripUsfm } from '../data/redLetter'
import { BOOKS } from '../data/books'
import { TRANSLATIONS } from '../data/translations'
import { escapeRegex } from '../utils/regex'
import { usePref } from '../context/Prefs'
import { extractGlossTerms } from '../lib/wordHighlight'
import type { WordHighlight } from '../lib/wordHighlight'
import { StrongsConcordanceModal, useStrongsData } from './StrongsModals'
import type { SelectedVerse } from '../types'

const NT_BOOKS = new Set(BOOKS.filter(b => b.testament === 'NT').map(b => b.name))
const GREEK_SOURCES = TRANSLATIONS.filter(t => t.greekOnly && !t.key.endsWith('+'))
  .map(t => ({ key: t.key.toLowerCase() as GreekSource, label: t.label, desc: t.full }))
type OtSource = HebrewSource | LxxSource
const OT_SOURCES: { key: OtSource; label: string; desc: string }[] = [
  { key: 'tahot', label: 'TAHOT', desc: 'Translators Amalgamated Hebrew OT' },
  { key: 'wlc',   label: 'WLC',   desc: 'Westminster Leningrad Codex' },
  { key: 'lxx',   label: 'LXX',   desc: 'Septuagint (Rahlfs/CCAT via STEPBible)' },
  { key: 'lxx_a', label: 'LXX-A', desc: 'Apostolic Bible LXX (Poole)' },
]
// Inflected-form numbers some sources use for a root lemma
const STRONGS_REDIRECTS: Record<string, string> = { G2258: 'G1510', G5607: 'G1510', G5600: 'G1510' }

function processLexiconText(raw: string): { mainText: string; indexRaw: string } {
  const idx = raw.indexOf('BLB Scripture Index')
  let mainText = idx >= 0 ? raw.slice(0, idx) : raw
  mainText = mainText.replace(/^STRONGS\s+[GH]\d+:\s*[\n\r](\s*[\n\r])+/, '').replace(/(\n[ \t]*){2,}/g, '\n').trim()
  return { mainText, indexRaw: idx >= 0 ? raw.slice(idx) : '' }
}

function parseScriptureIndex(raw: string) {
  const lines = raw.replace(/^[^\n]*\n/, '').replace(/(\n[ \t]*){2,}/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)
  const out: { book: string; refs: { chapter: number; verse: number | null; raw: string }[] }[] = []
  let cur: typeof out[number] | null = null
  for (const line of lines) {
    if ((/^[A-Za-z]/.test(line) || /^\d\s+[A-Za-z]/.test(line)) && !line.includes(':') && !line.includes(';')) {
      cur = { book: line, refs: [] }; out.push(cur)
    } else if (cur) {
      for (const r of line.split(/[;,]/).map(s => s.trim()).filter(Boolean)) {
        const m = r.match(/^(\d+):(\d+)/), c = r.match(/^(\d+)$/)
        if (m) cur.refs.push({ chapter: +m[1], verse: +m[2], raw: r })
        else if (c) cur.refs.push({ chapter: +c[1], verse: null, raw: r })
      }
    }
  }
  return out.filter(b => b.refs.length)
}

function highlightVerse(text: string, book: string, chapter: number, verse: number, firstRef: React.RefObject<HTMLElement | null>) {
  const re = new RegExp(escapeRegex(`${book} ${chapter}:${verse}`) + '(?!\\d)', 'g')
  const parts: React.ReactNode[] = []
  let last = 0, first = true
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    parts.push(<mark key={m.index} ref={first ? firstRef as React.RefObject<HTMLElement> : undefined} className="ref-highlight">{m[0]}</mark>)
    first = false
    last = m.index! + m[0].length
  }
  parts.push(text.slice(last))
  return { nodes: parts, found: !first }
}

type Word = (GreekWord | HebrewWord) & { greek?: string; hebrew?: string }

export function WordStudyPanel({ selected, onNavigate, onWordSelect, jumpToStrongs, onJumpHandled }: {
  selected: SelectedVerse
  onNavigate: (book: string, chapter: number, verse: number) => void
  onWordSelect?: (h: WordHighlight | null) => void
  jumpToStrongs?: string | null
  onJumpHandled?: () => void
}) {
  const isNT = NT_BOOKS.has(selected.book)
  const [favGreek, setFavGreek] = usePref('greek_source_fav')
  const [favOt, setFavOt] = usePref('ot_source_fav')
  const [source, setSource] = useState<GreekSource>(favGreek as GreekSource)
  const [otSource, setOtSource] = useState<OtSource>(favOt as OtSource)
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<{ strongs: string; position: number } | null>(null)
  const [def, setDef] = useState<StrongsEntry | null>(null)
  const [lexicon, setLexicon] = useState<LexiconEntry | null>(null)
  const [defLoading, setDefLoading] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [clicked, setClicked] = useState<{ book: string; chapter: number; verse: number; text?: string } | null>(null)
  const [concOpen, setConcOpen] = useState(false)
  const firstMention = useRef<HTMLElement | null>(null)

  const isLxx = !isNT && (otSource === 'lxx' || otSource === 'lxx_a')
  const greekLike = isNT || isLxx
  const concLang = isNT ? 'greek' : isLxx ? (otSource as LxxSource) : 'hebrew'
  const { conc, concLoading } = useStrongsData(concOpen && active ? active.strongs : null, concLang, source)

  useEffect(() => {
    let live = true
    setWords([]); setActive(null); setDef(null); setLexicon(null); setLoading(true); onWordSelect?.(null)
    const { book, chapter, verse } = selected
    const q: Promise<Word[]> = isNT ? getGreekWords(bibleDb, book, chapter, verse, source)
      : isLxx ? getLxxWords(bibleDb, book, chapter, verse, otSource as LxxSource)
      : getHebrewWords(bibleDb, book, chapter, verse, otSource as HebrewSource)
    q.then(w => { if (live) { setWords(w); setLoading(false) } }).catch(() => live && setLoading(false))
    return () => { live = false }
  }, [selected.book, selected.chapter, selected.verse, source, otSource, isNT, isLxx])

  function pick(strongs: string, position: number) {
    if (active?.strongs === strongs && active.position === position) {
      setActive(null); setDef(null); setLexicon(null); setActiveTag(null); setClicked(null); onWordSelect?.(null); return
    }
    setActive({ strongs, position }); setActiveTag(null); setClicked(null); setDefLoading(true)
    Promise.all([
      getStrongsEntry(bibleDb, greekLike ? 'greek' : 'hebrew', strongs),
      greekLike ? getThayersEntry(bibleDb, strongs) : getBdbEntry(bibleDb, strongs),
    ]).then(([e, lex]) => {
      setDef(e); setLexicon(lex); setDefLoading(false)
      const w = words.find(x => x.strongs === strongs && x.position === position)
      const ratio = words.length > 1 && w ? words.indexOf(w) / (words.length - 1) : 0
      onWordSelect?.({ gloss: w?.gloss ?? null, glossTerms: extractGlossTerms(e), positionRatio: ratio })
    }).catch(() => setDefLoading(false))
  }

  // "Open in Word Study" from the reader's Strong's popup
  useEffect(() => {
    if (!jumpToStrongs || loading || !words.length) return
    const want = normalizeStrongsNumber(jumpToStrongs)
    const canonical = STRONGS_REDIRECTS[want] ?? want
    const m = words.find(w => { const n = normalizeStrongsNumber(w.strongs); return n === want || n === canonical })
    if (m && !(active?.strongs === m.strongs && active.position === m.position)) pick(m.strongs, m.position)
    onJumpHandled?.()
  }, [jumpToStrongs, words, loading])

  useEffect(() => {
    if (!clicked || clicked.text !== undefined) return
    getVerse(bibleDb, clicked.book, clicked.chapter, clicked.verse).then(r => setClicked(c => c && { ...c, text: r?.text ?? 'Verse not found' }))
  }, [clicked])

  const lexText = lexicon?.thayers_text ?? lexicon?.bdb_text ?? ''
  const { mainText, indexRaw } = useMemo(() => lexText ? processLexiconText(lexText) : { mainText: '', indexRaw: '' }, [lexText])
  const index = useMemo(() => indexRaw ? parseScriptureIndex(indexRaw) : [], [indexRaw])
  const lexBody = useMemo(() => highlightVerse(mainText, selected.book, selected.chapter, selected.verse, firstMention), [mainText, selected])
  const activeWord = active ? words.find(w => w.strongs === active.strongs && w.position === active.position) : undefined
  const morph = decodeMorphology(activeWord?.morph ?? '', greekLike ? 'greek' : 'hebrew')
  const examples = isNT ? GREEK_TAG_EXAMPLES : HEBREW_TAG_EXAMPLES

  const sources = isNT ? GREEK_SOURCES : OT_SOURCES
  const cur = isNT ? source : otSource
  const fav = isNT ? favGreek : favOt

  return (
    <div className="panel-body word-study">
      <div className="ws-lang">{isNT ? 'Interlinear · Greek NT' : isLxx ? 'Interlinear · LXX' : 'Interlinear · Hebrew OT'}</div>
      <div className="ws-sources">
        {sources.map(o => (
          <div key={o.key} className={`ws-source${o.key === cur ? ' ws-source--active' : ''}`}>
            <button className="ws-source-main" onClick={() => isNT ? setSource(o.key as GreekSource) : setOtSource(o.key as OtSource)}>
              <span className="ws-source-label">{o.label}</span><span className="ws-source-desc">{o.desc}</span>
            </button>
            <button className="ws-star" title={o.key === fav ? 'Default source' : 'Make default'}
              onClick={() => isNT ? setFavGreek(o.key) : setFavOt(o.key)}>{o.key === fav ? '★' : '☆'}</button>
          </div>
        ))}
      </div>
      {!isNT && !isLxx && selected.book === 'Psalms' && (
        <p className="source-note">Note: Strongs tagging and English glosses for Hebrew Psalms may be approximate due to morphological splitting in the source data.</p>
      )}
      {loading ? <div className="panel-loading">Loading…</div> : !words.length ? (
        <div className="panel-empty">No {isNT ? 'Greek' : isLxx ? 'LXX Greek' : 'Hebrew'} data for this verse</div>
      ) : (
        <>
          {selected.verse === 0 && <div className="section-label">Superscription</div>}
          <div className={`ws-pills${greekLike ? '' : ' ws-pills--rtl'}`}>
            {words.map((w, i) => {
              const raw = (greekLike ? w.greek : w.hebrew) ?? ''
              const text = raw.includes('<') ? raw.replace(/<[^>]*>/g, '').split(/\s+/)[0] : raw
              const on = active?.strongs === w.strongs && active.position === w.position
              return (
                <button key={i} className={`ws-pill${on ? ' ws-pill--active' : ''}`} onClick={() => pick(w.strongs, w.position)}>
                  <span className={`ws-pill-word${greekLike ? '' : ' verse-rtl'}`}>{text}</span>
                  <span className="ws-pill-translit">{w.translit}</span>
                  {w.gloss && <span className="ws-pill-gloss">{w.gloss}</span>}
                  {w.morph && <span className="ws-pill-morph">{compactMorph(w.morph, greekLike ? 'greek' : 'hebrew')}</span>}
                </button>
              )
            })}
          </div>

          {active && (
            <div className="ws-def">
              {defLoading ? <div className="panel-loading">Loading…</div> : !def ? <div className="panel-empty">No definition found for {active.strongs}</div> : (
                <>
                  <div className="ws-def-head">
                    <div>
                      <div className="ws-def-num">{def.number}</div>
                      <div className="ws-def-lemma">{def.lemma}</div>
                      <div className="ws-def-translit">{def.translit}{def.pronunciation ? ` · ${def.pronunciation}` : ''}</div>
                    </div>
                    <button className="btn btn--small" onClick={() => setConcOpen(true)}>See all uses →</button>
                  </div>
                  {activeWord?.gloss && <div className="ws-row"><span className="ws-row-label">Use in this verse</span> {activeWord.gloss}</div>}
                  {morph && (
                    <div className="ws-morph">
                      <div className="ws-morph-pos">{morph.partOfSpeech}</div>
                      <div className="chip-wrap">{morph.tags.map(t => (
                        <button key={t} className={`chip chip--small${activeTag === t ? ' chip--active' : ''}`} onClick={() => setActiveTag(a => a === t ? null : t)}>{t}</button>
                      ))}</div>
                      {activeTag && TAG_DEFINITIONS[activeTag] && (
                        <div className="info-card">
                          <b>{activeTag}</b> — {TAG_DEFINITIONS[activeTag]}
                          {examples[activeTag] && <div className="ws-example"><span className="ws-row-label">Example</span> {examples[activeTag]}</div>}
                        </div>
                      )}
                    </div>
                  )}
                  {def.definition && <p className="ws-body">{def.definition.trim()}</p>}
                  {def.kjv_usage && <div className="ws-row"><span className="ws-row-label">KJV uses</span> {def.kjv_usage}</div>}
                  {mainText && (
                    <div className="ws-lexicon">
                      <div className="ws-lexicon-head">
                        <span className="section-label">{greekLike ? "Thayer's Greek Lexicon" : 'Brown-Driver-Briggs'}</span>
                        {lexBody.found
                          ? <button className="link-btn" onClick={() => firstMention.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>↓ jump to verse</button>
                          : <span className="muted">not mentioned</span>}
                      </div>
                      {lexicon?.outline && lexicon.outline.split('•').filter(s => s.trim()).map((it, i) => <div key={i} className="ws-outline">• {it.trim()}</div>)}
                      <p className="ws-body ws-body--pre">{lexBody.nodes}</p>
                      {index.length > 0 && (
                        <div className="ws-index">
                          <div className="section-label">Scripture Index</div>
                          {index.map(({ book, refs }) => (
                            <div key={book} className="ws-index-row"><b>{book}</b>{' '}
                              {refs.map((r, i) => r.verse === null ? <span key={i} className="muted">{r.raw} </span> : (
                                <button key={i} className={`ws-index-ref${book === selected.book && r.chapter === selected.chapter && r.verse === selected.verse ? ' ws-index-ref--current' : ''}`}
                                  onClick={() => setClicked({ book, chapter: r.chapter, verse: r.verse! })}>{r.raw}</button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {clicked && (
                        <div className="info-card">
                          <b>{clicked.book} {clicked.chapter}:{clicked.verse}</b>
                          <p>{clicked.text === undefined ? 'Loading…' : stripUsfm(clicked.text)}</p>
                          <button className="link-btn" onClick={() => onNavigate(clicked.book, clicked.chapter, clicked.verse)}>Go to verse →</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
      <StrongsConcordanceModal open={concOpen} lemma={def?.lemma ?? active?.strongs ?? ''} translit={def?.translit ?? ''}
        lang={concLang} results={conc} loading={concLoading} onClose={() => setConcOpen(false)} onNavigate={onNavigate} />
    </div>
  )
}
