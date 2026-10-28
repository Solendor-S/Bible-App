// Prose with "Titus 3:5"-style scripture refs made clickable (Android DoctrinePanel parseVerseRefs).
const VERSE_RE_SRC = /\b((?:[1-4]\s+)?[A-Z][a-zA-Z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+):(\d+)\b/

export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'ref'; raw: string; book: string; chapter: number; verse: number }

export function parseVerseRefs(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(new RegExp(VERSE_RE_SRC.source, 'g'))) {
    if (m.index! > last) segments.push({ type: 'text', content: text.slice(last, m.index) })
    segments.push({ type: 'ref', raw: m[0], book: m[1].trim(), chapter: +m[2], verse: +m[3] })
    last = m.index! + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })
  return segments
}

export function LinkedRefs({ text, onRef }: { text: string; onRef: (book: string, chapter: number, verse: number) => void }) {
  return (
    <>
      {parseVerseRefs(text).map((s, i) => s.type === 'text' ? s.content : (
        <button key={i} className="inline-ref" onClick={() => onRef(s.book, s.chapter, s.verse)}>{s.raw}</button>
      ))}
    </>
  )
}
