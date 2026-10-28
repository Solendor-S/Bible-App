// Aquinas tab — port of the Android AquinasPanel: Catena Aurea for the Gospels, the Summa
// Theologica / Summa Contra Gentiles browser, and the Thomistic metaphysics primer.
import { useEffect, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { getAquinasIndex, getAquinasQuestion, getCommentaryFromDb } from '../db/queries'
import type { AquinasArticle, AquinasIndex, AquinasWork } from '../db/queries'
import { AQUINAS_PHILOSOPHY } from '../data/aquinasPhilosophy'
import type { PhilosophySection } from '../data/aquinasPhilosophy'
import { EntryCard } from './EntryCard'
import { LinkedRefs } from './LinkedRefs'
import { Chips } from './Modal'
import type { CommentaryEntry, SelectedVerse } from '../types'

type Nav = (book: string, chapter: number, verse: number) => void
type Mode = 'verse' | 'browse' | 'philosophy'
const GOSPELS = new Set(['Matthew', 'Mark', 'Luke', 'John'])
const WORKS: Array<{ key: AquinasWork; name: string; sub: string }> = [
  { key: 'summa', name: 'Summa Theologica', sub: 'Part → Question → Article · 1920 Dominican translation' },
  { key: 'scg', name: 'Summa Contra Gentiles', sub: 'Book → Chapter · Rickaby 1905 (abridged)' },
]
const PART_LABEL: Record<string, string> = {
  'I': 'First Part (Prima Pars)', 'I-II': 'First Part of the Second Part', 'II-II': 'Second Part of the Second Part',
  'III': 'Third Part', 'Suppl.': 'Supplement', 'Appendix': 'Appendix',
  '1': 'Book I — God', '2': 'Book II — Creation', '3': 'Book III — Providence', '4': 'Book IV — Salvation',
}
const PART_ORDER = ['I', 'I-II', 'II-II', 'III', 'Suppl.', 'Appendix', '1', '2', '3', '4']

function Philosophy({ onPreview }: { onPreview: Nav }) {
  const [section, setSection] = useState<PhilosophySection | null>(null)
  if (!section) {
    return (
      <>
        <p className="source-note">A primer on Thomistic metaphysics — the grammar behind the Church's language about God, creation and the soul. Read in order; each section builds on the last.</p>
        {AQUINAS_PHILOSOPHY.map((s, i) => (
          <button key={s.id} className="list-row" onClick={() => setSection(s)}>
            <span className="list-row-num">{i + 1}</span>
            <span className="list-row-main"><span className="list-row-title">{s.title}</span><span className="list-row-sub">{s.summary}</span></span>
            <span className="chev">›</span>
          </button>
        ))}
      </>
    )
  }
  const idx = AQUINAS_PHILOSOPHY.indexOf(section)
  const next = AQUINAS_PHILOSOPHY[idx + 1]
  return (
    <>
      <button className="link-btn" onClick={() => setSection(null)}>‹ Contents</button>
      <h3 className="article-title">{idx + 1}. {section.title}</h3>
      {section.paragraphs.map((p, i) => <p key={i} className="article-para"><LinkedRefs text={p} onRef={onPreview} /></p>)}
      <div className="info-card">
        <div className="section-label">Scripture</div>
        {section.scripture.map((s, i) => <p key={i}><LinkedRefs text={s} onRef={onPreview} /></p>)}
      </div>
      {next && <button className="btn" onClick={() => setSection(next)}>Next: {next.title} ›</button>}
    </>
  )
}

function ArticleList({ articles, isScg }: { articles: AquinasArticle[]; isScg: boolean }) {
  const [open, setOpen] = useState<number | null>(isScg || articles.length === 1 ? articles[0]?.a ?? null : null)
  return (
    <>
      {articles.map(art => {
        const isOpen = open === art.a || art.a === 0
        return (
          <div key={art.a} className="commentary-entry">
            <button className="article-head" disabled={art.a === 0} onClick={() => setOpen(isOpen ? null : art.a)}>
              {art.a > 0 && !isScg ? `Art. ${art.a} — ` : ''}{art.t} {art.a !== 0 && <span className="chev">{isOpen ? '▾' : '▸'}</span>}
            </button>
            {isOpen && art.x.split(/\n{2,}/).map((p, i) => <p key={i} className="article-para">{p}</p>)}
          </div>
        )
      })}
    </>
  )
}

export function AquinasPanel({ selected, onNavigate, onPreview }: { selected: SelectedVerse; onNavigate: Nav; onPreview: Nav }) {
  const [mode, setMode] = useState<Mode>('verse')
  const [entries, setEntries] = useState<CommentaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [index, setIndex] = useState<AquinasIndex | null>(null)
  const [work, setWork] = useState<AquinasWork | null>(null)
  const [part, setPart] = useState<string | null>(null)
  const [question, setQuestion] = useState<number | null>(null)
  const [articles, setArticles] = useState<AquinasArticle[] | null>(null)
  const [filter, setFilter] = useState('')
  const isGospel = GOSPELS.has(selected.book)

  useEffect(() => {
    if (!isGospel) { setEntries([]); return }
    let live = true
    setLoading(true)
    getCommentaryFromDb(bibleDb, 'aquinas', selected.book, selected.chapter, selected.verse)
      .then(r => { if (live) { setEntries(r); setLoading(false) } })
    return () => { live = false }
  }, [selected.book, selected.chapter, selected.verse, isGospel])

  useEffect(() => { if (mode === 'browse' && !index) getAquinasIndex(bibleDb).then(setIndex) }, [mode, index])
  useEffect(() => {
    setArticles(null)
    if (work && part && question !== null) getAquinasQuestion(bibleDb, work, part, question).then(setArticles)
  }, [work, part, question])

  const back = () => { if (question !== null) setQuestion(null); else if (part) { setPart(null); setFilter('') } else setWork(null) }
  const ref = `${selected.book} ${selected.chapter}:${selected.verse}`

  let body: React.ReactNode
  if (mode === 'philosophy') body = <Philosophy onPreview={onPreview} />
  else if (mode === 'verse') {
    body = !isGospel ? <div className="panel-empty">Aquinas' Catena Aurea covers Matthew, Mark, Luke and John. Browse the Summa for {selected.book} themes.</div>
      : loading ? <div className="panel-loading">Loading…</div>
      : !entries.length ? <div className="panel-empty">No Catena entry recorded for {ref}</div>
      : <>
          <p className="source-note">Catena Aurea — the Fathers on {ref}, as compiled by Thomas Aquinas ({entries.length})</p>
          {entries.map(e => <EntryCard key={e.id} entry={e} book={selected.book} chapter={selected.chapter} verse={selected.verse} onNavigate={onNavigate} />)}
        </>
  } else if (!index) body = <div className="panel-loading">Loading…</div>
  else {
    const crumb = work && (
      <div className="crumb">
        <button className="link-btn" onClick={back}>‹</button>
        {WORKS.find(w => w.key === work)!.name}{part ? ` › ${work === 'scg' ? 'Book ' + part : part}` : ''}{question !== null ? ` › ${work === 'scg' ? 'Ch.' : 'Q.'} ${question}` : ''}
      </div>
    )
    let list: React.ReactNode
    if (!work) {
      list = WORKS.map(w => (
        <button key={w.key} className="list-row" onClick={() => setWork(w.key)}>
          <span className="list-row-main"><span className="list-row-title">{w.name}</span><span className="list-row-sub">{w.sub}</span></span><span className="chev">›</span>
        </button>
      ))
    } else if (!part) {
      list = Object.keys(index[work]).sort((a, b) => PART_ORDER.indexOf(a) - PART_ORDER.indexOf(b)).map(p => (
        <button key={p} className="list-row" onClick={() => setPart(p)}>
          <span className="list-row-main"><span className="list-row-title">{PART_LABEL[p] ?? p}</span>
            <span className="list-row-sub">{index[work][p].length} {work === 'scg' ? 'chapters' : 'questions'}</span></span><span className="chev">›</span>
        </button>
      ))
    } else if (question === null) {
      const f = filter.trim().toLowerCase()
      const qs = (index[work][part] ?? []).filter(q => !f || q.t.toLowerCase().includes(f) || !!q.a?.some(a => a.t.toLowerCase().includes(f)))
      list = (
        <>
          <input className="panel-search" placeholder={work === 'scg' ? 'Filter chapters…' : 'Filter questions and articles…'} value={filter} onChange={e => setFilter(e.target.value)} spellCheck={false} />
          {!qs.length && <div className="panel-empty">Nothing matches "{filter}"</div>}
          {qs.map(q => (
            <button key={q.q} className="list-row" onClick={() => setQuestion(q.q)}>
              <span className="list-row-num">{q.q}</span>
              <span className="list-row-main"><span className="list-row-title">{q.t}</span>
                {!!q.a?.length && <span className="list-row-sub">{q.a.length} article{q.a.length === 1 ? '' : 's'}</span>}</span><span className="chev">›</span>
            </button>
          ))}
        </>
      )
    } else list = articles ? <ArticleList articles={articles} isScg={work === 'scg'} /> : <div className="panel-loading">Loading…</div>
    body = <>{crumb}{list}</>
  }

  return (
    <div className="panel-body">
      <Chips value={mode} onChange={setMode} options={[{ value: 'verse', label: 'This Verse' }, { value: 'browse', label: 'Browse Works' }, { value: 'philosophy', label: 'Metaphysics/Philosophy' }]} />
      {body}
    </div>
  )
}
