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
