import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { OverviewVerse, OverviewChapter, OverviewPericope, BiblehubChapter, BiblehubPassage, BiblesummaryChapter, SelectedVerse } from '../types'

type Scope = 'verse' | 'chapter' | 'context'

const HTML_ENTITIES: Record<string, string> = {
  '&ndash;': '–', '&mdash;': '—', '&lsquo;': '‘', '&rsquo;': '’',
  '&ldquo;': '“', '&rdquo;': '”', '&quot;': '"', '&apos;': "'",
  '&hellip;': '…', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
}
function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;/gi, e => HTML_ENTITIES[e] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

const COLLAPSED_HEIGHT = 130

function SourceSection({ name, children }: { name: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const measure = () => setOverflows(el.scrollHeight > COLLAPSED_HEIGHT)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="overview-source-section">
      <div className="overview-source-header">
        <span className="overview-source-line" />
        <span className="overview-source-name">{name}</span>
        <span className="overview-source-line" />
      </div>
      <div
        ref={bodyRef}
        className={`overview-section-body${!expanded && overflows ? ' overview-section-body--collapsed' : ''}`}
      >
        {children}
      </div>
      {overflows && (
        <button className="overview-show-more" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less ↑' : 'Show more ↓'}
        </button>
      )}
      {name === 'bibleref' && (
        <button
          className="overview-attribution"
          onClick={() => window.bibleApi.openExternal('https://www.gotquestions.org')}
        >
          © Got Questions Ministries · gotquestions.org
        </button>
      )}
    </div>
  )
}

interface Props {
  selected: SelectedVerse
}

export function OverviewPanel({ selected }: Props) {
  const [scope, setScope] = useState<Scope>('verse')
  const [verseData, setVerseData] = useState<OverviewVerse | null>(null)
  const [chapterData, setChapterData] = useState<OverviewChapter | null>(null)
  const [pericopeData, setPericopeData] = useState<OverviewPericope | null>(null)
  const [biblehubData, setBiblehubData] = useState<BiblehubChapter | null>(null)
  const [biblehubPassage, setBiblehubPassage] = useState<BiblehubPassage | null>(null)
  const [biblesummaryData, setBiblesummaryData] = useState<BiblesummaryChapter | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selected?.book || !selected?.chapter) return
    setChapterData(null)
    setBiblehubData(null)
    setBiblesummaryData(null)
    const { book, chapter } = selected
    Promise.all([
      window.overviewApi.getChapter(book, chapter).catch(() => null),
      window.overviewApi.getBiblehubChapter(book, chapter).catch(() => null),
      window.overviewApi.getBiblesummaryChapter(book, chapter).catch(() => null),
    ]).then(([ch, bh, bs]) => {
      setChapterData(ch ?? null)
      setBiblehubData(bh ?? null)
      setBiblesummaryData(bs ?? null)
    })
  }, [selected?.book, selected?.chapter])

  useEffect(() => {
    if (!selected?.book || !selected?.chapter) return
    setLoading(true)
    setVerseData(null)
    setPericopeData(null)
    setBiblehubPassage(null)
    const { book, chapter, verse } = selected
    if (!verse) { setLoading(false); return }
    Promise.all([
      window.overviewApi.getVerse(book, chapter, verse).catch(() => null),
      window.overviewApi.getPericope(book, chapter, verse).catch(() => null),
      window.overviewApi.getBiblehubPassage(book, chapter, verse).catch(() => null),
    ]).then(([v, p, bhp]) => {
      setVerseData(v ?? null)
      setPericopeData(p ?? null)
      setBiblehubPassage(bhp ?? null)
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
          <SourceSection name="bibleref">
            {verseData?.note
              ? <p className="overview-note">{decodeEntities(verseData.note)}</p>
              : <div className="panel-empty">{selected.verse ? 'No overview available for this verse.' : 'Select a verse.'}</div>
            }
          </SourceSection>
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
          <SourceSection name="bibleref">
            {chapterData?.summary
              ? <p className="overview-note">{decodeEntities(chapterData.summary)}</p>
              : <div className="panel-empty">No chapter summary available.</div>
            }
          </SourceSection>
          {biblehubData?.essay && (
            <SourceSection name="biblehub">
              {biblehubData.essay.split('\n\n').map((para, i) => (
                <p key={i} className="overview-note">{decodeEntities(para)}</p>
              ))}
            </SourceSection>
          )}
          {biblesummaryData?.summary && (
            <SourceSection name="biblesummary">
              <p className="overview-note overview-note--tagline">{decodeEntities(biblesummaryData.summary)}</p>
            </SourceSection>
          )}
        </div>
      )}

      {!loading && scope === 'context' && (
        <div className="overview-content">
          <SourceSection name="bibleref">
            {pericopeData ? (
              <>
                <div className="overview-pericope-title">{decodeEntities(pericopeData.title || `${selected.book} ${selected.chapter}:${pericopeData.verse_start}–${pericopeData.verse_end}`)}</div>
                <div className="overview-pericope-range">{selected.book} {selected.chapter}:{pericopeData.verse_start}–{pericopeData.verse_end}</div>
                {pericopeData.description && (
                  <p className="overview-note">{decodeEntities(pericopeData.description)}</p>
                )}
              </>
            ) : (
              <div className="panel-empty">{selected.verse ? 'No passage grouping found for this verse.' : 'Select a verse.'}</div>
            )}
          </SourceSection>
          {biblehubPassage && (
            <SourceSection name="biblehub">
              <div className="overview-pericope-title">{decodeEntities(biblehubPassage.heading)}</div>
              <div className="overview-pericope-range">{selected.book} {selected.chapter}:{biblehubPassage.verse_start}–{biblehubPassage.verse_end}</div>
              {biblehubPassage.text && (
                <p className="overview-note">{decodeEntities(biblehubPassage.text)}</p>
              )}
            </SourceSection>
          )}
        </div>
      )}
    </div>
  )
}
