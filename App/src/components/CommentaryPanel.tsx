import React, { useState } from 'react'
import { useCommentary } from '../hooks/useCommentary'
import { getFatherDates, getFatherSortYear } from '../lib/fatherDates'
import { getSourceUrl } from '../lib/sourceLinks'
import { CrossRefsPanel } from './CrossRefsPanel'
import { WordStudyPanel } from './WordStudyPanel'
import type { WordHighlight } from './WordStudyPanel'
import { JosephusPanel } from './JosephusPanel'
import { NotesPanel } from './NotesPanel'
import { TopicsPanel } from './TopicsPanel'
import { BookmarksPanel } from './BookmarksPanel'
import type { Bookmark, CommentaryEntry, CommentarySearchResult, SelectedVerse } from '../types'

export type RightTab = 'commentary' | 'crossrefs' | 'wordstudy' | 'firstcentury' | 'notes' | 'topics' | 'bookmarks'

interface Props {
  selected: SelectedVerse
  featuredEntry?: CommentarySearchResult | null
  onClearFeatured?: () => void
  onNavigate?: (book: string, chapter: number, verse: number) => void
  rightTab: RightTab
  onTabChange: (tab: RightTab) => void
  onWordSelect?: (info: WordHighlight | null) => void
  notesRefreshToken?: number
  bookmarks?: Bookmark[]
  onBookmarkRemove?: (book: string, chapter: number, verse: number) => void
}

function EntryView({
  entry,
  book,
  chapter,
}: {
  entry: CommentaryEntry
  book: string
  chapter: number
}) {
  const [expanded, setExpanded] = useState(false)
  const url = getSourceUrl(entry.father_name, book, chapter, entry.source_url)
  return (
    <div className="commentary-entry">
      <div className="commentary-header">
        <div className="commentary-father">
          <span className="father-name">{entry.father_name}</span>
          <span className="father-era">{getFatherDates(entry.father_name, entry.father_era)}</span>
        </div>
        {url && (
          <button
            className="source-link-btn"
            onClick={() => window.bibleApi.openExternal(url)}
            title="Read full text online"
          >
            Read full text ↗
          </button>
        )}
      </div>
      <p className="commentary-excerpt">
        {expanded ? entry.full_text : entry.excerpt}
      </p>
      {entry.full_text.length > entry.excerpt.length && (
        <button
          className="expand-inline-btn"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
      {entry.source && (
        <p className="commentary-source">{entry.source}</p>
      )}
    </div>
  )
}

function TabHeader({
  rightTab,
  onTabChange,
  location,
}: {
  rightTab: RightTab
  onTabChange: (tab: RightTab) => void
  location: string
}) {
  return (
    <div className="panel-header panel-header--tabs">
      <div className="panel-tabs">
        <button className={`panel-tab${rightTab === 'commentary' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('commentary')}>
          Fathers
        </button>
        <button className={`panel-tab${rightTab === 'crossrefs' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('crossrefs')}>
          Cross-Refs
        </button>
        <button className={`panel-tab${rightTab === 'wordstudy' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('wordstudy')}>
          Words
        </button>
        <button className={`panel-tab${rightTab === 'firstcentury' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('firstcentury')}>
          History
        </button>
        <button className={`panel-tab${rightTab === 'notes' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('notes')}>
          Notes
        </button>
        <button className={`panel-tab${rightTab === 'topics' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('topics')}>
          Topics
        </button>
        <button className={`panel-tab${rightTab === 'bookmarks' ? ' panel-tab--active' : ''}`} onClick={() => onTabChange('bookmarks')}>
          Saved
        </button>
      </div>
      <span className="panel-location">{location}</span>
    </div>
  )
}

export function CommentaryPanel({ selected, featuredEntry, onClearFeatured, onNavigate, rightTab, onTabChange, onWordSelect, notesRefreshToken, bookmarks = [], onBookmarkRemove }: Props) {
  const { entries, loading } = useCommentary(selected.book, selected.chapter, selected.verse)
  const [fatherSearch, setFatherSearch] = useState('')

  const location = selected.verse
    ? `${selected.book} ${selected.chapter}:${selected.verse}`
    : `${selected.book} ${selected.chapter}`

  if (featuredEntry && rightTab === 'commentary') {
    const verseLabel = `${featuredEntry.book} ${featuredEntry.chapter}:${featuredEntry.verse}`
    return (
      <div className="panel commentary-panel">
        <TabHeader rightTab={rightTab} onTabChange={onTabChange} location={location} />
        <div className="panel-body">
          <div className="commentary-featured-header">
            <button className="commentary-back-btn" onClick={onClearFeatured}>← All</button>
            <span className="commentary-featured-title">{featuredEntry.father_name} on </span>
            <button
              className="commentary-verse-chip"
              onClick={() => onNavigate?.(featuredEntry.book, featuredEntry.chapter, featuredEntry.verse)}
            >
              {verseLabel} ↗
            </button>
          </div>
          <EntryView entry={featuredEntry} book={featuredEntry.book} chapter={featuredEntry.chapter} />
        </div>
      </div>
    )
  }

  return (
    <div className="panel commentary-panel">
      <TabHeader rightTab={rightTab} onTabChange={onTabChange} location={location} />
      {rightTab === 'bookmarks' ? (
        <BookmarksPanel bookmarks={bookmarks} onNavigate={onNavigate} onRemove={(b, c, v) => onBookmarkRemove?.(b, c, v)} />
      ) : rightTab === 'topics' ? (
        <TopicsPanel selected={selected} onNavigate={onNavigate} />
      ) : rightTab === 'notes' ? (
        <NotesPanel onNavigate={onNavigate ?? (() => {})} refreshToken={notesRefreshToken} />
      ) : rightTab === 'crossrefs' ? (
        <CrossRefsPanel selected={selected} onNavigate={onNavigate} />
      ) : rightTab === 'wordstudy' ? (
        <WordStudyPanel selected={selected} onWordSelect={onWordSelect} />
      ) : rightTab === 'firstcentury' ? (
        <JosephusPanel selected={selected} />
      ) : (
        <div className="panel-body">
          {!selected.verse && (
            <div className="panel-empty">Select a verse to see commentary.</div>
          )}
          {selected.verse && (
            <input
              className="commentary-father-search"
              placeholder="Filter by father name…"
              value={fatherSearch}
              onChange={e => setFatherSearch(e.target.value)}
              spellCheck={false}
            />
          )}
          {selected.verse && loading && <div className="panel-loading">Loading...</div>}
          {selected.verse && !loading && entries.length === 0 && (
            <div className="panel-empty">No commentary found for this verse.</div>
          )}
          {(() => {
            const q = fatherSearch.trim().toLowerCase()
            const filtered = [...entries]
              .sort((a, b) => getFatherSortYear(a.father_name, a.father_era) - getFatherSortYear(b.father_name, b.father_era))
              .filter(e => !q || e.father_name.toLowerCase().includes(q))
            if (selected.verse && !loading && q && filtered.length === 0) {
              return <div className="panel-empty">No results for "{fatherSearch}".</div>
            }
            return filtered.map(entry => (
              <EntryView key={entry.id} entry={entry} book={selected.book} chapter={selected.chapter} />
            ))
          })()}
        </div>
      )}
    </div>
  )
}
