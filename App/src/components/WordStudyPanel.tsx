import React, { useEffect, useState } from 'react'
import type { GreekWord, HebrewWord, StrongsEntry, SelectedVerse } from '../types'

const NT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
])

export interface WordHighlight {
  gloss: string | null    // context-specific term from OpenGNT (primary)
  glossTerms: string[]    // kjv_usage candidates (fallback)
  positionRatio: number   // clicked word's position (0–1) within the verse
}

interface Props {
  selected: SelectedVerse
  onWordSelect?: (info: WordHighlight | null) => void
}

interface WordDef {
  strongs: string
  entry: StrongsEntry | null
}

const GLOSS_STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'at',
  'it', 'he', 'she', 'they', 'we', 'ye',
  'as', 'so', 'no', 'on', 'not',
])

// kjv_usage format: "the, this, that, one, he" or "word, saying, thing"
// Some entries have "X word" (grammatical marker – skip), or "word(-ly)" (strip parens)
function extractGlossTerms(entry: StrongsEntry | null): string[] {
  if (!entry?.kjv_usage) return []
  const terms: string[] = []
  for (const raw of entry.kjv_usage.split(',')) {
    let t = raw.trim()
    if (/^[X+]\s/i.test(t)) continue                 // skip "X concerning", "+ reckon" etc.
    // Expand parenthetical suffixes: "strong(-er)" → ["strong", "stronger"]
    const parenMatch = t.match(/^(\w[\w\s]*)\((-\w+)\)/)
    if (parenMatch) {
      const base = parenMatch[1].trim().toLowerCase()
      const variant = (parenMatch[1].trim() + parenMatch[2].slice(1)).toLowerCase()
      if (!GLOSS_STOPWORDS.has(base) && base.length >= 2) {
        if (!terms.includes(base)) terms.push(base)
      }
      if (!GLOSS_STOPWORDS.has(variant) && variant.length >= 2) {
        if (!terms.includes(variant)) terms.push(variant)
      }
      continue
    }
    t = t.replace(/\s*\(.*?\)/g, '').trim()          // strip remaining parens
    t = t.toLowerCase()
    if (!t || t === 'etc' || t.length < 2 || /^\d+$/.test(t)) continue
    if (GLOSS_STOPWORDS.has(t)) continue
    if (!terms.includes(t)) terms.push(t)
    if (terms.length >= 10) break                     // cap at 10 terms
  }
  return terms
}

export function WordStudyPanel({ selected, onWordSelect }: Props) {
  const isNT = NT_BOOKS.has(selected?.book)
  const [words, setWords] = useState<(GreekWord | HebrewWord)[]>([])
  const [loading, setLoading] = useState(false)
  // Use {strongs, position} so duplicate-strongs words are tracked independently
  const [activeKey, setActiveKey] = useState<{ strongs: string; position: number } | null>(null)
  const [def, setDef] = useState<WordDef | null>(null)
  const [defLoading, setDefLoading] = useState(false)

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

  // Emit highlight whenever the active word or its definition changes
  useEffect(() => {
    if (!activeKey || !words.length) return
    const word = words.find(w => w.strongs === activeKey.strongs && w.position === activeKey.position)
    if (!word) return
    const positionRatio = words.length > 1 ? (word.position - 1) / (words.length - 1) : 0
    const glossTerms = def?.strongs === activeKey.strongs ? extractGlossTerms(def.entry) : []
    onWordSelect?.({ gloss: word.gloss ?? null, glossTerms, positionRatio })
  }, [activeKey, def])

  function handleWordClick(strongs: string, position: number) {
    if (activeKey?.strongs === strongs && activeKey?.position === position) {
      setActiveKey(null); setDef(null); onWordSelect?.(null); return
    }
    setActiveKey({ strongs, position })
    setDefLoading(true)
    window.bibleApi.getStrongsEntry(isNT ? 'greek' : 'hebrew', strongs)
      .then(e => { setDef({ strongs, entry: e }); setDefLoading(false) })
      .catch(() => { setDef({ strongs, entry: null }); setDefLoading(false) })
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
                {def.entry.definition && <p className="strongs-def">{def.entry.definition.trim()}</p>}
                {def.entry.kjv_usage && (
                  <p className="strongs-kjv"><span className="strongs-kjv-label">KJV uses:</span> {def.entry.kjv_usage}</p>
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
