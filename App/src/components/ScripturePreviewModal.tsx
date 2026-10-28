// Verse preview with "show chapter" and "go to" — ported from the Android ScripturePreviewModal.
import { useEffect, useRef, useState } from 'react'
import { bibleDb } from '../db/sqlite'
import { stripUsfm } from '../data/redLetter'
import { shortBookName } from '../data/books'
import { Modal } from './Modal'

export interface PreviewTarget { book: string; chapter: number; verse: number }

export function ScripturePreviewModal({ target, onClose, onNavigate }: {
  target: PreviewTarget | null
  onClose: () => void
  onNavigate: (book: string, chapter: number, verse: number) => void
}) {
  const [verseText, setVerseText] = useState<string | null>(null)
  const [chapterVerses, setChapterVerses] = useState<{ verse: number; text: string }[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const targetRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setExpanded(false); setChapterVerses(null); setVerseText(null)
    if (!target) return
    bibleDb.getFirstAsync<{ text: string }>('SELECT text FROM bible_verses WHERE book=? AND chapter=? AND verse=?',
      [target.book, target.chapter, target.verse]).then(r => setVerseText(r?.text ?? ''))
  }, [target?.book, target?.chapter, target?.verse])

  useEffect(() => {
    if (!expanded || !target || chapterVerses) return
    bibleDb.getAllAsync<{ verse: number; text: string }>('SELECT verse, text FROM bible_verses WHERE book=? AND chapter=? ORDER BY verse',
      [target.book, target.chapter]).then(setChapterVerses)
  }, [expanded, target, chapterVerses])

  useEffect(() => { if (chapterVerses) targetRef.current?.scrollIntoView({ block: 'center' }) }, [chapterVerses])

  if (!target) return null
  const { book, chapter, verse } = target
  return (
    <Modal open onClose={onClose} title={expanded ? `${shortBookName(book)} ${chapter} (KJV)` : `${shortBookName(book)} ${chapter}:${verse} (KJV)`}>
      {expanded ? (
        <div className="preview-chapter">
          {!chapterVerses ? <div className="panel-loading">Loading…</div> : chapterVerses.map(v => (
            <p key={v.verse} ref={v.verse === verse ? targetRef : undefined} className={`preview-verse${v.verse === verse ? ' preview-verse--target' : ''}`}>
              <sup>{v.verse}</sup> {stripUsfm(v.text)}
            </p>
          ))}
        </div>
      ) : (
        <p className="preview-text">{verseText === null ? 'Loading…' : verseText ? stripUsfm(verseText) : 'Verse not found.'}</p>
      )}
      <div className="dlg-actions">
        <button className="btn" onClick={() => setExpanded(e => !e)}>{expanded ? 'Show verse' : 'Show chapter'}</button>
        <button className="btn btn--primary" onClick={() => { onClose(); onNavigate(book, chapter, verse) }}>Go to {shortBookName(book)} {chapter}:{verse} →</button>
      </div>
    </Modal>
  )
}
