import React, { useEffect, useRef, useState } from 'react'
import type { NavesTopic, NavesRef, SelectedVerse } from '../types'

interface Props {
  selected: SelectedVerse
  onNavigate?: (book: string, chapter: number, verse: number) => void
}

export function TopicsPanel({ selected, onNavigate }: Props) {
  const [verseTopics, setVerseTopics] = useState<NavesTopic[]>([])
  const [loadingVerse, setLoadingVerse] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NavesTopic[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [refs, setRefs] = useState<NavesRef[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load topics for the selected verse
  useEffect(() => {
    if (!selected?.verse) { setVerseTopics([]); return }
    setLoadingVerse(true)
    setExpandedId(null)
    window.navesApi.getForVerse(selected.book, selected.chapter, selected.verse)
      .then(t => { setVerseTopics(t); setLoadingVerse(false) })
      .catch(() => setLoadingVerse(false))
  }, [selected?.book, selected?.chapter, selected?.verse])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      window.navesApi.search(q)
        .then(r => { setSearchResults(r); setSearching(false) })
        .catch(() => setSearching(false))
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery])

  // Load refs when a topic is expanded
  useEffect(() => {
    if (expandedId === null) { setRefs([]); return }
    setLoadingRefs(true)
    window.navesApi.getTopicRefs(expandedId)
      .then(r => { setRefs(r); setLoadingRefs(false) })
      .catch(() => setLoadingRefs(false))
  }, [expandedId])

  function toggleTopic(id: number) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const isSearching = searchQuery.trim().length > 0
  const displayTopics = isSearching ? searchResults : verseTopics

  return (
    <div className="topics-panel">
      <div className="topics-search-row">
        <input
          className="commentary-father-search"
          placeholder="Search topics…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          spellCheck={false}
        />
        {searchQuery && (
          <button className="topics-search-clear" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {!isSearching && !selected?.verse && (
        <div className="panel-empty">Select a verse to see related topics.</div>
      )}

      {!isSearching && selected?.verse && loadingVerse && (
        <div className="panel-loading">Loading…</div>
      )}

      {!isSearching && selected?.verse && !loadingVerse && verseTopics.length === 0 && (
        <div className="panel-empty">No topics found for this verse.</div>
      )}

      {isSearching && searching && (
        <div className="panel-loading">Searching…</div>
      )}

      {isSearching && !searching && searchResults.length === 0 && (
        <div className="panel-empty">No topics found for "{searchQuery}".</div>
      )}

      {!isSearching && !loadingVerse && verseTopics.length > 0 && (
        <div className="topics-verse-label">
          {verseTopics.length} topic{verseTopics.length !== 1 ? 's' : ''} for{' '}
          {selected.book} {selected.chapter}:{selected.verse}
        </div>
      )}

      <div className="topics-list">
        {displayTopics.map(topic => (
          <TopicRow
            key={topic.id}
            topic={topic}
            expanded={expandedId === topic.id}
            refs={expandedId === topic.id ? refs : []}
            loadingRefs={expandedId === topic.id && loadingRefs}
            onToggle={() => toggleTopic(topic.id)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

interface TopicRowProps {
  topic: NavesTopic
  expanded: boolean
  refs: NavesRef[]
  loadingRefs: boolean
  onToggle: () => void
  onNavigate?: (book: string, chapter: number, verse: number) => void
}

function TopicRow({ topic, expanded, refs, loadingRefs, onToggle, onNavigate }: TopicRowProps) {
  return (
    <div className={`topic-row${expanded ? ' topic-row--open' : ''}`}>
      <button className="topic-header" onClick={onToggle}>
        <span className="topic-name">{topic.name}</span>
        <span className="topic-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="topic-refs">
          {loadingRefs && <div className="panel-loading">Loading…</div>}
          {!loadingRefs && refs.length === 0 && (
            <div className="panel-empty">No verses found.</div>
          )}
          {!loadingRefs && refs.map((r, i) => (
            <button
              key={i}
              className="topic-ref-item"
              onClick={() => r.text && onNavigate?.(r.book, r.chapter, r.verse)}
              disabled={!r.text}
            >
              <span className="crossref-location">{r.book} {r.chapter}:{r.verse}</span>
              {r.text
                ? <span className="crossref-verse-text">{r.text}</span>
                : <span className="crossref-verse-text topics-ref-missing">—</span>
              }
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
