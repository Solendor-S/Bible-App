import React, { useState, useEffect } from 'react'
import { NavigationBar } from './components/NavigationBar'
import { BiblePanel } from './components/BiblePanel'
import { CommentaryPanel } from './components/CommentaryPanel'
import { SearchModal } from './components/SearchModal'
import { AiPanel } from './components/AiPanel'
import { parsePassage } from './lib/parsePassage'
import type { CommentarySearchResult, PassageRef, SelectedVerse } from './types'
import './styles/theme.css'

const DEFAULT_PASSAGES: PassageRef[] = [{ book: 'John', chapter: 1, raw: 'John 1' }]
const DEFAULT_ACTIVE: SelectedVerse = { book: 'John', chapter: 1, verse: 1 }
const AI_PANEL_DEFAULT = 320

export default function App() {
  const [passages, setPassages] = useState<PassageRef[]>(DEFAULT_PASSAGES)
  const [activeVerse, setActiveVerse] = useState<SelectedVerse>(DEFAULT_ACTIVE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiPanelHeight, setAiPanelHeight] = useState(0)
  const [featuredEntry, setFeaturedEntry] = useState<CommentarySearchResult | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string } | null>(null)
  const [rightTab, setRightTab] = useState<'commentary' | 'crossrefs'>('commentary')

  useEffect(() => {
    window.bibleApi.onUpdateAvailable((info) => setUpdateInfo(info))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function handleNavigate(book: string, chapter: number, verse: number) {
    const raw = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
    setPassages(parsePassage(raw))
    setActiveVerse({ book, chapter, verse })
    setSearchOpen(false)
    setFeaturedEntry(null)
  }

  function toggleAiPanel() {
    setAiPanelHeight(h => h > 0 ? 0 : AI_PANEL_DEFAULT)
  }

  return (
    <div className="app">
      {updateInfo && (
        <div className="update-toast">
          <svg className="update-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v10M12 2l-3 3M12 2l3 3"/>
            <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" opacity="0.3"/>
            <path d="M3 12a9 9 0 0 0 9 9" strokeLinecap="round"/>
          </svg>
          <span className="update-toast-text">
            Update available — <strong>v{updateInfo.latest}</strong>
          </span>
          <button
            className="update-toast-btn"
            onClick={() => { window.bibleApi.launchUpdater(); setUpdateInfo(null) }}
          >
            Launch Updater
          </button>
          <button className="update-toast-dismiss" onClick={() => setUpdateInfo(null)} title="Dismiss">
            ×
          </button>
        </div>
      )}
      <NavigationBar
        passages={passages}
        onPassagesChange={p => {
          setPassages(p)
          if (p.length > 0) {
            setActiveVerse({
              book: p[0].book,
              chapter: p[0].chapter,
              verse: p[0].verseStart ?? 1,
            })
          }
        }}
        onSearchOpen={() => setSearchOpen(true)}
        aiOpen={aiPanelHeight > 0}
        onToggleAi={toggleAiPanel}
      />
      <div className="content">
        <BiblePanel
          passages={passages}
          activeVerse={activeVerse}
          onVerseClick={(book, chapter, verse) => { setActiveVerse({ book, chapter, verse }); setFeaturedEntry(null) }}
          onNavigate={handleNavigate}
        />
        <CommentaryPanel
          selected={activeVerse}
          featuredEntry={featuredEntry}
          onClearFeatured={() => setFeaturedEntry(null)}
          onNavigate={handleNavigate}
          rightTab={rightTab}
          onTabChange={setRightTab}
        />
      </div>
      {aiPanelHeight > 0 && (
        <AiPanel
          height={aiPanelHeight}
          activeVerse={activeVerse}
          onHeightChange={setAiPanelHeight}
          onNavigate={handleNavigate}
          onShowFatherEntry={setFeaturedEntry}
        />
      )}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={loc => handleNavigate(loc.book, loc.chapter, loc.verse)}
      />
    </div>
  )
}
