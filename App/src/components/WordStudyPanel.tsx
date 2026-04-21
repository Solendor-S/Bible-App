import React, { useEffect, useState } from 'react'
import type { GreekWord, HebrewWord, StrongsEntry, SelectedVerse } from '../types'

const NT_BOOKS = new Set([
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
])

interface Props {
  selected: SelectedVerse
  onPositionChange?: (pos: number | null) => void
}

interface WordDef {
  strongs: string
  entry: StrongsEntry | null
}

export function WordStudyPanel({ selected, onPositionChange }: Props) {
  const isNT = NT_BOOKS.has(selected?.book)
  const [words, setWords] = useState<(GreekWord | HebrewWord)[]>([])
  const [loading, setLoading] = useState(false)
  const [activeStrongs, setActiveStrongs] = useState<string | null>(null)
  const [def, setDef] = useState<WordDef | null>(null)
  const [defLoading, setDefLoading] = useState(false)

  useEffect(() => {
    setWords([])
    setActiveStrongs(null)
    setDef(null)
    onPositionChange?.(null)
    if (!selected?.book || !selected?.verse) return
    setLoading(true)
    const fetch = isNT
      ? window.bibleApi.getGreekWords(selected.book, selected.chapter, selected.verse)
      : window.bibleApi.getHebrewWords(selected.book, selected.chapter, selected.verse)
    fetch.then(w => { setWords(w); setLoading(false) }).catch(() => setLoading(false))
  }, [selected?.book, selected?.chapter, selected?.verse])

  function handleWordClick(strongs: string, position: number) {
    if (activeStrongs === strongs) {
      setActiveStrongs(null); setDef(null); onPositionChange?.(null); return
    }
    setActiveStrongs(strongs)
    onPositionChange?.(position)
    setDefLoading(true)
    window.bibleApi.getStrongsEntry(isNT ? 'greek' : 'hebrew', strongs)
      .then(e => { setDef({ strongs, entry: e }); setDefLoading(false) })
      .catch(() => { setDef({ strongs, entry: null }); setDefLoading(false) })
  }

  if (!selected?.verse) {
    return <div className="panel-empty">Select a verse to see word study.</div>
  }
  if (loading) return <div className="panel-loading">Loading...</div>
  if (!words.length) return <div className="panel-empty">No {isNT ? 'Greek' : 'Hebrew'} words found for this verse.</div>

  return (
    <div className="wordstudy-panel">
      <div className="wordstudy-lang-label">{isNT ? 'Greek New Testament' : 'Hebrew Old Testament'}</div>
      <div className="wordstudy-words">
        {words.map((w, i) => {
          const text = isNT ? (w as GreekWord).greek : (w as HebrewWord).hebrew
          const active = activeStrongs === w.strongs
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

      {activeStrongs && (
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
                {def.entry.definition && (
                  <p className="strongs-def">{def.entry.definition.trim()}</p>
                )}
                {def.entry.kjv_usage && (
                  <p className="strongs-kjv"><span className="strongs-kjv-label">KJV uses:</span> {def.entry.kjv_usage}</p>
                )}
              </>
            ) : (
              <div className="panel-empty">No definition found for {activeStrongs}.</div>
            )
          )}
        </div>
      )}
    </div>
  )
}
