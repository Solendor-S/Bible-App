// Library tab — Android LibraryScreen (Plans, Bookmarks, Highlights, Notes, History) in one
// panel, keeping desktop notebooks for notes. All data lives in user.db.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { bibleDb, userDb } from '../db/sqlite'
import {
  clearHistory, createCustomPlan, createPlanFromTemplate, deleteNotebook, deleteNote, deletePlan, getAllHighlights,
  getAllNotes, getBookmarks, getHistory, getNotebooks, getPlanEntriesForMonth, getPlans, getStreak, getTodayEntries,
  markEntryComplete, markEntryIncomplete, removeBookmark, removeHighlight, renameNotebook, createNotebook,
  PLAN_TEMPLATES,
} from '../db/queries'
import type { HistoryEntry, NoteWithVerse, PlanEntry, PlanWithProgress } from '../db/queries'
import { chaptersForBooks } from '../data/planTemplates'
import { BOOKS } from '../data/books'
import { stripUsfm } from '../data/redLetter'
import { HIGHLIGHT_COLORS, getHighlightBg } from '../theme/highlightColors'
import { formatDate } from '../utils/formatDate'
import { Chips } from './Modal'
import type { Bookmark, Highlight, Notebook } from '../types'

type Nav = (book: string, chapter: number, verse: number) => void
export type LibraryTab = 'plans' | 'bookmarks' | 'highlights' | 'notes' | 'history'

async function withText<T extends { book: string; chapter: number; verse: number }>(rows: T[]): Promise<(T & { text: string })[]> {
  return Promise.all(rows.map(async r => {
    const v = await bibleDb.getFirstAsync<{ text: string }>('SELECT text FROM bible_verses WHERE book=? AND chapter=? AND verse=?', [r.book, r.chapter, r.verse])
    return { ...r, text: v ? stripUsfm(v.text).replace(/¶\s*/g, '').replace(/[{}]/g, '') : '' }
  }))
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const planPct = (p: PlanWithProgress) => p.total_days > 0 ? Math.round((p.completed_entries / p.total_days) * 100) : 0

// ── Plans ─────────────────────────────────────────────────

function CreatePlan({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [custom, setCustom] = useState(false)
  const [books, setBooks] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [days, setDays] = useState(30)
  const chapters = useMemo(() => chaptersForBooks(BOOKS.filter(b => books.has(b.name)).map(b => b.name)), [books])
  const toggle = (b: string) => setBooks(s => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n })

  if (!custom) {
    return (
      <div>
        <div className="crumb"><button className="link-btn" onClick={onCancel}>‹</button> New Reading Plan</div>
        <div className="section-label">Quick Start</div>
        {PLAN_TEMPLATES.map(t => (
          <button key={t.key} className="list-row" onClick={async () => { await createPlanFromTemplate(userDb, t.key); onDone() }}>
            <span className="list-row-main"><span className="list-row-title">{t.label}</span><span className="list-row-sub">{t.description}</span></span><span className="chev">›</span>
          </button>
        ))}
        <button className="list-row" onClick={() => setCustom(true)}>
          <span className="list-row-main"><span className="list-row-title">Build your own</span><span className="list-row-sub">Choose specific books and set your own pace</span></span><span className="chev">›</span>
        </button>
      </div>
    )
  }
  return (
    <div>
      <div className="crumb"><button className="link-btn" onClick={() => setCustom(false)}>‹</button> Custom plan</div>
      <div className="section-label">Select Books</div>
      {(['OT', 'NT'] as const).map(t => (
        <div key={t} className="chip-wrap">
          <button className="chip chip--small" onClick={() => setBooks(s => { const n = new Set(s); BOOKS.filter(b => b.testament === t).forEach(b => n.add(b.name)); return n })}>All {t}</button>
          {BOOKS.filter(b => b.testament === t).map(b => (
            <button key={b.name} className={`chip chip--small${books.has(b.name) ? ' chip--active' : ''}`} onClick={() => toggle(b.name)}>{b.name}</button>
          ))}
        </div>
      ))}
      <div className="section-label">Set Duration</div>
      <div className="plan-form">
        <input className="panel-search" placeholder="Plan name" value={name} onChange={e => setName(e.target.value)} />
        <label className="plan-days"><input type="number" min={1} max={730} value={days} onChange={e => setDays(Math.max(1, +e.target.value || 1))} /> days</label>
        <span className="muted">{chapters.length} chapters · ≈ {chapters.length ? Math.ceil(chapters.length / days) : 0} chapters/day</span>
      </div>
      <button className="btn btn--primary" disabled={!chapters.length || !name.trim()}
        onClick={async () => { await createCustomPlan(userDb, name.trim(), chapters, days); onDone() }}>Create Plan</button>
    </div>
  )
}

function CalendarGrid({ year, month, dateMap }: { year: number; month: number; dateMap: Record<string, PlanEntry[]> }) {
  const days = new Date(year, month, 0).getDate()
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const today = isoDate(new Date())
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  return (
    <div className="cal-grid">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={i} />
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const e = dateMap[iso]
        const done = e?.length && e.every(x => x.completed_at != null)
        return <span key={i} className={`cal-day${e ? ' cal-day--sched' : ''}${done ? ' cal-day--done' : ''}${iso === today ? ' cal-day--today' : ''}`}>{d}</span>
      })}
    </div>
  )
}

function PlanDetail({ plan, onBack, onNavigate, onChanged }: { plan: PlanWithProgress; onBack: () => void; onNavigate: Nav; onChanged: () => void }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [month, setMonth] = useState<PlanEntry[]>([])
  const [today, setToday] = useState<PlanEntry[]>([])
  const [upcoming, setUpcoming] = useState<PlanEntry[]>([])
  const [streak, setStreak] = useState(0)
  const load = useCallback(async () => {
    const [me, te, st, up] = await Promise.all([
      getPlanEntriesForMonth(userDb, plan.id, ym.y, ym.m), getTodayEntries(userDb, plan.id), getStreak(userDb, plan.id),
      userDb.getAllAsync<PlanEntry>('SELECT * FROM plan_entries WHERE plan_id = ? AND target_date > ? ORDER BY target_date, id LIMIT 12', [plan.id, isoDate(new Date())]),
    ])
    setMonth(me); setToday(te); setStreak(st); setUpcoming(up)
  }, [plan.id, ym])
  useEffect(() => { load() }, [load])
  const dateMap = useMemo(() => { const m: Record<string, PlanEntry[]> = {}; for (const e of month) (m[e.target_date] ??= []).push(e); return m }, [month])
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m - 1 + d, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 } })
  const toggle = async (e: PlanEntry) => { e.completed_at ? await markEntryIncomplete(userDb, e.id) : await markEntryComplete(userDb, e.id); load(); onChanged() }
  const pct = planPct(plan)
  return (
    <div>
      <div className="crumb"><button className="link-btn" onClick={onBack}>‹</button> {plan.name} {streak > 0 && <span className="streak">🔥 {streak}</span>}</div>
      <div className="progress"><div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <div className="muted">{pct}% complete · {plan.total_days} days</div>
      {today.length > 0 && (
        <div className="info-card">
          <div className="section-label">Today</div>
          {today.map(e => (
            <div key={e.id} className="plan-entry">
              <button className="link-btn" onClick={() => onNavigate(e.book, e.chapter, 1)}>{e.book} {e.chapter}</button>
              <button className={`check${e.completed_at ? ' check--on' : ''}`} onClick={() => toggle(e)}>{e.completed_at ? '✓' : ''}</button>
            </div>
          ))}
        </div>
      )}
      <div className="cal-nav"><button className="link-btn" onClick={() => shift(-1)}>‹</button>
        {new Date(ym.y, ym.m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        <button className="link-btn" onClick={() => shift(1)}>›</button></div>
      <CalendarGrid year={ym.y} month={ym.m} dateMap={dateMap} />
      <div className="cal-legend"><span className="cal-day cal-day--done">●</span> Done <span className="cal-day cal-day--sched">●</span> Scheduled</div>
      {upcoming.length > 0 && (
        <>
          <div className="section-label">Upcoming</div>
          {upcoming.map(e => (
            <button key={e.id} className="list-row" onClick={() => onNavigate(e.book, e.chapter, 1)}>
              <span className="list-row-num">{formatIso(e.target_date)}</span><span className="list-row-main">{e.book} {e.chapter}</span>
            </button>
          ))}
        </>
      )}
      <button className="btn btn--danger" onClick={async () => { if (confirm(`Delete plan "${plan.name}"?`)) { await deletePlan(userDb, plan.id); onBack(); onChanged() } }}>Delete plan</button>
    </div>
  )
}

const formatIso = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }

function Plans({ onNavigate }: { onNavigate: Nav }) {
  const [plans, setPlans] = useState<PlanWithProgress[]>([])
  const [today, setToday] = useState<Record<number, PlanEntry[]>>({})
  const [view, setView] = useState<'list' | 'create' | number>('list')
  const refresh = useCallback(async () => {
    const list = await getPlans(userDb)
    setPlans(list)
    setToday(Object.fromEntries(await Promise.all(list.map(async p => [p.id, await getTodayEntries(userDb, p.id)] as const))))
  }, [])
  useEffect(() => { refresh() }, [refresh])

  if (view === 'create') return <CreatePlan onDone={() => { setView('list'); refresh() }} onCancel={() => setView('list')} />
  const open = plans.find(p => p.id === view)
  if (open) return <PlanDetail plan={open} onBack={() => setView('list')} onNavigate={onNavigate} onChanged={refresh} />
  return (
    <div>
      <div className="row-between"><div className="section-label">Reading Plans</div><button className="btn btn--small" onClick={() => setView('create')}>+ New</button></div>
      {!plans.length && <div className="panel-empty">No plans yet — create a reading plan to track your daily study.</div>}
      {plans.map(p => {
        const t = today[p.id] ?? []
        const allDone = t.length > 0 && t.every(e => e.completed_at != null)
        return (
          <div key={p.id} className="plan-card">
            <button className="plan-card-main" onClick={() => setView(p.id)}>
              <span className="list-row-title">{p.name}</span>
              <div className="progress"><div className="progress-fill" style={{ width: `${Math.min(planPct(p), 100)}%` }} /></div>
              <span className="muted">{planPct(p)}% · {p.total_days} days</span>
            </button>
            {t.length ? (
              <div className="plan-today">
                <span>Today: {t.map(e => `${e.book} ${e.chapter}`).join(', ')}</span>
                <button className={`check${allDone ? ' check--on' : ''}`} title="Mark today done"
                  onClick={async () => { for (const e of t) allDone ? await markEntryIncomplete(userDb, e.id) : await markEntryComplete(userDb, e.id); refresh() }}>{allDone ? '✓' : ''}</button>
              </div>
            ) : <div className="muted">No reading scheduled for today</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Bookmarks (drag to reorder) ───────────────────────────

function SortableBookmark({ b, onNavigate, onRemove }: { b: Bookmark & { text: string }; onNavigate: Nav; onRemove: () => void }) {
  const id = `${b.book}|${b.chapter}|${b.verse}`
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div ref={setNodeRef} className="lib-row" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">⠿</span>
      <button className="lib-row-main" onClick={() => onNavigate(b.book, b.chapter, b.verse)}>
        <span className="lib-ref">{b.book} {b.chapter}:{b.verse}</span><span className="lib-text">{b.text}</span>
      </button>
      <button className="lib-remove" title="Remove" onClick={onRemove}>✕</button>
    </div>
  )
}

function Bookmarks({ onNavigate, version, onChanged }: { onNavigate: Nav; version: number; onChanged: () => void }) {
  const [list, setList] = useState<(Bookmark & { text: string })[]>([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  useEffect(() => { getBookmarks(userDb).then(withText).then(setList) }, [version])
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = list.map(b => `${b.book}|${b.chapter}|${b.verse}`)
    const next = arrayMove(list, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setList(next)
    for (let i = 0; i < next.length; i++) await userDb.runAsync('UPDATE bookmarks SET position = ? WHERE book = ? AND chapter = ? AND verse = ?', [i, next[i].book, next[i].chapter, next[i].verse])
  }
  if (!list.length) return <div className="panel-empty">No bookmarks yet — click ☆ beside a verse.</div>
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={list.map(b => `${b.book}|${b.chapter}|${b.verse}`)} strategy={verticalListSortingStrategy}>
        {list.map(b => <SortableBookmark key={`${b.book}|${b.chapter}|${b.verse}`} b={b} onNavigate={onNavigate}
          onRemove={async () => { await removeBookmark(userDb, b.book, b.chapter, b.verse); onChanged() }} />)}
      </SortableContext>
    </DndContext>
  )
}

// ── Highlights ────────────────────────────────────────────

function Highlights({ onNavigate, version, onChanged }: { onNavigate: Nav; version: number; onChanged: () => void }) {
  const [list, setList] = useState<(Highlight & { text: string })[]>([])
  const [color, setColor] = useState<string>('all')
  useEffect(() => { getAllHighlights(userDb).then(withText).then(setList) }, [version])
  const shown = color === 'all' ? list : list.filter(h => h.color === color)
  return (
    <div>
      <div className="chip-wrap">
        <button className={`chip chip--small${color === 'all' ? ' chip--active' : ''}`} onClick={() => setColor('all')}>All ({list.length})</button>
        {HIGHLIGHT_COLORS.map(c => {
          const n = list.filter(h => h.color === c.key).length
          return n ? <button key={c.key} className={`chip chip--small${color === c.key ? ' chip--active' : ''}`} onClick={() => setColor(c.key)}>
            <span className="tradition-dot" style={{ background: c.swatch }} />{n}</button> : null
        })}
      </div>
      {!shown.length && <div className="panel-empty">No highlights yet — right-click a verse to highlight it.</div>}
      {shown.map(h => (
        <div key={`${h.book}|${h.chapter}|${h.verse}`} className="lib-row" style={{ background: getHighlightBg(h.color) }}>
          <button className="lib-row-main" onClick={() => onNavigate(h.book, h.chapter, h.verse)}>
            <span className="lib-ref">{h.book} {h.chapter}:{h.verse}</span><span className="lib-text">{h.text}</span>
          </button>
          <button className="lib-remove" title="Remove highlight" onClick={async () => { await removeHighlight(userDb, h.book, h.chapter, h.verse); onChanged() }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ── Notes (notebooks) ─────────────────────────────────────

function Notes({ onNavigate, onEditNote, version, onChanged }: { onNavigate: Nav; onEditNote: (b: string, c: number, v: number) => void; version: number; onChanged: () => void }) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [nb, setNb] = useState<number | 'all'>('all')
  const [notes, setNotes] = useState<NoteWithVerse[]>([])
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    getNotebooks(userDb).then(setNotebooks)
    getAllNotes(userDb, bibleDb).then(setNotes)
  }, [version])
  const shown = nb === 'all' ? notes : notes.filter(n => n.notebookId === nb)
  const current = notebooks.find(n => n.id === nb)
  return (
    <div>
      <div className="chip-wrap">
        <button className={`chip chip--small${nb === 'all' ? ' chip--active' : ''}`} onClick={() => setNb('all')}>All ({notes.length})</button>
        {notebooks.map(n => <button key={n.id} className={`chip chip--small${nb === n.id ? ' chip--active' : ''}`} onClick={() => setNb(n.id)}>{n.name}</button>)}
        <button className="chip chip--small" onClick={async () => { const name = prompt('Notebook name'); if (name?.trim()) { setNb(await createNotebook(userDb, name.trim())); onChanged() } }}>+</button>
      </div>
      {current && (
        <div className="row-between">
          <button className="link-btn" onClick={async () => { const name = prompt('Rename notebook', current.name); if (name?.trim()) { await renameNotebook(userDb, current.id, name.trim()); onChanged() } }}>Rename</button>
          {current.id !== 1 && <button className="link-btn" onClick={async () => { if (confirm(`Delete notebook "${current.name}" and its notes?`)) { await deleteNotebook(userDb, current.id); setNb('all'); onChanged() } }}>Delete notebook</button>}
        </div>
      )}
      {!shown.length && <div className="panel-empty">No notes yet — right-click a verse and choose "Add note…".</div>}
      {shown.map(n => (
        <div key={n.id} className="note-card">
          <div className="row-between">
            <button className="lib-ref link-btn" onClick={() => onNavigate(n.book, n.chapter, n.verse)}>{n.book} {n.chapter}:{n.verse}</button>
            <span className="muted">{formatDate(n.updatedAt)} · {notebooks.find(x => x.id === n.notebookId)?.name}</span>
          </div>
          <p className="lib-text">{stripUsfm(n.verseText).replace(/¶\s*/g, '').replace(/[{}]/g, "")}</p>
          <p className={`note-body${open === n.id ? '' : ' note-body--clamp'}`} onClick={() => setOpen(o => o === n.id ? null : n.id)}>{n.noteText}</p>
          <div className="row-end">
            <button className="link-btn" onClick={() => onEditNote(n.book, n.chapter, n.verse)}>Edit</button>
            <button className="link-btn" onClick={async () => { if (confirm('Delete this note?')) { await deleteNote(userDb, n.book, n.chapter, n.verse, n.notebookId); onChanged() } }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── History ───────────────────────────────────────────────

function History({ onNavigate, version, onChanged }: { onNavigate: Nav; version: number; onChanged: () => void }) {
  const [rows, setRows] = useState<HistoryEntry[]>([])
  useEffect(() => { getHistory(userDb).then(setRows) }, [version])
  const groups = useMemo(() => {
    const g: { day: string; rows: HistoryEntry[] }[] = []
    for (const r of rows) {
      const day = new Date(r.visitedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
      if (g[g.length - 1]?.day !== day) g.push({ day, rows: [] })
      g[g.length - 1].rows.push(r)
    }
    return g
  }, [rows])
  if (!rows.length) return <div className="panel-empty">No reading history yet.</div>
  return (
    <div>
      <div className="row-end"><button className="link-btn" onClick={async () => { if (confirm('Clear all reading history?')) { await clearHistory(userDb); onChanged() } }}>Clear history</button></div>
      {groups.map(g => (
        <div key={g.day}>
          <div className="era-header">{g.day}</div>
          {g.rows.map(r => (
            <button key={`${r.book}${r.chapter}`} className="list-row" onClick={() => onNavigate(r.book, r.chapter, 1)}>
              <span className="list-row-main">{r.book} {r.chapter}</span>
              <span className="muted">{new Date(r.visitedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function LibraryPanel({ tab, onTabChange, onNavigate, onEditNote, version, onChanged }: {
  tab: LibraryTab
  onTabChange: (t: LibraryTab) => void
  onNavigate: Nav
  onEditNote: (b: string, c: number, v: number) => void
  version: number
  onChanged: () => void
}) {
  return (
    <div className="panel-body">
      <Chips small value={tab} onChange={onTabChange} options={[
        { value: 'plans', label: 'Plans' }, { value: 'bookmarks', label: 'Bookmarks' }, { value: 'highlights', label: 'Highlights' },
        { value: 'notes', label: 'Notes' }, { value: 'history', label: 'History' },
      ]} />
      {tab === 'plans' && <Plans onNavigate={onNavigate} />}
      {tab === 'bookmarks' && <Bookmarks onNavigate={onNavigate} version={version} onChanged={onChanged} />}
      {tab === 'highlights' && <Highlights onNavigate={onNavigate} version={version} onChanged={onChanged} />}
      {tab === 'notes' && <Notes onNavigate={onNavigate} onEditNote={onEditNote} version={version} onChanged={onChanged} />}
      {tab === 'history' && <History onNavigate={onNavigate} version={version} onChanged={onChanged} />}
    </div>
  )
}
