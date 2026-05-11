import React, { useEffect, useState } from 'react'
import type { OverviewVerse, OverviewChapter, OverviewPericope, SelectedVerse } from '../types'

type Scope = 'verse' | 'chapter' | 'context'

interface Props {
  selected: SelectedVerse
}

export function OverviewPanel({ selected }: Props) {
  const [scope, setScope] = useState<Scope>('verse')
  const [verseData, setVerseData] = useState<OverviewVerse | null>(null)
  const [chapterData, setChapterData] = useState<OverviewChapter | null>(null)
  const [pericopeData, setPericopeData] = useState<OverviewPericope | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selected?.book || !selected?.chapter) return
    setLoading(true)
    setVerseData(null)
    setChapterData(null)
    setPericopeData(null)

    const { book, chapter, verse } = selected
    const promises: Promise<any>[] = [
      window.overviewApi.getChapter(book, chapter).catch(() => null),
    ]
    if (verse) {
      promises.push(
        window.overviewApi.getVerse(book, chapter, verse).catch(() => null),
        window.overviewApi.getPericope(book, chapter, verse).catch(() => null),
      )
    }
    Promise.all(promises).then(([ch, v, p]) => {
      setChapterData(ch ?? null)
      setVerseData(v ?? null)
      setPericopeData(p ?? null)
      setLoading(false)
    })
  }, [selected?.book, selected?.chapter, selected?.verse])

  if (!selected?.book) return <div className="panel-empty">Select a verse to see overview.</div>

  const themes: string[] = chapterData?.themes ? JSON.parse(chapterData.themes) : []

  return (
    <div className="panel-body overview-panel">
      <div className="overview-scope-row">
        {(['verse', 'chapter', 'context'] as Scope[]).map(s => (
          <button
            key={s}
            className={`overview-scope-btn${scope === s ? ' overview-scope-btn--active' : ''}`}
            onClick={() => setScope(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="panel-loading">Loading...</div>}

      {!loading && scope === 'verse' && (
        <div className="overview-content">
          <div className="overview-heading">{selected.book} {selected.chapter}{selected.verse ? `:${selected.verse}` : ''}</div>
          {verseData?.note
            ? <p className="overview-note">{verseData.note}</p>
            : <div className="panel-empty">{selected.verse ? 'No overview available for this verse.' : 'Select a verse.'}</div>
          }
        </div>
      )}

      {!loading && scope === 'chapter' && (
        <div className="overview-content">
          <div className="overview-heading">{selected.book} {selected.chapter}</div>
          {themes.length > 0 && (
            <div className="overview-themes">
              {themes.map(t => <span key={t} className="overview-theme-chip">{t}</span>)}
            </div>
          )}
          {themes.length > 0 && chapterData?.summary && <div className="overview-divider" />}
          {chapterData?.summary
            ? <p className="overview-note">{chapterData.summary}</p>
            : <div className="panel-empty">No chapter summary available.</div>
          }
        </div>
      )}

      {!loading && scope === 'context' && (
        <div className="overview-content">
          {pericopeData ? (
            <>
              <div className="overview-pericope-title">{pericopeData.title || `${selected.book} ${selected.chapter}:${pericopeData.verse_start}–${pericopeData.verse_end}`}</div>
              <div className="overview-pericope-range">{selected.book} {selected.chapter}:{pericopeData.verse_start}–{pericopeData.verse_end}</div>
              {pericopeData.description
                ? <p className="overview-note">{pericopeData.description}</p>
                : null
              }
            </>
          ) : (
            <div className="panel-empty">{selected.verse ? 'No passage grouping found for this verse.' : 'Select a verse.'}</div>
          )}
        </div>
      )}
    </div>
  )
}
