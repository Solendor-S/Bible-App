// Church History tab — the Android Councils / Heresies / Schisms / Creeds / Persecution /
// Canon / Timeline panels as sub-tabs, with their cross-links between each other.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { COUNCILS, COUNCIL_HAYSTACKS, BADGE_COLOR as COUNCIL_BADGE, CREED_LINK_PATTERNS, HERESY_LINK_PATTERNS } from '../data/councils'
import { HERESIES, HERESY_HAYSTACKS, BADGE_COLOR as HERESY_BADGE, COUNCIL_LINK_PATTERNS, parseVerseRefs as parseHeresyRefs } from '../data/heresies'
import { SCHISMS, BADGE_COLOR as SCHISM_BADGE } from '../data/schisms'
import { CREEDS, BADGE_COLOR as CREED_BADGE } from '../data/creeds'
import { PERSECUTIONS, BADGE_COLOR as PERSECUTION_BADGE } from '../data/persecutions'
import { DISPUTED_BOOKS, ERAS, MILESTONES, PRIMARY_SOURCES, STATUS_COLOR } from '../data/canon'
import { ALL_CATEGORIES, ALL_EVENTS, CATEGORY_CONFIG } from '../data/timeline'
import type { EventCategory } from '../data/timeline'
import { escapeRegex } from '../utils/regex'
import { Chips } from './Modal'

export type HistoryTab = 'councils' | 'heresies' | 'schisms' | 'creeds' | 'persecution' | 'canon' | 'timeline'
type Nav = (book: string, chapter: number, verse: number) => void
type Jump = (tab: HistoryTab, name: string) => void

const LINK_TARGET = new Map<string, HistoryTab>([
  ...CREED_LINK_PATTERNS.map(p => [p, 'creeds'] as const),
  ...HERESY_LINK_PATTERNS.map(p => [p, 'heresies'] as const),
  ...COUNCIL_LINK_PATTERNS.map(p => [p, 'councils'] as const),
])
const LINK_RE = new RegExp(`(${[...LINK_TARGET.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})`, 'g')

/** Text with creed / heresy / council names linked to their sub-tab. */
function Linked({ text, onJump, onRef }: { text: string; onJump: Jump; onRef?: Nav }) {
  return (
    <>
      {text.split(LINK_RE).map((part, i) => {
        const tab = LINK_TARGET.get(part)
        if (tab) return <button key={i} className="inline-ref" onClick={() => onJump(tab, part)}>{part}</button>
        if (!onRef) return part
        return parseHeresyRefs(part).map((s, j) => s.type === 'text' ? <span key={`${i}-${j}`}>{s.content}</span>
          : <button key={`${i}-${j}`} className="inline-ref" onClick={() => onRef(s.book, s.chapter, s.verse)}>{s.raw}</button>)
      })}
    </>
  )
}

function Badge({ c, children }: { c: { bg: string; text: string }; children: ReactNode }) {
  return <span className="hist-badge" style={{ background: c.bg, color: c.text, borderColor: 'transparent' }}>{children}</span>
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="hist-significance"><div className="section-label">{label}</div><div>{children}</div></div>
}

function useJumpScroll(jumpTo: string | undefined, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!jumpTo) return
    const el = ref.current?.querySelector(`[data-name="${CSS.escape(jumpTo)}"]`) as HTMLElement | null
    if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500) }
  }, [jumpTo, ...deps])
  return ref
}

function filterBy<T>(items: T[], haystacks: string[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? items.filter((_, i) => words.every(w => haystacks[i].includes(w))) : items
}

function Councils({ jumpTo, onJump }: { jumpTo?: string; onJump: Jump }) {
  const [q, setQ] = useState('')
  const list = filterBy(COUNCILS, COUNCIL_HAYSTACKS, q)
  const ref = useJumpScroll(jumpTo)
  return (
    <div ref={ref}>
      <input className="panel-search" placeholder="Filter councils…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
      {!list.length && <div className="panel-empty">No councils match "{q}"</div>}
      {list.map(c => (
        <div key={c.yearNum + c.name} className="hist-card" data-name={c.name}>
          <div className="hist-title">{c.name}<span className="hist-author"> · {c.year} AD</span></div>
          <div className="hist-meta"><Badge c={COUNCIL_BADGE[c.type]}>{c.type}</Badge> {c.location}</div>
          {c.notes && <Info label="Context">{c.notes}</Info>}
          <p className="hist-body"><Linked text={c.decree} onJump={onJump} /></p>
        </div>
      ))}
    </div>
  )
}

function HeresyCard({ h, open, onJump, onRef }: { h: typeof HERESIES[number]; open: boolean; onJump: Jump; onRef: Nav }) {
  const [why, setWhy] = useState(open)
  useEffect(() => { if (open) setWhy(true) }, [open])
  return (
    <div className="hist-card" data-name={h.name}>
      <div className="hist-title">{h.name}<span className="hist-author"> · {h.year}</span></div>
      <div className="hist-meta"><Badge c={HERESY_BADGE[h.severity]}>{h.severity}</Badge></div>
      <Info label="Condemned by"><Linked text={h.condemned} onJump={onJump} /></Info>
      <Info label="What it taught"><Linked text={h.taught} onJump={onJump} onRef={onRef} /></Info>
      {why && <Info label="Why condemned"><Linked text={h.why} onJump={onJump} onRef={onRef} /></Info>}
      <button className="expand-inline-btn" onClick={() => setWhy(w => !w)}>{why ? '▲ Hide reasoning' : '▼ Why condemned'}</button>
    </div>
  )
}

function Heresies({ jumpTo, onJump, onRef }: { jumpTo?: string; onJump: Jump; onRef: Nav }) {
  const [q, setQ] = useState('')
  const list = filterBy(HERESIES, HERESY_HAYSTACKS, q)
  const ref = useJumpScroll(jumpTo)
  return (
    <div ref={ref}>
      <input className="panel-search" placeholder="Filter heresies…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
      {!list.length && <div className="panel-empty">No heresies match "{q}"</div>}
      {list.map(h => <HeresyCard key={h.name} h={h} open={jumpTo === h.name} onJump={onJump} onRef={onRef} />)}
    </div>
  )
}

function Schisms({ onJump }: { onJump: Jump }) {
  const [q, setQ] = useState('')
  const hay = useMemo(() => SCHISMS.map(s => [s.name, s.parties, s.cause, s.outcome, s.status, s.year, s.notes ?? ''].join(' ').toLowerCase()), [])
  const list = filterBy(SCHISMS, hay, q)
  return (
    <div>
      <input className="panel-search" placeholder="Filter schisms…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
      {list.map(s => (
        <div key={s.name} className="hist-card" data-name={s.name}>
          <div className="hist-title">{s.name}<span className="hist-author"> · {s.year}</span></div>
          <div className="hist-meta"><Badge c={SCHISM_BADGE[s.status]}>{s.status}</Badge></div>
          <Info label="Parties"><Linked text={s.parties} onJump={onJump} /></Info>
          <Info label="Cause"><Linked text={s.cause} onJump={onJump} /></Info>
          <Info label="Outcome"><Linked text={s.outcome} onJump={onJump} /></Info>
          {s.notes && <Info label="Notes"><Linked text={s.notes} onJump={onJump} /></Info>}
        </div>
      ))}
    </div>
  )
}

function CreedCard({ c, open, onJump }: { c: typeof CREEDS[number]; open: boolean; onJump: Jump }) {
  const [full, setFull] = useState(open)
  useEffect(() => { if (open) setFull(true) }, [open])
  return (
    <div className="hist-card" data-name={c.name}>
      <div className="hist-title">{c.name}<span className="hist-author"> · {c.year}</span></div>
      <div className="hist-meta"><Badge c={CREED_BADGE[c.type]}>{c.type}</Badge> <Linked text={c.council} onJump={onJump} /></div>
      <Info label="Heresy addressed"><Linked text={c.heresyAddressed} onJump={onJump} /></Info>
      {full && <div className="creed-text">{c.fullText}</div>}
      {full && <Info label="Historical notes"><Linked text={c.historicalNotes} onJump={onJump} /></Info>}
      <button className="expand-inline-btn" onClick={() => setFull(f => !f)}>{full ? '▲ Hide text' : '▼ Read the creed'}</button>
    </div>
  )
}

function Creeds({ jumpTo, onJump }: { jumpTo?: string; onJump: Jump }) {
  const ref = useJumpScroll(jumpTo)
  return <div ref={ref}>{CREEDS.map(c => <CreedCard key={c.name} c={c} open={jumpTo === c.name} onJump={onJump} />)}</div>
}

function Persecutions({ jumpTo }: { jumpTo?: string }) {
  const [q, setQ] = useState('')
  const hay = useMemo(() => PERSECUTIONS.map(p => [p.emperor, p.dateRange, p.era, p.description, p.keyTexts, p.significance].join(' ').toLowerCase()), [])
  const list = filterBy(PERSECUTIONS, hay, q)
  const ref = useJumpScroll(jumpTo)
  return (
    <div ref={ref}>
      <input className="panel-search" placeholder="Filter persecutions…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
      {list.map(p => (
        <div key={p.emperor + p.yearNum} className="hist-card" data-name={p.emperor}>
          <div className="hist-title">{p.emperor}<span className="hist-author"> · {p.dateRange}</span></div>
          <div className="hist-meta"><Badge c={PERSECUTION_BADGE[p.era]}>{p.era}</Badge></div>
          <p className="hist-body">{p.description}</p>
          <Info label="Key texts">{p.keyTexts}</Info>
          <Info label="Significance">{p.significance}</Info>
        </div>
      ))}
    </div>
  )
}

function Canon() {
  const [q, setQ] = useState('')
  const [openSrc, setOpenSrc] = useState<string | null>(null)
  const f = q.trim().toLowerCase()
  const books = DISPUTED_BOOKS.filter(b => !f || (b.name + ' ' + b.notes).toLowerCase().includes(f))
  const milestones = MILESTONES.filter(m => !f || (m.event + ' ' + m.significance + ' ' + m.year).toLowerCase().includes(f))
  const sources = PRIMARY_SOURCES.filter(s => !f || (s.title + ' ' + s.text).toLowerCase().includes(f))
  return (
    <div>
      <input className="panel-search" placeholder="Search canon history…" value={q} onChange={e => setQ(e.target.value)} spellCheck={false} />
      <div className="era-header">Disputed &amp; Notable Books</div>
      <div className="canon-legend">{ERAS.map(e => <span key={e}>{e}</span>)}</div>
      {books.map(b => (
        <div key={b.name} className="canon-row">
          <div className="canon-book">{b.name} <span className="muted">{b.testament}</span></div>
          <div className="canon-status">{ERAS.map(e => <span key={e} className="hist-badge" style={{ background: STATUS_COLOR[b.status[e]].bg, color: STATUS_COLOR[b.status[e]].text, borderColor: 'transparent' }}>{b.status[e]}</span>)}</div>
          <div className="canon-notes">{b.notes}</div>
        </div>
      ))}
      <div className="era-header">Canon Formation Timeline</div>
      {milestones.map(m => (
        <div key={m.year + m.event} className="timeline-row">
          <span className="timeline-year">{m.year}</span>
          <span className="timeline-main"><b>{m.event}</b><span className="muted">{m.significance}</span></span>
        </div>
      ))}
      <div className="era-header">Primary Sources</div>
      {sources.map(s => (
        <div key={s.title} className="hist-card">
          <button className="article-head" onClick={() => setOpenSrc(o => o === s.title ? null : s.title)}>{s.title} <span className="muted">{s.year}</span> <span className="chev">{openSrc === s.title ? '▾' : '▸'}</span></button>
          {openSrc === s.title && <p className="hist-body creed-text">{s.text}</p>}
        </div>
      ))}
    </div>
  )
}

function Timeline({ onJump, onOpenFather }: { onJump: Jump; onOpenFather: (name: string) => void }) {
  const [cats, setCats] = useState<Set<EventCategory>>(new Set(ALL_CATEGORIES))
  const events = ALL_EVENTS.filter(e => cats.has(e.category))
  const toggle = (c: EventCategory) => setCats(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n.size ? n : s })
  return (
    <div>
      <div className="chip-wrap">
        {ALL_CATEGORIES.map(c => (
          <button key={c} className={`chip chip--small${cats.has(c) ? ' chip--active' : ''}`} onClick={() => toggle(c)}>
            <span className="tradition-dot" style={{ background: CATEGORY_CONFIG[c].color }} />{CATEGORY_CONFIG[c].label}
          </button>
        ))}
      </div>
      {events.map(e => (
        <button key={e.id} className="timeline-row timeline-row--btn"
          onClick={() => e.category === 'father' ? onOpenFather(e.title)
            : e.targetTab && e.targetTab !== 'fathers' && onJump(e.targetTab, e.title.replace(/ Persecution$/, ''))}>
          <span className="timeline-year">{e.yearLabel}</span>
          <span className="tradition-dot" style={{ background: CATEGORY_CONFIG[e.category].color }} />
          <span className="timeline-main"><b>{e.title}</b><span className="muted">{e.subtitle}</span></span>
        </button>
      ))}
    </div>
  )
}

const TABS: { value: HistoryTab; label: string }[] = [
  { value: 'councils', label: 'Councils' }, { value: 'heresies', label: 'Heresies' }, { value: 'schisms', label: 'Schisms' },
  { value: 'creeds', label: 'Creeds' }, { value: 'persecution', label: 'Persecution' }, { value: 'canon', label: 'Canon' },
  { value: 'timeline', label: 'Timeline' },
]

export function ChurchHistoryPanel({ onPreview, onOpenFather }: { onPreview: Nav; onOpenFather: (name: string) => void }) {
  const [tab, setTab] = useState<HistoryTab>('councils')
  const [jumpTo, setJumpTo] = useState<string | undefined>()
  const jump: Jump = (t, name) => { setTab(t); setJumpTo(name) }
  const go = (t: HistoryTab) => { setTab(t); setJumpTo(undefined) }
  return (
    <div className="panel-body">
      <Chips small value={tab} onChange={go} options={TABS} />
      {tab === 'councils' && <Councils jumpTo={jumpTo} onJump={jump} />}
      {tab === 'heresies' && <Heresies jumpTo={jumpTo} onJump={jump} onRef={onPreview} />}
      {tab === 'schisms' && <Schisms onJump={jump} />}
      {tab === 'creeds' && <Creeds jumpTo={jumpTo} onJump={jump} />}
      {tab === 'persecution' && <Persecutions jumpTo={jumpTo} />}
      {tab === 'canon' && <Canon />}
      {tab === 'timeline' && <Timeline onJump={jump} onOpenFather={onOpenFather} />}
    </div>
  )
}
