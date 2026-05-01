import React, { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { HighlightsPanel } from './HighlightsPanel'
import { MapPanel } from './MapPanel'
import { CouncilsPanel } from './CouncilsPanel'
import { HeresiesPanel } from './HeresiesPanel'
import type { Bookmark, CommentaryEntry, CommentarySearchResult, SelectedVerse } from '../types'

export type RightTab = 'commentary' | 'crossrefs' | 'wordstudy' | 'firstcentury' | 'notes' | 'topics' | 'bookmarks' | 'highlights' | 'map' | 'councils' | 'heresies'

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
  translation?: string
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

const DEFAULT_TABS: { id: RightTab; label: string }[] = [
  { id: 'commentary', label: 'Fathers' },
  { id: 'crossrefs',  label: 'Cross-Refs' },
  { id: 'wordstudy',  label: 'Words' },
  { id: 'firstcentury', label: 'History' },
  { id: 'notes',      label: 'Notes' },
  { id: 'topics',     label: 'Topics' },
  { id: 'bookmarks',  label: 'Saved' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'map',        label: 'Map' },
  { id: 'councils',   label: 'Councils' },
  { id: 'heresies',   label: 'Heresies' },
]

const STORAGE_KEY = 'panel-tab-order'

function loadTabOrder(): { id: RightTab; label: string }[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_TABS
    const ids: RightTab[] = JSON.parse(saved)
    const map = Object.fromEntries(DEFAULT_TABS.map(t => [t.id, t]))
    const restored = ids.filter(id => id in map).map(id => map[id])
    const missing = DEFAULT_TABS.filter(t => !ids.includes(t.id))
    return [...restored, ...missing]
  } catch {
    return DEFAULT_TABS
  }
}

function SortableTab({
  tab,
  isActive,
  isDragging,
  onClick,
}: {
  tab: { id: RightTab; label: string }
  isActive: boolean
  isDragging: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id })
  return (
    <button
      ref={setNodeRef}
      className={`panel-tab${isActive ? ' panel-tab--active' : ''}${isDragging ? ' panel-tab--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {tab.label}
    </button>
  )
}

function TabHeader({
  rightTab,
  onTabChange,
}: {
  rightTab: RightTab
  onTabChange: (tab: RightTab) => void
}) {
  const [tabs, setTabs] = useState(loadTabOrder)
  const [activeId, setActiveId] = useState<RightTab | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as RightTab)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setTabs(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(t => t.id)))
      return next
    })
  }

  const activeTab = activeId ? tabs.find(t => t.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="panel-header panel-header--tabs">
        {canScrollLeft && (
          <button className="panel-tabs-arrow panel-tabs-arrow--left" onClick={() => scroll('left')} aria-label="Scroll tabs left">‹</button>
        )}
        <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="panel-tabs" ref={scrollRef}>
            {tabs.map(tab => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={rightTab === tab.id}
                isDragging={activeId === tab.id}
                onClick={() => onTabChange(tab.id)}
              />
            ))}
          </div>
        </SortableContext>
        {canScrollRight && (
          <button className="panel-tabs-arrow panel-tabs-arrow--right" onClick={() => scroll('right')} aria-label="Scroll tabs right">›</button>
        )}
      </div>
      <DragOverlay>
        {activeTab && (
          <button className="panel-tab panel-tab--drag-overlay">
            {activeTab.label}
          </button>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export function CommentaryPanel({ selected, featuredEntry, onClearFeatured, onNavigate, rightTab, onTabChange, onWordSelect, notesRefreshToken, bookmarks = [], onBookmarkRemove, translation = 'KJV' }: Props) {
  const { entries, loading } = useCommentary(selected.book, selected.chapter, selected.verse)
  const [fatherSearch, setFatherSearch] = useState('')

  if (featuredEntry && rightTab === 'commentary') {
    const verseLabel = `${featuredEntry.book} ${featuredEntry.chapter}:${featuredEntry.verse}`
    return (
      <div className="panel commentary-panel">
        <TabHeader rightTab={rightTab} onTabChange={onTabChange} />
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
      {(() => {
        switch (rightTab) {
          case 'highlights':
            return <HighlightsPanel onNavigate={onNavigate} translation={translation} />
          case 'map':
            return <MapPanel selected={selected} />
          case 'bookmarks':
            return <BookmarksPanel bookmarks={bookmarks} onNavigate={onNavigate} onRemove={(b, c, v) => onBookmarkRemove?.(b, c, v)} />
          case 'topics':
            return <TopicsPanel selected={selected} onNavigate={onNavigate} translation={translation} />
          case 'notes':
            return <NotesPanel onNavigate={onNavigate ?? (() => {})} refreshToken={notesRefreshToken} />
          case 'crossrefs':
            return <CrossRefsPanel selected={selected} onNavigate={onNavigate} translation={translation} />
          case 'wordstudy':
            return <WordStudyPanel selected={selected} onWordSelect={onWordSelect} />
          case 'firstcentury':
            return <JosephusPanel selected={selected} />
          case 'councils':
            return <CouncilsPanel />
          case 'heresies':
            return <HeresiesPanel />
          default: {
            const q = fatherSearch.trim().toLowerCase()
            const filtered = [...entries]
              .sort((a, b) => getFatherSortYear(a.father_name, a.father_era) - getFatherSortYear(b.father_name, b.father_era))
              .filter(e => !q || e.father_name.toLowerCase().includes(q))
            return (
              <div className="panel-body">
                {!selected.verse && <div className="panel-empty">Select a verse to see commentary.</div>}
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
                {selected.verse && !loading && entries.length === 0 && <div className="panel-empty">No commentary found for this verse.</div>}
                {selected.verse && !loading && q && filtered.length === 0 && <div className="panel-empty">No results for "{fatherSearch}".</div>}
                {filtered.map(entry => (
                  <EntryView key={entry.id} entry={entry} book={selected.book} chapter={selected.chapter} />
                ))}
              </div>
            )
          }
        }
      })()}
    </div>
  )
}
