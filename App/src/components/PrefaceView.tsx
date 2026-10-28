// Book introductions — ported from the Android PrefaceView (canonical + early-text prefaces).
import type { ReactNode } from 'react'
import { getRawBookPreface } from '../data/bookPrefaces'
import { EARLY_TEXT_PREFACES } from '../data/earlyTextPrefaces'

type Nav = (book: string, chapter: number, verse: number) => void

// "Against Heresies 3.11" / "Against Heresies 3.11.8" anywhere in text → link into the early text
const AH_REF_RE = /Against Heresies (\d)\.(\d+)(?:\.(\d+))?/g

function LinkedText({ text, onNavigate }: { text: string; onNavigate: Nav }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(AH_REF_RE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index))
    parts.push(
      <button key={m.index} className="inline-ref" onClick={() => onNavigate(`Against Heresies Book ${m[1]}`, +m[2], m[3] ? +m[3] : 1)}>{m[0]}</button>
    )
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

function Section({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <section className={`preface-section preface-section--${tone}`}>
      <div className="preface-label">{label}</div>
      {children}
    </section>
  )
}

export function PrefaceView({ book, kind, onNavigate }: { book: string; kind?: 'apocrypha' | 'early'; onNavigate: Nav }) {
  if (kind === 'early') {
    const paras = (EARLY_TEXT_PREFACES[book] ?? '').split('\n\n').filter(p => p.trim())
    if (!paras.length) return <div className="panel-empty">No introduction for {book}.</div>
    return (
      <div className="preface">
        <h2 className="preface-title">{book}</h2>
        {paras.map((p, i) => <p key={i} className={i === 0 ? 'preface-summary' : 'preface-para'}><LinkedText text={p} onNavigate={onNavigate} /></p>)}
        <button className="btn btn--primary" onClick={() => onNavigate(book, 1, 1)}>Begin reading →</button>
      </div>
    )
  }
  const p = getRawBookPreface(book)
  if (!p) return <div className="panel-empty">No introduction for {book}.</div>
  return (
    <div className="preface">
      <h2 className="preface-title">{book}</h2>
      <p className="preface-summary">{p.summary}</p>
      <Section label="Author" tone="info"><p><LinkedText text={p.author} onNavigate={onNavigate} /></p></Section>
      <Section label="Date of Composition" tone="accent"><p>{p.dating}</p></Section>
      <Section label="Key Themes" tone="success"><ul>{p.themes.map((t, i) => <li key={i}>{t}</li>)}</ul></Section>
      {p.evidence?.length ? (
        <Section label="Evidence & Notes" tone="purple">
          <ul>{p.evidence.map((e, i) => <li key={i}><LinkedText text={e} onNavigate={onNavigate} /></li>)}</ul>
        </Section>
      ) : null}
      <div className="preface-sources"><span>Sources</span> <LinkedText text={p.sources.join('  ·  ')} onNavigate={onNavigate} /></div>
      <button className="btn btn--primary" onClick={() => onNavigate(book, 1, 1)}>Begin reading →</button>
    </div>
  )
}
