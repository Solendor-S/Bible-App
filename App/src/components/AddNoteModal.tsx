import React, { useState, useEffect, useRef } from 'react'
import type { Notebook, Note } from '../types'

interface NoteTarget {
  book: string
  chapter: number
  verse: number
  text: string
}

interface Props {
  target: NoteTarget
  onClose: () => void
  onSaved: () => void
}

export function AddNoteModal({ target, onClose, onSaved }: Props) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.notesApi.getNotebooks().then(list => {
      setNotebooks(list)
      if (list.length > 0) setSelectedId(list[0].id)
      else setCreatingNew(true)
    })
  }, [])

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSave() {
    if (saving) return
    let notebookId = selectedId

    if (creatingNew) {
      const name = newName.trim()
      if (!name) return
      const nb: Notebook = { id: crypto.randomUUID(), name, createdAt: Date.now() }
      await window.notesApi.saveNotebook(nb)
      notebookId = nb.id
    }

    if (!notebookId) return
    setSaving(true)

    const note: Note = {
      id: crypto.randomUUID(),
      notebookId,
      book: target.book,
      chapter: target.chapter,
      verse: target.verse,
      verseText: target.text,
      noteText: noteText.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await window.notesApi.saveNote(note)
    setSaving(false)
    onSaved()
    onClose()
  }

  const ref = `${target.book} ${target.chapter}:${target.verse}`
  const canSave = (creatingNew ? newName.trim().length > 0 : !!selectedId)

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="add-note-modal">
        <div className="add-note-header">
          <span className="add-note-ref">{ref}</span>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <p className="add-note-verse-text">"{target.text}"</p>

        <div className="add-note-section-label">Notebook</div>
        <div className="add-note-notebooks">
          {notebooks.map(nb => (
            <button
              key={nb.id}
              className={`notebook-chip${selectedId === nb.id && !creatingNew ? ' notebook-chip--active' : ''}`}
              onClick={() => { setSelectedId(nb.id); setCreatingNew(false) }}
            >
              {nb.name}
            </button>
          ))}
          <button
            className={`notebook-chip notebook-chip--new${creatingNew ? ' notebook-chip--active' : ''}`}
            onClick={() => { setCreatingNew(true); setSelectedId(null) }}
          >
            + New
          </button>
        </div>

        {creatingNew && (
          <input
            className="add-note-nb-input"
            placeholder="Notebook name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
        )}

        <div className="add-note-section-label">Note</div>
        <textarea
          ref={textRef}
          className="add-note-textarea"
          placeholder="Write your note…"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          rows={5}
        />

        <div className="add-note-actions">
          <button className="add-note-cancel" onClick={onClose}>Cancel</button>
          <button
            className="add-note-save"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

export type { NoteTarget }
