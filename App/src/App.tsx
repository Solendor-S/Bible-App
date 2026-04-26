import React, { useState, useEffect } from 'react'
import { NavigationBar } from './components/NavigationBar'
import { BiblePanel } from './components/BiblePanel'
import { CommentaryPanel } from './components/CommentaryPanel'
import type { RightTab } from './components/CommentaryPanel'
import { SearchModal } from './components/SearchModal'
import { ConcordanceModal } from './components/ConcordanceModal'
import { ParallelModal } from './components/ParallelModal'
import { ChangelogModal } from './components/ChangelogModal'
import { AiPanel } from './components/AiPanel'
import { AddNoteModal } from './components/AddNoteModal'
import type { NoteTarget } from './components/AddNoteModal'
import { ApocryphaPanel } from './components/ApocryphaPanel'
import { parsePassage } from './lib/parsePassage'
import type { WordHighlight } from './components/WordStudyPanel'
import type { Bookmark, CommentarySearchResult, PassageRef, SelectedVerse } from './types'
import './styles/theme.css'

const DEFAULT_PASSAGES: PassageRef[] = [{ book: 'John', chapter: 1, raw: 'John 1' }]
const DEFAULT_ACTIVE: SelectedVerse = { book: 'John', chapter: 1, verse: 1 }
const AI_PANEL_DEFAULT = 320

type NavEntry = { book: string; chapter: number; verse: number }

export default function App() {
  const [passages, setPassages] = useState<PassageRef[]>(DEFAULT_PASSAGES)
  const [activeVerse, setActiveVerse] = useState<SelectedVerse>(DEFAULT_ACTIVE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiPanelHeight, setAiPanelHeight] = useState(0)
  const [featuredEntry, setFeaturedEntry] = useState<CommentarySearchResult | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string } | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('commentary')
  const [wordHighlight, setWordHighlight] = useState<WordHighlight | null>(null)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null)
  const [notesRefreshToken, setNotesRefreshToken] = useState(0)
  const [leftTab, setLeftTab] = useState<'canon' | 'apocrypha'>('canon')
  const [concordanceWord, setConcordanceWord] = useState<string | null>(null)
  const [redLetterOn, setRedLetterOn] = useState(true)
  const [parallelVerse, setParallelVerse] = useState<SelectedVerse | null>(null)
  const [navHistory, setNavHistory] = useState<NavEntry[]>([DEFAULT_ACTIVE])
  const [navIdx, setNavIdx] = useState(0)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const bookmarkedKeys = new Set(bookmarks.map(b => `${b.book}|${b.chapter}|${b.verse}`))
  const [primaryTrans, setPrimaryTrans] = useState('KJV')
  const [compareTrans, setCompareTrans] = useState<string | null>(null)
  const [availableTranslations, setAvailableTranslations] = useState<string[]>(['KJV'])

  useEffect(() => {
    window.bookmarksApi.getAll().then(setBookmarks)
    window.translationsApi.getList().then(list => {
      if (list.length > 0) setAvailableTranslations(['KJV', ...list])
    })
  }, [])

  async function handleBookmarkToggle(book: string, chapter: number, verse: number, text: string) {
    const key = `${book}|${chapter}|${verse}`
    if (bookmarkedKeys.has(key)) {
      await window.bookmarksApi.remove(book, chapter, verse)
      setBookmarks(bs => bs.filter(b => !(b.book === book && b.chapter === chapter && b.verse === verse)))
    } else {
      const bm: Bookmark = {
        id: `${book}|${chapter}|${verse}`,
        book, chapter, verse,
        verseText: text,
        createdAt: Date.now(),
      }
      await window.bookmarksApi.add(bm)
      setBookmarks(bs => [bm, ...bs])
    }
  }

  async function handleBookmarkRemove(book: string, chapter: number, verse: number) {
    await window.bookmarksApi.remove(book, chapter, verse)
    setBookmarks(bs => bs.filter(b => !(b.book === book && b.chapter === chapter && b.verse === verse)))
  }

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack() }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navIdx, navHistory])

  function applyLocation(book: string, chapter: number, verse: number) {
    setPassages(parsePassage(`${book} ${chapter}`))
    setActiveVerse({ book, chapter, verse })
    setSearchOpen(false)
    setFeaturedEntry(null)
    setWordHighlight(null)
  }

  function handleNavigate(book: string, chapter: number, verse: number) {
    applyLocation(book, chapter, verse)
    setNavHistory(h => [...h.slice(0, navIdx + 1), { book, chapter, verse }])
    setNavIdx(i => i + 1)
  }

  function goBack() {
    if (navIdx <= 0) return
    const entry = navHistory[navIdx - 1]
    setNavIdx(i => i - 1)
    applyLocation(entry.book, entry.chapter, entry.verse)
  }

  function goForward() {
    if (navIdx >= navHistory.length - 1) return
    const entry = navHistory[navIdx + 1]
    setNavIdx(i => i + 1)
    applyLocation(entry.book, entry.chapter, entry.verse)
  }

  function handleViewParallels(book: string, chapter: number, verse: number) {
    setParallelVerse({ book, chapter, verse })
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
        canBack={navIdx > 0}
        canForward={navIdx < navHistory.length - 1}
        onBack={goBack}
        onForward={goForward}
        onPassagesChange={p => {
          setPassages(p)
          if (p.length > 0) {
            const book = p[0].book
            const chapter = p[0].chapter
            const verse = p[0].verseStart ?? 1
            setActiveVerse({ book, chapter, verse })
            setNavHistory(h => [...h.slice(0, navIdx + 1), { book, chapter, verse }])
            setNavIdx(i => i + 1)
          }
        }}
        onSearchOpen={() => setSearchOpen(true)}
        onChangelogOpen={() => setChangelogOpen(true)}
        aiOpen={aiPanelHeight > 0}
        onToggleAi={toggleAiPanel}
      />
      <div className="content">
        <div className="left-panel-wrap">
          <div className="canon-tab-bar">
            <button
              className={`canon-tab-btn${leftTab === 'canon' ? ' canon-tab-btn--active' : ''}`}
              onClick={() => setLeftTab('canon')}
            >
              Canon
            </button>
            <button
              className={`canon-tab-btn${leftTab === 'apocrypha' ? ' canon-tab-btn--active' : ''}`}
              onClick={() => setLeftTab('apocrypha')}
            >
              Apocrypha
            </button>
          </div>
          {leftTab === 'canon' ? (
            <BiblePanel
              passages={passages}
              activeVerse={activeVerse}
              wordHighlight={wordHighlight}
              redLetterOn={redLetterOn}
              onRedLetterToggle={() => setRedLetterOn(v => !v)}
              bookmarkedKeys={bookmarkedKeys}
              primaryTrans={primaryTrans}
              compareTrans={compareTrans}
              availableTranslations={availableTranslations}
              onPrimaryTransChange={setPrimaryTrans}
              onCompareTransChange={setCompareTrans}
              onVerseClick={(book, chapter, verse) => { setActiveVerse({ book, chapter, verse }); setFeaturedEntry(null); setWordHighlight(null) }}
              onNavigate={handleNavigate}
              onAddNote={(book, chapter, verse, text) => setNoteTarget({ book, chapter, verse, text })}
              onWordClick={word => setConcordanceWord(word)}
              onViewParallels={handleViewParallels}
              onBookmarkToggle={handleBookmarkToggle}
            />
          ) : (
            <ApocryphaPanel />
          )}
        </div>
        <CommentaryPanel
          selected={activeVerse}
          featuredEntry={featuredEntry}
          onClearFeatured={() => setFeaturedEntry(null)}
          onNavigate={handleNavigate}
          rightTab={rightTab}
          onTabChange={setRightTab}
          onWordSelect={setWordHighlight}
          notesRefreshToken={notesRefreshToken}
          bookmarks={bookmarks}
          onBookmarkRemove={handleBookmarkRemove}
          translation={primaryTrans}
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
        translation={primaryTrans}
      />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      {concordanceWord && (
        <ConcordanceModal
          word={concordanceWord}
          onClose={() => setConcordanceWord(null)}
          onNavigate={loc => handleNavigate(loc.book, loc.chapter, loc.verse)}
          translation={primaryTrans}
        />
      )}
      {parallelVerse && (
        <ParallelModal
          verse={parallelVerse}
          onClose={() => setParallelVerse(null)}
          onNavigate={loc => handleNavigate(loc.book, loc.chapter, loc.verse)}
          onAdd={(book, chapter, verse) => {
            const start = Math.max(1, verse - 2)
            const end = verse + 4
            setPassages(p => [...p, { book, chapter, verseStart: start, verseEnd: end, raw: `${book} ${chapter}:${verse}` }])
          }}
        />
      )}
      {noteTarget && (
        <AddNoteModal
          target={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSaved={() => { setNotesRefreshToken(t => t + 1); setRightTab('notes') }}
        />
      )}
    </div>
  )
}
