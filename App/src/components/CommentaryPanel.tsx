// Study panel — hosts every study tab (Android StudyScreen + Library) in the desktop right pane.
import { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { bibleDb } from '../db/sqlite'
import { getMaxVerse, getVerseText } from '../db/queries'
import type { CommentaryEntryWithRef } from '../db/queries'
import { stripUsfm } from '../data/redLetter'
import { usePref } from '../context/Prefs'
import { OverviewPanel } from './OverviewPanel'
import { FathersPanel } from './FathersPanel'
import { CrossRefsPanel } from './CrossRefsPanel'
import { WordStudyPanel } from './WordStudyPanel'
import { AquinasPanel } from './AquinasPanel'
import { DoctrinePanel } from './DoctrinePanel'
import { HistoricalPanel } from './HistoricalPanel'
import { ChurchHistoryPanel } from './ChurchHistoryPanel'
import { TopicsPanel } from './TopicsPanel'
import { MapPanel } from './MapPanel'
import { LibraryPanel } from './LibraryPanel'
import type { LibraryTab } from './LibraryPanel'
import { EntryCard } from './EntryCard'
import type { WordHighlight } from '../lib/wordHighlight'
import type { SelectedVerse } from '../types'

export type RightTab = 'overview' | 'fathers' | 'crossrefs' | 'words' | 'aquinas' | 'doctrine' | 'historical' | 'church' | 'topics' | 'map' | 'library'
type Nav = (book: string, chapter: number, verse: number) => void

const DEFAULT_TABS: { id: RightTab; label: string }[] = [
  { id: 'words', label: 'Words' },
  { id: 'overview', label: 'Overview' },
  { id: 'fathers', label: 'Church Fathers' },
  { id: 'crossrefs', label: 'Cross-Refs' },
  { id: 'aquinas', label: 'Aquinas' },
  { id: 'doctrine', label: 'Doctrine' },
  { id: 'historical', label: 'Historical' },
  { id: 'church', label: 'Church History' },
  { id: 'topics', label: 'Topics' },
  { id: 'map', label: 'Map' },
  { id: 'library', label: 'Library' },
]
const TAB_IDS = new Set(DEFAULT_TABS.map(t => t.id))

function SortableTab({ tab, active, dragging, onClick }: { tab: { id: RightTab; label: string }; active: boolean; dragging: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id })
  return (
    <button ref={setNodeRef} className={`panel-tab${active ? ' panel-tab--active' : ''}${dragging ? ' panel-tab--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }} onClick={onClick} {...attributes} {...listeners}>
      {tab.label}
    </button>
  )
}

function TabHeader({ rightTab, onTabChange }: { rightTab: RightTab; onTabChange: (t: RightTab) => void }) {
  const [saved, setSaved] = usePref('panel_tab_order')
  // Unknown ids (from older versions) drop out; new tabs append
  const order = (() => {
    try {
      const ids = (JSON.parse(saved || '[]') as string[]).filter(id => TAB_IDS.has(id as RightTab))
      return [...ids, ...DEFAULT_TABS.map(t => t.id).filter(id => !ids.includes(id))].map(id => DEFAULT_TABS.find(t => t.id === id)!)
    } catch { return DEFAULT_TABS }
  })()
  const [activeId, setActiveId] = useState<RightTab | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setEdges({ left: el.scrollLeft > 0, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
    const onWheel = (e: WheelEvent) => { if (e.deltaY) { e.preventDefault(); el.scrollBy({ left: e.deltaY, behavior: 'smooth' }) } }
    check()
    el.addEventListener('scroll', check, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); el.removeEventListener('wheel', onWheel); ro.disconnect() }
  }, [])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const ids = order.map(t => t.id)
    setSaved(JSON.stringify(arrayMove(ids, ids.indexOf(active.id as RightTab), ids.indexOf(over.id as RightTab))))
  }
  const dragTab = activeId ? order.find(t => t.id === activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as RightTab)} onDragEnd={onDragEnd}>
      <div className="panel-header panel-header--tabs">
        {edges.left && <button className="panel-tabs-arrow panel-tabs-arrow--left" onClick={() => scrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}>‹</button>}
        <SortableContext items={order.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="panel-tabs" ref={scrollRef}>
            {order.map(t => <SortableTab key={t.id} tab={t} active={rightTab === t.id} dragging={activeId === t.id} onClick={() => onTabChange(t.id)} />)}
          </div>
        </SortableContext>
        {edges.right && <button className="panel-tabs-arrow panel-tabs-arrow--right" onClick={() => scrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}>›</button>}
      </div>
      <DragOverlay>{dragTab && <button className="panel-tab panel-tab--drag-overlay">{dragTab.label}</button>}</DragOverlay>
    </DndContext>
  )
}

/** Android StudyScreen header: verse ref with ‹ › steppers and a two-line verse preview. */
function VerseHeader({ selected, onSelectVerse }: { selected: SelectedVerse; onSelectVerse: Nav }) {
  const [text, setText] = useState<string | null>(null)
  const [max, setMax] = useState(1)
  useEffect(() => {
    getVerseText(bibleDb, selected.book, selected.chapter, selected.verse).then(t => setText(t ? stripUsfm(t).replace(/¶\s*/g, '').replace(/[{}]/g, '') : null))
    getMaxVerse(bibleDb, selected.book, selected.chapter).then(setMax)
  }, [selected.book, selected.chapter, selected.verse])
  return (
    <div className="study-header">
      <div className="study-ref">
        <button className="link-btn" disabled={selected.verse <= 1} onClick={() => onSelectVerse(selected.book, selected.chapter, selected.verse - 1)}>‹</button>
        <span>{selected.book} {selected.chapter}:{selected.verse}</span>
        <button className="link-btn" disabled={selected.verse >= max} onClick={() => onSelectVerse(selected.book, selected.chapter, selected.verse + 1)}>›</button>
      </div>
      {text && <div className="study-preview">{text}</div>}
    </div>
  )
}

interface Props {
  selected: SelectedVerse
  rightTab: RightTab
  onTabChange: (t: RightTab) => void
  onNavigate: Nav
  onSelectVerse: Nav
  onPreview: Nav
  featuredEntry: CommentaryEntryWithRef | null
  onClearFeatured: () => void
  onWordSelect: (h: WordHighlight | null) => void
  jumpToStrongs: string | null
  onJumpHandled: () => void
  libraryTab: LibraryTab
  onLibraryTab: (t: LibraryTab) => void
  userVersion: number
  onUserChange: () => void
  onEditNote: (book: string, chapter: number, verse: number) => void
  browseFather: string | null
  onBrowseFather: (name: string | null) => void
}

export function CommentaryPanel(p: Props) {
  const [returnTab, setReturnTab] = useState<RightTab | null>(null)
  const openFather = (name: string) => {
    if (p.rightTab !== 'fathers') setReturnTab(p.rightTab)
    p.onBrowseFather(name)
    p.onTabChange('fathers')
  }

  const body = (() => {
    if (p.featuredEntry && p.rightTab === 'fathers') {
      const e = p.featuredEntry
      return (
        <div className="panel-body">
          <button className="link-btn" onClick={p.onClearFeatured}>‹ All commentary</button>
          <EntryCard entry={e} book={e.book} chapter={e.chapter} verse={e.verse} verseRef={`${e.book} ${e.chapter}:${e.verse}`} onNavigate={p.onNavigate} onOpenFather={openFather} />
        </div>
      )
    }
    switch (p.rightTab) {
      case 'overview': return <OverviewPanel selected={p.selected} />
      case 'fathers': return <FathersPanel selected={p.selected} onNavigate={p.onNavigate} browseFather={p.browseFather} onBrowseFather={p.onBrowseFather}
        returnLabel={returnTab ? DEFAULT_TABS.find(t => t.id === returnTab)?.label : null} onReturn={() => { if (returnTab) p.onTabChange(returnTab); setReturnTab(null) }} />
      case 'crossrefs': return <CrossRefsPanel selected={p.selected} onNavigate={p.onNavigate} />
      case 'words': return <WordStudyPanel selected={p.selected} onNavigate={p.onNavigate} onWordSelect={p.onWordSelect} jumpToStrongs={p.jumpToStrongs} onJumpHandled={p.onJumpHandled} />
      case 'aquinas': return <AquinasPanel selected={p.selected} onNavigate={p.onNavigate} onPreview={p.onPreview} />
      case 'doctrine': return <DoctrinePanel onNavigate={p.onNavigate} onPreview={p.onPreview} onOpenFather={openFather} />
      case 'historical': return <HistoricalPanel selected={p.selected} />
      case 'church': return <ChurchHistoryPanel onPreview={p.onPreview} onOpenFather={openFather} />
      case 'topics': return <TopicsPanel selected={p.selected} onNavigate={p.onNavigate} />
      case 'map': return <MapPanel selected={p.selected} onOpenFather={openFather} />
      case 'library': return <LibraryPanel tab={p.libraryTab} onTabChange={p.onLibraryTab} onNavigate={p.onNavigate}
        onEditNote={p.onEditNote} version={p.userVersion} onChanged={p.onUserChange} />
    }
  })()

  const verseTabs: RightTab[] = ['overview', 'fathers', 'crossrefs', 'words', 'aquinas', 'historical', 'topics']
  return (
    <div className="panel commentary-panel">
      <TabHeader rightTab={p.rightTab} onTabChange={p.onTabChange} />
      {verseTabs.includes(p.rightTab) && <VerseHeader selected={p.selected} onSelectVerse={p.onSelectVerse} />}
      {body}
    </div>
  )
}
