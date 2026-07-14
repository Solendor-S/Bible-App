import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { BibleVerse, GreekWord, HebrewWord, Language, LexiconEntry, StrongsEntry, SelectedVerse } from '../types'
import { decodeMorphology, TAG_DEFINITIONS, GREEK_TAG_EXAMPLES, HEBREW_TAG_EXAMPLES } from '../utils/morphology'
import { escapeRegex } from '../utils/regex'

const NT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
])

export interface WordHighlight {
  gloss: string | null
  glossTerms: string[]
  positionRatio: number
}

interface Props {
  selected: SelectedVerse
  onWordSelect?: (info: WordHighlight | null) => void
  onNavigate?: (book: string, chapter: number, verse: number) => void
  jumpToStrongs?: string | null
  onJumpHandled?: () => void
}

interface WordDef {
  strongs: string
  entry: StrongsEntry | null
  lexicon: LexiconEntry | null
}

interface ScriptureRef {
  book: string
  refs: Array<{ chapter: number; verse: number | null; raw: string }>
}

interface ClickedVerse {
  book: string
  chapter: number
  verse: number
}

function normalizeStrongs(s: string): string {
  const m = s.match(/^([GH])0*(\d+)/)
  return m ? `${m[1]}${m[2]}` : s
}

const GLOSS_STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'at',
  'it', 'he', 'she', 'they', 'we', 'ye',
  'as', 'so', 'no', 'on', 'not',
])

function extractGlossTerms(entry: StrongsEntry | null): string[] {
  if (!entry?.kjv_usage) return []
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of entry.kjv_usage.split(',')) {
    let t = raw.trim()
    if (/^[X+]\s/i.test(t)) continue
    const parenMatch = t.match(/^(\w[\w\s]*)\((-\w+)\)/)
    if (parenMatch) {
      const base = parenMatch[1].trim().toLowerCase()
      const variant = (parenMatch[1].trim() + parenMatch[2].slice(1)).toLowerCase()
      if (!GLOSS_STOPWORDS.has(base) && base.length >= 2 && !seen.has(base)) { seen.add(base); terms.push(base) }
      if (!GLOSS_STOPWORDS.has(variant) && variant.length >= 2 && !seen.has(variant)) { seen.add(variant); terms.push(variant) }
      continue
    }
    t = t.replace(/\s*\(.*?\)/g, '').trim().toLowerCase()
    if (!t || t === 'etc' || t.length < 2 || /^\d+$/.test(t)) continue
    if (GLOSS_STOPWORDS.has(t) || seen.has(t)) continue
    seen.add(t); terms.push(t)
    if (terms.length >= 10) break
  }
  return terms
}

function highlightVerseRefs(text: string, book: string, chapter: number, verse: number): React.ReactNode[] {
  // Match "Book chapter:verse" — Thayer's uses full book names
  const pattern = new RegExp(escapeRegex(`${book} ${chapter}:${verse}`) + '(?!\\d)', 'g')
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<mark key={m.index} className="lexicon-verse-highlight">{m[0]}</mark>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 1 ? parts : [text]
}

function processThayersText(raw: string): { mainText: string; indexRaw: string } {
  const marker = 'BLB Scripture Index'
  const idx = raw.indexOf(marker)
  let mainText = idx >= 0 ? raw.slice(0, idx) : raw
  const indexRaw = idx >= 0 ? raw.slice(idx) : ''
  // Strip "STRONGS G####:\n \n \n..." header
  mainText = mainText.replace(/^STRONGS\s+[GH]\d+:\s*[\n\r](\s*[\n\r])+/, '')
  // Collapse multiple blank lines (possibly with spaces) into a single newline
  mainText = mainText.replace(/(\n[ \t]*){2,}/g, '\n').trim()
  return { mainText, indexRaw }
}

function parseScriptureIndex(raw: string): ScriptureRef[] {
  const body = raw.replace(/^[^\n]*\n/, '')
  const lines = body
    .replace(/(\n[ \t]*){2,}/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const map = new Map<string, ScriptureRef>()
  const order: string[] = []
  let currentBook = ''

  for (const line of lines) {
    if ((/^[A-Za-z]/.test(line) || /^\d\s+[A-Za-z]/.test(line)) && !line.includes(':') && !line.includes(';')) {
      currentBook = line
    } else if (currentBook) {
      const parsed = line.split(/[;,]/).map(r => r.trim()).filter(Boolean).flatMap(r => {
        const m = r.match(/^(\d+):(\d+)/)
        if (m) return [{ chapter: parseInt(m[1]), verse: parseInt(m[2]), raw: r }]
        const c = r.match(/^(\d+)$/)
        if (c) return [{ chapter: parseInt(c[1]), verse: null, raw: r }]
        return []
      })
      if (parsed.length > 0) {
        if (!map.has(currentBook)) { map.set(currentBook, { book: currentBook, refs: [] }); order.push(currentBook) }
        map.get(currentBook)!.refs.push(...parsed)
      }
    }
  }
  return order.map(b => map.get(b)!)
}

export function WordStudyPanel({ selected, onWordSelect, onNavigate, jumpToStrongs, onJumpHandled }: Props) {
  const isNT = NT_BOOKS.has(selected?.book)
  const [words, setWords] = useState<(GreekWord | HebrewWord)[]>([])
  const [loading, setLoading] = useState(false)
  const [activeKey, setActiveKey] = useState<{ strongs: string; position: number } | null>(null)
  const [def, setDef] = useState<WordDef | null>(null)
  const [defLoading, setDefLoading] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [clickedVerse, setClickedVerse] = useState<ClickedVerse | null>(null)
  const [versePreview, setVersePreview] = useState<{ text: string; loading: boolean } | null>(null)
  const verseCache = useRef<Map<string, string>>(new Map())
  const prevJumpRef = useRef<string | null>(null)
  const lexiconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setWords([])
    setActiveKey(null)
    setDef(null)
    onWordSelect?.(null)
    if (!selected?.book || !selected?.verse) return
    setLoading(true)
    const fetch = isNT
      ? window.bibleApi.getGreekWords(selected.book, selected.chapter, selected.verse)
      : window.bibleApi.getHebrewWords(selected.book, selected.chapter, selected.verse)
    fetch.then(w => { setWords(w); setLoading(false) }).catch(() => setLoading(false))
  }, [selected?.book, selected?.chapter, selected?.verse])

  useEffect(() => {
    if (!activeKey || !words.length) return
    const word = words.find(w => w.strongs === activeKey.strongs && w.position === activeKey.position)
    if (!word) return
    const positionRatio = words.length > 1 ? (word.position - 1) / (words.length - 1) : 0
    const glossTerms = def?.strongs === activeKey.strongs ? extractGlossTerms(def.entry) : []
    onWordSelect?.({ gloss: word.gloss ?? null, glossTerms, positionRatio })
  }, [activeKey, def, words, onWordSelect])

  useEffect(() => {
    if (!clickedVerse) { setVersePreview(null); return }
    const key = `${clickedVerse.book}:${clickedVerse.chapter}:${clickedVerse.verse}`
    if (verseCache.current.has(key)) {
      setVersePreview({ text: verseCache.current.get(key)!, loading: false })
      return
    }
    setVersePreview({ text: '', loading: true })
    window.bibleApi.getVerses(clickedVerse.book, clickedVerse.chapter)
      .then((verses: BibleVerse[]) => {
        const v = verses.find(v => v.verse === clickedVerse.verse)
        const text = v?.text ?? 'Verse not found'
        verseCache.current.set(key, text)
        setVersePreview({ text, loading: false })
      })
      .catch(() => setVersePreview({ text: 'Error loading verse', loading: false }))
  }, [clickedVerse])

  // Reset jump tracking when verse changes
  useEffect(() => { prevJumpRef.current = null }, [selected?.book, selected?.chapter, selected?.verse])

  // Auto-select word when jumpToStrongs changes
  useEffect(() => {
    if (!jumpToStrongs || loading || !words.length) return
    if (jumpToStrongs === prevJumpRef.current) return
    prevJumpRef.current = jumpToStrongs
    const normTarget = normalizeStrongs(jumpToStrongs)
    const word = words.find(w => normalizeStrongs(w.strongs) === normTarget)
    if (!word) { onJumpHandled?.(); return }
    setActiveKey({ strongs: word.strongs, position: word.position })
    setActiveTag(null)
    setDefLoading(true)
    const lang: Language = isNT ? 'greek' : 'hebrew'
    Promise.all([
      window.bibleApi.getStrongsEntry(lang, word.strongs).catch(() => null),
      window.bibleApi.getLexiconEntry(lang, word.strongs).catch(() => null),
    ])
      .then(([entry, lexicon]) => { setDef({ strongs: word.strongs, entry, lexicon }); setDefLoading(false) })
      .catch(() => { setDef({ strongs: word.strongs, entry: null, lexicon: null }); setDefLoading(false) })
    onJumpHandled?.()
  }, [jumpToStrongs, words, loading])

  function handleWordClick(strongs: string, position: number) {
    if (activeKey?.strongs === strongs && activeKey?.position === position) {
      setActiveKey(null); setDef(null); setActiveTag(null); onWordSelect?.(null); return
    }
    setActiveKey({ strongs, position })
    setActiveTag(null)
    setDefLoading(true)
    const lang: Language = isNT ? 'greek' : 'hebrew'
    Promise.all([
      window.bibleApi.getStrongsEntry(lang, strongs).catch(() => null),
      window.bibleApi.getLexiconEntry(lang, strongs).catch(() => null),
    ])
      .then(([entry, lexicon]) => { setDef({ strongs, entry, lexicon }); setDefLoading(false) })
      .catch(() => { setDef({ strongs, entry: null, lexicon: null }); setDefLoading(false) })
  }

  const { mainText, indexRaw } = useMemo(() =>
    def?.lexicon?.thayers_text
      ? processThayersText(def.lexicon.thayers_text)
      : { mainText: '', indexRaw: '' },
    [def?.lexicon?.thayers_text]
  )
  const scriptureIndex = useMemo(() => indexRaw ? parseScriptureIndex(indexRaw) : [], [indexRaw])
  const highlightedText = useMemo(() =>
    mainText ? highlightVerseRefs(mainText, selected.book, selected.chapter, selected.verse) : [],
    [mainText, selected.book, selected.chapter, selected.verse]
  )
  const hasVerseInLexicon = useMemo(() =>
    highlightedText.some(p => React.isValidElement(p) && (p as React.ReactElement).type === 'mark'),
    [highlightedText]
  )

  function scrollToVerseInLexicon() {
    lexiconRef.current?.querySelector('.lexicon-verse-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!selected?.verse) return <div className="panel-empty">Select a verse to see word study.</div>
  if (loading) return <div className="panel-loading">Loading...</div>
  if (!words.length) return <div className="panel-empty">No {isNT ? 'Greek' : 'Hebrew'} words found for this verse.</div>

  return (
    <div className="wordstudy-panel">
      <div className="wordstudy-lang-label">{isNT ? 'Greek New Testament' : 'Hebrew Old Testament'}</div>
      <div className="wordstudy-words">
        {words.map((w, i) => {
          const text = isNT ? (w as GreekWord).greek : (w as HebrewWord).hebrew
          const active = activeKey?.strongs === w.strongs && activeKey?.position === w.position
          return (
            <button
              key={i}
              className={`word-pill${active ? ' word-pill--active' : ''}`}
              onClick={() => handleWordClick(w.strongs, w.position)}
              title={w.strongs}
            >
              <span className="word-pill-text">{text}</span>
              <span className="word-pill-translit">{w.translit}</span>
              {w.gloss && <span className="word-pill-gloss">{w.gloss}</span>}
            </button>
          )
        })}
      </div>

      {activeKey && (
        <div className="wordstudy-def">
          {defLoading && <div className="panel-loading">Loading definition...</div>}
          {!defLoading && def && (
            def.entry ? (
              <>
                <div className="strongs-header">
                  <span className="strongs-num">{def.entry.number}</span>
                  <span className="strongs-lemma">{def.entry.lemma}</span>
                  <span className="strongs-translit">({def.entry.translit}{def.entry.pronunciation ? ` · ${def.entry.pronunciation}` : ''})</span>
                </div>
                {(() => {
                  const activeWord = words.find(w => w.strongs === activeKey!.strongs && w.position === activeKey!.position)
                  const morph = activeWord ? decodeMorphology((activeWord as any).morph ?? '', isNT ? 'greek' : 'hebrew') : null
                  const gloss = activeWord?.gloss
                  const tagExamples = isNT ? GREEK_TAG_EXAMPLES : HEBREW_TAG_EXAMPLES
                  return (
                    <div className="strongs-morph">
                      {gloss && (
                        <div className="strongs-morph-gloss">
                          <span className="strongs-morph-gloss-label">Use in this verse</span>
                          <span className="strongs-morph-gloss-value">{gloss}</span>
                        </div>
                      )}
                      {morph && (
                        <>
                          <span className="strongs-morph-pos">{morph.partOfSpeech}</span>
                          {morph.tags.length > 0 && (
                            <div className="strongs-morph-chips">
                              {morph.tags.map(tag => (
                                <button
                                  key={tag}
                                  className={`morph-chip${activeTag === tag ? ' morph-chip--active' : ''}`}
                                  onClick={() => setActiveTag(prev => prev === tag ? null : tag)}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          )}
                          {activeTag && TAG_DEFINITIONS[activeTag] && (
                            <div className="morph-chip-def">
                              <span className="morph-chip-def-tag">{activeTag}</span>
                              <span className="morph-chip-def-text">{TAG_DEFINITIONS[activeTag]}</span>
                              {tagExamples[activeTag] && (
                                <div className="morph-chip-def-example">
                                  <span className="morph-chip-def-example-label">Example  </span>
                                  <span className="morph-chip-def-example-text">{tagExamples[activeTag]}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
                {def.entry.definition && <p className="strongs-def">{def.entry.definition.trim()}</p>}
                {def.entry.kjv_usage && (
                  <p className="strongs-kjv"><span className="strongs-kjv-label">KJV uses:</span> {def.entry.kjv_usage}</p>
                )}

                {mainText && (
                  <div className="lexicon-thayers" ref={lexiconRef}>
                    <div className="lexicon-thayers-label">
                      {isNT ? "Thayer's Greek Lexicon" : 'Brown-Driver-Briggs'}
                    </div>

                    {def.lexicon?.outline && (
                      <div className="lexicon-outline">
                        {def.lexicon.outline.split('•').filter(s => s.trim()).map((item, i) => (
                          <div key={i} className="lexicon-outline-item">• {item.trim()}</div>
                        ))}
                      </div>
                    )}

                    <button
                      className={`lexicon-goto-verse-btn${!hasVerseInLexicon ? ' lexicon-goto-verse-btn--absent' : ''}`}
                      onClick={hasVerseInLexicon ? scrollToVerseInLexicon : undefined}
                      disabled={!hasVerseInLexicon}
                    >
                      {hasVerseInLexicon ? 'Go to verse ↓' : 'Verse not found'}
                    </button>

                    <p className="lexicon-thayers-text">{highlightedText}</p>

                    {scriptureIndex.length > 0 && (
                      <div className="lexicon-scripture-index">
                        <div className="lexicon-scripture-index-label">Scripture Index</div>
                        {scriptureIndex.map(({ book, refs }) => (
                          <div key={book} className="lexicon-si-book">
                            <span className="lexicon-si-bookname">{book}</span>
                            <span className="lexicon-si-refs">
                              {refs.map((ref, i) => {
                                if (ref.verse === null) return (
                                  <span key={i} className="lexicon-si-ref lexicon-si-ref--chapter">{ref.raw}</span>
                                )
                                const isCurrentVerse =
                                  book === selected.book &&
                                  ref.chapter === selected.chapter &&
                                  ref.verse === selected.verse
                                const isClicked =
                                  clickedVerse?.book === book &&
                                  clickedVerse?.chapter === ref.chapter &&
                                  clickedVerse?.verse === ref.verse
                                return (
                                  <button
                                    key={i}
                                    className={`lexicon-si-ref${isCurrentVerse ? ' lexicon-si-ref--current' : ''}${isClicked ? ' lexicon-si-ref--hovered' : ''}`}
                                    onClick={() => setClickedVerse(isClicked ? null : { book, chapter: ref.chapter, verse: ref.verse! })}
                                  >
                                    {ref.raw}
                                  </button>
                                )
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {clickedVerse && versePreview && (
                  <div className="lexicon-verse-preview">
                    <div className="lexicon-verse-preview-ref">
                      {clickedVerse.book} {clickedVerse.chapter}:{clickedVerse.verse}
                    </div>
                    <div className="lexicon-verse-preview-text">
                      {versePreview.loading ? 'Loading…' : versePreview.text}
                    </div>
                    <button
                      className="lexicon-verse-preview-goto"
                      onClick={() => { onNavigate?.(clickedVerse.book, clickedVerse.chapter, clickedVerse.verse); setClickedVerse(null) }}
                    >
                      Go to verse →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="panel-empty">No definition found for {activeKey.strongs}.</div>
            )
          )}
        </div>
      )}
    </div>
  )
}
