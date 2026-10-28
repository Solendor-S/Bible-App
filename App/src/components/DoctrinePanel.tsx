// Doctrine tab — port of the Android DoctrinePanel: how the fathers' teaching on a doctrine
// developed, commentary grouped by era.
import { useMemo, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { searchCommentaryByKeywords } from '../db/queries'
import type { CommentaryEntryWithRef } from '../db/queries'
import { DOCTRINES, DOCTRINE_ERAS } from '../data/doctrines'
import type { Doctrine } from '../data/doctrines'
import { getFatherInfo } from '../data/fatherDates'
import { EntryCard } from './EntryCard'
import { LinkedRefs } from './LinkedRefs'

type Nav = (book: string, chapter: number, verse: number) => void

export function DoctrinePanel({ onNavigate, onPreview, onOpenFather }: { onNavigate: Nav; onPreview: Nav; onOpenFather: (name: string) => void }) {
  const [selected, setSelected] = useState<Doctrine | null>(null)
  const [results, setResults] = useState<CommentaryEntryWithRef[]>([])
  const [loading, setLoading] = useState(false)

  async function pick(d: Doctrine) {
    if (selected?.id === d.id) { setSelected(null); setResults([]); return }
    setSelected(d); setLoading(true)
    try { setResults(await searchCommentaryByKeywords(bibleDb, d.keywords)) } finally { setLoading(false) }
  }

  const groups = useMemo(() => {
    const sorted = [...results].sort((a, b) => (getFatherInfo(a.father_name)?.sort ?? 9999) - (getFatherInfo(b.father_name)?.sort ?? 9999))
    const out: { era: string; entries: CommentaryEntryWithRef[] }[] = []
    for (const e of sorted) {
      const s = getFatherInfo(e.father_name)?.sort ?? 9999
      const era = DOCTRINE_ERAS.find(x => s <= x.maxSort)?.label ?? 'Medieval'
      if (out[out.length - 1]?.era !== era) out.push({ era, entries: [] })
      out[out.length - 1].entries.push(e)
    }
    return out
  }, [results])

  return (
    <div className="panel-body">
      <div className="chip-wrap">
        {DOCTRINES.map(d => <button key={d.id} className={`chip${selected?.id === d.id ? ' chip--active' : ''}`} onClick={() => pick(d)} title={d.description}>{d.label}</button>)}
      </div>
      <p className="source-note">Views expressed by Church Fathers may not reflect biblical teachings. Cross-reference with Scripture.</p>
      {!selected ? <div className="panel-empty">Select a doctrine to see how the church fathers developed their teaching over the centuries.</div> : (
        <>
          <p className="doctrine-desc">{selected.description}</p>
          <div className="info-card">
            <div className="section-label">How this doctrine developed</div>
            <p><LinkedRefs text={selected.development} onRef={onPreview} /></p>
          </div>
          {loading ? <div className="panel-loading">Searching the fathers…</div>
            : !results.length ? <div className="panel-empty">No matching commentary found.</div>
            : groups.map(g => (
              <div key={g.era}>
                <div className="era-header">{g.era}</div>
                {g.entries.map(e => <EntryCard key={e.id} entry={e} book={e.book} chapter={e.chapter} verse={e.verse}
                  verseRef={`${e.book} ${e.chapter}:${e.verse}`} onNavigate={onNavigate} onOpenFather={onOpenFather} />)}
              </div>
            ))}
        </>
      )}
    </div>
  )
}
