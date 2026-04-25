import React from 'react'
import type { Bookmark } from '../types'

interface Props {
  bookmarks: Bookmark[]
  onNavigate?: (book: string, chapter: number, verse: number) => void
  onRemove: (book: string, chapter: number, verse: number) => void
}

export function BookmarksPanel({ bookmarks, onNavigate, onRemove }: Props) {
  if (bookmarks.length === 0) {
    return (
      <div className="panel-body">
        <div className="panel-empty">
          No bookmarks yet. Click ☆ on any verse to save it here.
        </div>
      </div>
    )
  }

  return (
    <div className="panel-body bookmarks-list">
      {bookmarks.map(bm => (
        <div key={bm.id} className="bookmark-item">
          <button
            className="bookmark-item-main"
            onClick={() => onNavigate?.(bm.book, bm.chapter, bm.verse)}
          >
            <span className="bookmark-item-ref">
              {bm.book} {bm.chapter}:{bm.verse}
            </span>
            <span className="bookmark-item-text">{bm.verseText}</span>
          </button>
          <button
            className="bookmark-item-remove"
            onClick={() => onRemove(bm.book, bm.chapter, bm.verse)}
            title="Remove bookmark"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
