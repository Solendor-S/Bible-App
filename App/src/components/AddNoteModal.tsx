// Per-verse note editor (Android notes, plus desktop notebooks). One note per verse per notebook.
import { useEffect, useRef, useState } from 'react'
import { bibleDb, userDb } from '../db/sqlite'
import { createNotebook, deleteNote, getNote, getNotebooks, getVerseText, saveNote } from '../db/queries'
import { stripUsfm } from '../data/redLetter'
import { Modal } from './Modal'
import type { Notebook } from '../types'

export interface NoteTarget { book: string; chapter: number; verse: number }

export function AddNoteModal({ target, onClose, onSaved }: { target: NoteTarget; onClose: () => void; onSaved: () => void }) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [notebookId, setNotebookId] = useState(1)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [text, setText] = useState('')
  const [existing, setExisting] = useState(false)
  const [verseText, setVerseText] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getNotebooks(userDb).then(setNotebooks)
    getVerseText(bibleDb, target.book, target.chapter, target.verse).then(t => setVerseText(t ? stripUsfm(t) : ''))
    textRef.current?.focus()
  }, [target])

  useEffect(() => {
    getNote(userDb, target.book, target.chapter, target.verse, notebookId).then(n => { setText(n?.text ?? ''); setExisting(!!n) })
  }, [notebookId, target])

  async function save() {
    let id = notebookId
    if (creating) {
      if (!newName.trim()) return
      id = await createNotebook(userDb, newName.trim())
    }
    if (text.trim()) await saveNote(userDb, target.book, target.chapter, target.verse, text.trim(), id)
    else await deleteNote(userDb, target.book, target.chapter, target.verse, id)
    onSaved(); onClose()
  }

  async function remove() {
    await deleteNote(userDb, target.book, target.chapter, target.verse, notebookId)
    onSaved(); onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Note · ${target.book} ${target.chapter}:${target.verse}`}>
      {verseText && <p className="note-verse">{verseText}</p>}
      <div className="note-notebook-row">
        {creating ? (
          <input className="panel-search" placeholder="New notebook name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
        ) : (
          <select className="map-select" value={notebookId} onChange={e => setNotebookId(+e.target.value)}>
            {notebooks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        )}
        <button className="link-btn" onClick={() => setCreating(c => !c)}>{creating ? 'Choose existing' : '+ New notebook'}</button>
      </div>
      <textarea ref={textRef} className="note-textarea" rows={7} value={text} onChange={e => setText(e.target.value)}
        placeholder="Write your note…" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save() }} />
      <div className="dlg-actions">
        {existing && <button className="btn btn--danger" onClick={remove}>Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={save} disabled={creating && !newName.trim()}>Save (Ctrl+Enter)</button>
      </div>
    </Modal>
  )
}
