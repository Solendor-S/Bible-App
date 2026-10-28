import { useCallback, useEffect, useRef, useState } from 'react'
import { NavigationBar } from './components/NavigationBar'
import { BiblePanel } from './components/BiblePanel'
import { CommentaryPanel } from './components/CommentaryPanel'
import type { RightTab } from './components/CommentaryPanel'
import type { LibraryTab } from './components/LibraryPanel'
import { SearchModal } from './components/SearchModal'
import { ConcordanceModal } from './components/ConcordanceModal'
import { ParallelModal } from './components/ParallelModal'
import { ChangelogModal } from './components/ChangelogModal'
import { SettingsModal } from './components/SettingsModal'
import { TutorialModal } from './components/TutorialModal'
import { ScripturePreviewModal } from './components/ScripturePreviewModal'
import type { PreviewTarget } from './components/ScripturePreviewModal'
import { AiPanel } from './components/AiPanel'
import { AddNoteModal } from './components/AddNoteModal'
import type { NoteTarget } from './components/AddNoteModal'
import { parsePassage } from './lib/parsePassage'
import type { WordHighlight } from './lib/wordHighlight'
import { userDb } from './db/sqlite'
import { getBookmarks } from './db/queries'
import type { CommentaryEntryWithRef } from './db/queries'
import { usePref, usePrefs } from './context/Prefs'
import { isValidTranslation, sqlTranslation } from './data/translations'
import type { PassageRef, SelectedVerse } from './types'
import './styles/theme.css'
import './styles/study.css'

const AI_PANEL_DEFAULT = 320
const LINE_HEIGHT = { compact: 1.45, normal: 1.65, relaxed: 1.9, spacious: 2.25 }
const FONT_STACK = {
  serif: "Georgia, 'Times New Roman', serif",
  default: "'Segoe UI', system-ui, sans-serif",
  sans: "'Segoe UI', system-ui, sans-serif",
  light: "'Segoe UI Light', 'Segoe UI', system-ui, sans-serif",
  condensed: "'Arial Narrow', 'Roboto Condensed', sans-serif-condensed, sans-serif",
  mono: "Consolas, 'Courier New', monospace",
}
const TITLEBAR = { dark: ['#1e1e1e', '#9ca3af'], light: ['#ede8de', '#5a5040'], highContrast: ['#0a0a0a', '#dddddd'] } as const

type NavEntry = SelectedVerse

function initialPassages(startupMode: string, last: string): PassageRef[] {
  const parsed = startupMode === 'resume' && last ? parsePassage(last) : []
  return parsed.length ? parsed : parsePassage('John 1')
}

export default function App() {
  const { prefs, set } = usePrefs()
  const [passages, setPassages] = useState<PassageRef[]>(() => initialPassages(prefs.startup_mode, prefs.last_passage))
  const [activeVerse, setActiveVerse] = useState<SelectedVerse>(() => ({ book: passages[0].book, chapter: passages[0].chapter, verse: passages[0].verseStart ?? 1 }))
  const [navHistory, setNavHistory] = useState<NavEntry[]>([activeVerse])
  const [navIdx, setNavIdx] = useState(0)
  const navRef = useRef({ idx: 0, history: navHistory })
  navRef.current = { idx: navIdx, history: navHistory }

  const [rightTab, setRightTab] = useState<RightTab>('fathers')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('plans')
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [changelog, setChangelog] = useState<{ only?: string } | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(!prefs.onboarding_done)
  const [aiPanelHeight, setAiPanelHeight] = useState(0)
  const [featuredEntry, setFeaturedEntry] = useState<CommentaryEntryWithRef | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string } | null>(null)
  const [wordHighlight, setWordHighlight] = useState<WordHighlight | null>(null)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null)
  const [concordanceWord, setConcordanceWord] = useState<string | null>(null)
  const [jumpToStrongs, setJumpToStrongs] = useState<string | null>(null)
  const [parallelVerse, setParallelVerse] = useState<SelectedVerse | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [browseFather, setBrowseFather] = useState<string | null>(null)
  const [userVersion, setUserVersion] = useState(0)
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string>>(new Set())
  const [theme] = usePref('theme')
  const [fontSize] = usePref('font_size')
  const [lineSpacing] = usePref('line_spacing')
  const [fontFamily] = usePref('font_family')
  const [fontScope] = usePref('font_scope')
  const [translation] = usePref('last_used_translation')

  const bumpUser = useCallback(() => setUserVersion(v => v + 1), [])

  // Startup translation (Android: "Same as left off" or a fixed one)
  useEffect(() => {
    if (prefs.startup_translation !== 'last' && isValidTranslation(prefs.startup_translation)) set('last_used_translation', prefs.startup_translation)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // What's New: once per installed version, after the first-run tour has been seen
  useEffect(() => {
    window.api.getVersion().then(v => {
      if (!prefs.onboarding_done) { set('whats_new_seen', v); return }
      if (prefs.whats_new_seen !== v) { set('whats_new_seen', v); setChangelog({ only: v }) }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getBookmarks(userDb).then(bs => setBookmarkedKeys(new Set(bs.map(b => `${b.book}|${b.chapter}|${b.verse}`))))
  }, [userVersion])

  useEffect(() => { set('last_passage', passages.map(p => p.raw).filter(Boolean).join('; ')) }, [passages, set])

  // Theme + reading typography
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const [bg, fg] = TITLEBAR[theme] ?? TITLEBAR.dark
    window.api.setTitleBarColors(bg, fg)
  }, [theme])
  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--verse-font-size', `${fontSize}px`)
    s.setProperty('--verse-line-height', String(LINE_HEIGHT[lineSpacing] ?? 1.65))
    s.setProperty('--font-reader', FONT_STACK[fontFamily] ?? FONT_STACK.serif)
    document.body.classList.toggle('font-scope-all', fontScope === 'all')
  }, [fontSize, lineSpacing, fontFamily, fontScope])

  useEffect(() => { window.api.onUpdateAvailable(setUpdateInfo) }, [])

  function applyLocation(book: string, chapter: number, verse: number) {
    setPassages(parsePassage(`${book} ${chapter}`))
    setActiveVerse({ book, chapter, verse })
    setFeaturedEntry(null)
    setWordHighlight(null)
  }

  const handleNavigate = useCallback((book: string, chapter: number, verse: number) => {
    applyLocation(book, chapter, verse)
    const { idx, history } = navRef.current
    setNavHistory([...history.slice(0, idx + 1), { book, chapter, verse }])
    setNavIdx(idx + 1)
  }, [])

  const goHistory = useCallback((delta: number) => {
    const { idx, history } = navRef.current
    const entry = history[idx + delta]
    if (!entry) return
    setNavIdx(idx + delta)
    applyLocation(entry.book, entry.chapter, entry.verse)
  }, [])

  function handleNavigatePassages(p: PassageRef[]) {
    setPassages(p)
    const { book, chapter } = p[0]
    const verse = p[0].verseStart ?? 1
    setActiveVerse({ book, chapter, verse })
    setFeaturedEntry(null)
    setWordHighlight(null)
    const { idx, history } = navRef.current
    setNavHistory([...history.slice(0, idx + 1), { book, chapter, verse }])
    setNavIdx(idx + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setSearchOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goHistory(-1) }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goHistory(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goHistory])

  const selectVerse = useCallback((book: string, chapter: number, verse: number) => {
    setActiveVerse({ book, chapter, verse }); setFeaturedEntry(null); setWordHighlight(null)
  }, [])

  const addContext = useCallback((book: string, chapter: number, verse: number) => {
    setPassages(p => [...p, { book, chapter, verseStart: Math.max(1, verse - 2), verseEnd: verse + 4, raw: `${book} ${chapter}:${verse}` }])
  }, [])

  const openWordStudy = useCallback((strongs: string) => { setRightTab('words'); setJumpToStrongs(strongs) }, [])
  const showEntry = useCallback((e: CommentaryEntryWithRef) => { setFeaturedEntry(e); setRightTab('fathers') }, [])
  const finishTour = () => { set('onboarding_done', true); setTutorialOpen(false) }

  return (
    <div className="app">
      {updateInfo && (
        <div className="update-toast">
          <span className="update-toast-text">Update ready — <strong>v{updateInfo.latest}</strong></span>
          <button className="update-toast-btn" onClick={() => window.api.launchUpdater()}>Restart &amp; Update</button>
          <button className="update-toast-dismiss" onClick={() => setUpdateInfo(null)} title="Dismiss">×</button>
        </div>
      )}
      <NavigationBar
        passages={passages}
        canBack={navIdx > 0}
        canForward={navIdx < navHistory.length - 1}
        onBack={() => goHistory(-1)}
        onForward={() => goHistory(1)}
        onPassagesChange={handleNavigatePassages}
        onSearchOpen={() => setSearchOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onHelpOpen={() => setTutorialOpen(true)}
        aiOpen={aiPanelHeight > 0}
        onToggleAi={() => setAiPanelHeight(h => h > 0 ? 0 : AI_PANEL_DEFAULT)}
      />
      <div className="content">
        <BiblePanel
          passages={passages}
          activeVerse={activeVerse}
          wordHighlight={wordHighlight}
          bookmarkedKeys={bookmarkedKeys}
          userVersion={userVersion}
          onUserChange={bumpUser}
          onVerseClick={selectVerse}
          onNavigate={handleNavigate}
          onAddNote={(book, chapter, verse) => setNoteTarget({ book, chapter, verse })}
          onWordClick={w => { const word = w.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, ''); if (word) setConcordanceWord(word) }}
          onViewParallels={(book, chapter, verse) => setParallelVerse({ book, chapter, verse })}
          onStrongsView={openWordStudy}
          onBookmarksChanged={bumpUser}
        />
        <CommentaryPanel
          selected={activeVerse}
          rightTab={rightTab}
          onTabChange={setRightTab}
          onNavigate={handleNavigate}
          onSelectVerse={selectVerse}
          onPreview={(book, chapter, verse) => setPreview({ book, chapter, verse })}
          featuredEntry={featuredEntry}
          onClearFeatured={() => setFeaturedEntry(null)}
          onWordSelect={setWordHighlight}
          jumpToStrongs={jumpToStrongs}
          onJumpHandled={() => setJumpToStrongs(null)}
          libraryTab={libraryTab}
          onLibraryTab={setLibraryTab}
          userVersion={userVersion}
          onUserChange={bumpUser}
          onEditNote={(book, chapter, verse) => setNoteTarget({ book, chapter, verse })}
          browseFather={browseFather}
          onBrowseFather={setBrowseFather}
        />
      </div>
      {aiPanelHeight > 0 && (
        <AiPanel height={aiPanelHeight} activeVerse={activeVerse} onHeightChange={setAiPanelHeight} onNavigate={handleNavigate} onShowFatherEntry={showEntry} />
      )}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={handleNavigate}
        onOpenWordStudy={openWordStudy} onShowEntry={showEntry} initialTranslation={sqlTranslation(translation)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenChangelog={() => { setSettingsOpen(false); setChangelog({}) }} />
      <ChangelogModal open={!!changelog} onlyVersion={changelog?.only} onClose={() => setChangelog(null)} />
      <TutorialModal open={tutorialOpen} onFinish={finishTour} onDecline={finishTour} />
      <ScripturePreviewModal target={preview} onClose={() => setPreview(null)} onNavigate={handleNavigate} />
      {concordanceWord && (
        <ConcordanceModal word={concordanceWord} onClose={() => setConcordanceWord(null)} onNavigate={loc => handleNavigate(loc.book, loc.chapter, loc.verse)} />
      )}
      {parallelVerse && (
        <ParallelModal verse={parallelVerse} onClose={() => setParallelVerse(null)} onNavigate={loc => handleNavigate(loc.book, loc.chapter, loc.verse)} onAdd={addContext} />
      )}
      {noteTarget && (
        <AddNoteModal target={noteTarget} onClose={() => setNoteTarget(null)} onSaved={() => { bumpUser(); setLibraryTab('notes') }} />
      )}
    </div>
  )
}
