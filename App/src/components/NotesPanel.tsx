import React, { useState, useEffect } from 'react'
import type { Notebook, Note } from '../types'

interface Props {
  onNavigate: (book: string, chapter: number, verse: number) => void
  refreshToken?: number
}

export function NotesPanel({ onNavigate, refreshToken }: Props) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [openNotebook, setOpenNotebook] = useState<Notebook | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  useEffect(() => {
    window.notesApi.getNotebooks().then(setNotebooks)
  }, [refreshToken])

  useEffect(() => {
    if (!openNotebook) return
    setLoading(true)
    window.notesApi.getNotes(openNotebook.id).then(n => { setNotes(n); setLoading(false) })
  }, [openNotebook, refreshToken])

  async function deleteNote(id: string) {
    await window.notesApi.deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function deleteNotebook(nb: Notebook) {
    if (!confirm(`Delete notebook "${nb.name}" and all its notes?`)) return
    await window.notesApi.deleteNotebook(nb.id)
    setNotebooks(prev => prev.filter(n => n.id !== nb.id))
    if (openNotebook?.id === nb.id) setOpenNotebook(null)
  }

  // Notebook list view
  if (!openNotebook) {
    if (notebooks.length === 0) {
      return (
        <div className="notes-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          <p>No notebooks yet.</p>
          <p className="notes-empty-sub">Right-click any verse and choose Add Note.</p>
        </div>
      )
    }
    return (
      <div className="notes-panel">
        <div className="notes-panel-body">
          {notebooks.map(nb => (
            <div key={nb.id} className="notebook-row" onClick={() => setOpenNotebook(nb)}>
              <div className="notebook-row-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <span className="notebook-row-name">{nb.name}</span>
              <button
                className="notebook-row-delete"
                title="Delete notebook"
                onClick={e => { e.stopPropagation(); deleteNotebook(nb) }}
              >×</button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Note list view inside a notebook
  return (
    <div className="notes-panel">
      <div className="notes-nb-header">
        <button className="notes-back-btn" onClick={() => setOpenNotebook(null)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Notebooks
        </button>
        <span className="notes-nb-name">{openNotebook.name}</span>
      </div>

      <div className="notes-panel-body">
        {loading && <div className="panel-loading">Loading…</div>}
        {!loading && notes.length === 0 && (
          <div className="notes-empty">
            <p>No notes in this notebook.</p>
            <p className="notes-empty-sub">Right-click a verse and choose Add Note.</p>
          </div>
        )}
        {notes.map(note => {
          const ref = `${note.book} ${note.chapter}:${note.verse}`
          const expanded = expandedNote === note.id
          return (
            <div key={note.id} className="note-card">
              <div className="note-card-header">
                <button
                  className="note-ref-btn"
                  onClick={() => onNavigate(note.book, note.chapter, note.verse)}
                  title="Go to verse"
                >
                  {ref}
                </button>
                <button
                  className="note-card-delete"
                  title="Delete note"
                  onClick={() => deleteNote(note.id)}
                >×</button>
              </div>
              <p className="note-verse-preview">"{note.verseText}"</p>
              {note.noteText && (
                <p
                  className={`note-text${expanded ? ' note-text--expanded' : ''}`}
                  onClick={() => setExpandedNote(expanded ? null : note.id)}
                >
                  {note.noteText}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
