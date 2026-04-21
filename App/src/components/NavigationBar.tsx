import React, { useState, useEffect } from 'react'
import { parsePassage, passagesToString } from '../lib/parsePassage'
import type { PassageRef } from '../types'

interface Props {
  passages: PassageRef[]
  onPassagesChange: (passages: PassageRef[]) => void
  onSearchOpen: () => void
  onChangelogOpen: () => void
  aiOpen: boolean
  onToggleAi: () => void
}

export function NavigationBar({ passages, onPassagesChange, onSearchOpen, onChangelogOpen, aiOpen, onToggleAi }: Props) {
  const [inputValue, setInputValue] = useState(passagesToString(passages))

  useEffect(() => {
    setInputValue(passagesToString(passages))
  }, [passages])

  function submit() {
    const parsed = parsePassage(inputValue)
    if (parsed.length > 0) onPassagesChange(parsed)
  }

  return (
    <div className="nav-bar">
      <div className="nav-passage-input">
        <input
          className="nav-passage-field"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="e.g. John 3:16; Romans 8:28"
          spellCheck={false}
        />
        <button className="nav-go-btn" onClick={submit}>Go</button>
      </div>

      <div className="nav-title">Bible Study</div>

      <div className="nav-actions">
        <button
          className={`nav-ai-btn ${aiOpen ? 'nav-ai-btn-active' : ''}`}
          onClick={onToggleAi}
          title="AI Scholar (Bible & Church Fathers)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 21h6M10 17v1M14 17v1" />
          </svg>
          Scholar
        </button>
        <button className="nav-changelog-btn" onClick={onChangelogOpen} title="Changelog">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Changelog
        </button>
        <button className="nav-search-btn" onClick={onSearchOpen} title="Search (Ctrl+F)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>
    </div>
  )
}
