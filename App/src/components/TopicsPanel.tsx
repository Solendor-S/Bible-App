import React, { useEffect, useRef, useState } from 'react'
import type { NavesTopic, NavesRef, SelectedVerse } from '../types'
import { streamChat } from '../lib/ollamaClient'


interface Props {
  selected: SelectedVerse
  onNavigate?: (book: string, chapter: number, verse: number) => void
  translation?: string
}

export function TopicsPanel({ selected, onNavigate, translation = 'KJV' }: Props) {
  const [verseTopics, setVerseTopics] = useState<NavesTopic[]>([])
  const [loadingVerse, setLoadingVerse] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NavesTopic[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [refs, setRefs] = useState<NavesRef[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!selected?.verse) { setVerseTopics([]); return }
    setLoadingVerse(true)
    setExpandedId(null)
    window.navesApi.getForVerse(selected.book, selected.chapter, selected.verse)
      .then(t => { setVerseTopics(t); setLoadingVerse(false) })
      .catch(() => setLoadingVerse(false))
  }, [selected?.book, selected?.chapter, selected?.verse])

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

  useEffect(() => {
    if (expandedId === null) { setRefs([]); return }
    setLoadingRefs(true)
    window.navesApi.getTopicRefs(expandedId, translation)
      .then(r => { setRefs(r); setLoadingRefs(false) })
      .catch(() => setLoadingRefs(false))
  }, [expandedId, translation])

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

const STEP = 5

interface TopicRowProps {
  topic: NavesTopic
  expanded: boolean
  refs: NavesRef[]
  loadingRefs: boolean
  onToggle: () => void
  onNavigate?: (book: string, chapter: number, verse: number) => void
}

const AI_RANK_LIMIT = 30

function TopicRow({ topic, expanded, refs, loadingRefs, onToggle, onNavigate }: TopicRowProps) {
  const [visibleCount, setVisibleCount] = useState(STEP)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null)
  const [summarising, setSummarising] = useState(false)
  const [displayRefs, setDisplayRefs] = useState<NavesRef[]>([])
  const [ranking, setRanking] = useState(false)
  const [ranked, setRanked] = useState(false)

  useEffect(() => {
    setDisplayRefs(refs)
    setRanked(false)
  }, [refs])

  useEffect(() => {
    if (!expanded) {
      setVisibleCount(STEP)
      setSummary(null)
      setSummaryStatus(null)
      setSummarising(false)
      setRanked(false)
      setRanking(false)
    }
  }, [expanded])

  async function handleSummarise() {
    setSummarising(true)
    setSummary(null)
    setSummaryStatus('Starting Ollama…')
    let ollamaInstalled = false
    try {
      const ollamaStatus = await window.bibleApi.ensureOllama()
      if (!ollamaStatus.success) throw new Error(ollamaStatus.error ?? 'Could not start Ollama.')
      ollamaInstalled = true
      if (!ollamaStatus.alreadyRunning) {
        await new Promise(r => setTimeout(r, 800))
      }
      setSummaryStatus(null)

      const refTexts = refs
        .filter(r => r.text)
        .slice(0, 20)
        .map(r => `${r.book} ${r.chapter}:${r.verse} — ${r.text}`)
        .join('\n')
      const messages = [
        { role: 'system' as const, content: 'You are a concise biblical study assistant.' },
        { role: 'user' as const, content: `In 1-2 sentences, summarise what Scripture teaches about "${topic.name}" based on these verses:\n\n${refTexts}` },
      ]
      let text = ''
      for await (const chunk of streamChat(messages)) {
        text += chunk
        setSummary(text)
      }
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (!ollamaInstalled) {
        setSummary('⚠️ Ollama is not installed. Download it from https://ollama.com')
      } else if (msg.includes('not found') || msg.includes('404') || msg.includes('pull')) {
        setSummary('⚠️ Model not found. Run: ollama pull gemma4')
      } else if (msg.includes('20 seconds')) {
        setSummary('⚠️ Ollama took too long to start. Open Ollama manually and try again.')
      } else {
        setSummary(`⚠️ Could not start Ollama: ${msg}`)
      }
    } finally {
      setSummarising(false)
      setSummaryStatus(null)
    }
  }

  async function handleRank() {
    setRanking(true)
    let ollamaInstalled = false
    try {
      const ollamaStatus = await window.bibleApi.ensureOllama()
      if (!ollamaStatus.success) throw new Error(ollamaStatus.error ?? 'Could not start Ollama.')
      ollamaInstalled = true
      if (!ollamaStatus.alreadyRunning) await new Promise(r => setTimeout(r, 800))

      const pool = refs.filter(r => r.text).slice(0, AI_RANK_LIMIT)
      const numbered = pool.map((r, i) => `${i}. ${r.book} ${r.chapter}:${r.verse} — ${r.text}`).join('\n')
      const messages = [
        { role: 'system' as const, content: 'You are a biblical scholar. Return only valid JSON — no markdown, no explanation.' },
        { role: 'user' as const, content: `Rank these verses from most to least directly relevant to the topic "${topic.name}".\nReturn a JSON array of their indices (0-based), e.g. [3,0,2,1].\n\n${numbered}` },
      ]

      let raw = ''
      for await (const chunk of streamChat(messages)) raw += chunk

      // Extract first JSON array from response
      const match = raw.match(/\[[\d,\s]+\]/)
      if (!match) throw new Error('No valid JSON array in response')
      const indices: number[] = JSON.parse(match[0])

      // Reorder pool by AI ranking, append any unranked refs after
      const ranked: NavesRef[] = []
      const seen = new Set<number>()
      for (const idx of indices) {
        if (idx >= 0 && idx < pool.length && !seen.has(idx)) {
          ranked.push(pool[idx])
          seen.add(idx)
        }
      }
      // Add any pool refs the model missed
      pool.forEach((r, i) => { if (!seen.has(i)) ranked.push(r) })
      // Append refs beyond the pool that have no text, then those with text not in pool
      const beyond = refs.slice(AI_RANK_LIMIT)
      setDisplayRefs([...ranked, ...beyond])
      setRanked(true)
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (!ollamaInstalled) {
        setSummary('⚠️ Ollama is not installed. Download it from https://ollama.com')
      } else if (msg.includes('not found') || msg.includes('404') || msg.includes('pull')) {
        setSummary('⚠️ Model not found. Run: ollama pull gemma4')
      } else {
        setSummary('⚠️ Could not rank verses — try again.')
      }
    } finally {
      setRanking(false)
    }
  }

  const showAll = visibleCount >= displayRefs.length
  const visibleRefs = displayRefs.slice(0, visibleCount)

  return (
    <div className={`topic-row${expanded ? ' topic-row--open' : ''}`}>
      <button className="topic-header" onClick={onToggle}>
        <span className="topic-name">{topic.name}</span>
        <span className="topic-ref-count">{topic.refCount}</span>
        <span className="topic-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="topic-refs">
          {loadingRefs && <div className="panel-loading">Loading…</div>}

          {!loadingRefs && displayRefs.length === 0 && (
            <div className="panel-empty">No verses found.</div>
          )}

          {!loadingRefs && visibleRefs.map((r, i) => (
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

          {!loadingRefs && !showAll && (
            <div className="topics-pagination">
              <button className="topics-show-more" onClick={() => setVisibleCount(c => c + STEP)}>
                Show more
              </button>
              <button className="topics-show-all" onClick={() => setVisibleCount(refs.length)}>
                Show all {refs.length}
              </button>
            </div>
          )}

          {!loadingRefs && !ranking && displayRefs.length > 0 && (
            <div className="topics-ai-row">
              {!summarising && !summary && (
                <button className="topics-ai-btn" onClick={handleSummarise}>✦ Summarise</button>
              )}
              {!ranked && (
                <button className="topics-ai-btn" onClick={handleRank}>⟳ Rank</button>
              )}
            </div>
          )}

          {ranking && <div className="panel-loading">Ranking verses…</div>}

          {ranked && (
            <div className="topics-rank-disclaimer">
              AI-ranked · top {Math.min(AI_RANK_LIMIT, refs.filter(r => r.text).length)} verses only · may improve in future updates
            </div>
          )}

          {summarising && (
            <div className="panel-loading">{summaryStatus ?? 'Summarising…'}</div>
          )}

          {summary && (
            <div className="topics-summary">{summary}</div>
          )}
        </div>
      )}
    </div>
  )
}
