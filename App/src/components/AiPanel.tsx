import React, { useState, useEffect, useRef } from 'react'
import { AiChatMessage } from './AiChatMessage'
import { streamChat, buildSystemPrompt, buildHistoricalContextPrompt, OLLAMA_MODELS, DEFAULT_MODEL } from '../lib/ollamaClient'
import { streamGemini, GeminiBusyError, fetchGeminiOnce, isTrustedUrl, buildFallbackSearchUrl, GEMINI_MODELS, resolveGeminiModel } from '../lib/geminiClient'
import { lookupWorkByTitle } from '../lib/aiWorkLinks'
import { bibleDb } from '../db/sqlite'
import { findCommentaryForCitation, searchCommentaryText, searchVerses } from '../db/queries'
import type { CommentaryEntryWithRef } from '../db/queries'
import { stripUsfm } from '../data/redLetter'
import type { ChatMessage, ChatSession, ResolvedCitation, SelectedVerse } from '../types'

/** Commentary entry by this father on exactly this verse, or null. */
async function fatherOnVerse(father: string, book: string, chapter: number, verse: number) {
  const e = await findCommentaryForCitation(bibleDb, father, book, chapter, verse)
  return e && e.book === book && e.chapter === chapter && e.verse === verse ? e : null
}

/** Cancel a request when the model has sent nothing at all (no thoughts, no text) for this long. */
const STALL_MS = 120_000
const PHASE_LABEL: Record<string, (who: string) => string> = {
  searching: () => 'Searching the library for relevant verses and fathers…',
  starting: () => 'Starting Ollama…',
  waiting: who => `Waiting for ${who} to respond…`,
  thinking: who => `${who} is thinking…`,
  writing: who => `${who} is writing…`,
}
const AI_PANEL_MIN = 200
const AI_PANEL_DEFAULT = 320
const GEMINI_KEY_STORAGE = 'gemini-api-key'
const GEMINI_MODEL_STORAGE = 'gemini-model'
const PROVIDER_STORAGE = 'ai-provider'
const CITATION_MODE_STORAGE = 'citation-mode'

type Provider = 'ollama' | 'gemini'

interface Props {
  height: number
  activeVerse: SelectedVerse
  onHeightChange: (h: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onShowFatherEntry: (entry: CommentaryEntryWithRef) => void
}

export function AiPanel({ height, activeVerse, onHeightChange, onNavigate, onShowFatherEntry }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [aiMode, setAiMode] = useState<'scholar' | 'context'>('scholar')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  // What the model is doing right now — so a long think doesn't look like a hang
  const [phase, setPhase] = useState<'searching' | 'starting' | 'waiting' | 'thinking' | 'writing' | null>(null)
  const [thoughts, setThoughts] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<{ ctrl: AbortController; reason: 'stopped' | 'timeout' | null } | null>(null)
  const [provider, setProvider] = useState<Provider>(() =>
    (localStorage.getItem(PROVIDER_STORAGE) as Provider) ?? 'ollama'
  )
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) ?? '')
  const [geminiModel, setGeminiModel] = useState(() => resolveGeminiModel(localStorage.getItem(GEMINI_MODEL_STORAGE)))
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [resolvedCitations, setResolvedCitations] = useState<Record<string, ResolvedCitation>>({})
  const [alwaysLinkCitations, setAlwaysLinkCitations] = useState(
    () => localStorage.getItem(CITATION_MODE_STORAGE) === 'always-link'
  )
  const processedMsgIds = useRef<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { window.api.getChatSessions().then(setSessions) }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (streaming) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streaming])

  // Resolve external links for citation chips that reference a specific work not in our DB
  useEffect(() => {
    if (streaming) return
    const unprocessed = messages.filter(
      msg => msg.role === 'assistant' && !processedMsgIds.current.has(msg.id)
    )
    if (unprocessed.length === 0) return
    unprocessed.forEach(msg => processedMsgIds.current.add(msg.id))

    const regex = /\[FATHER: ([^\]]+)\]/g
    const toResolve: Array<{ key: string; fatherName: string; workTitle: string; verseRef?: string }> = []
    for (const msg of unprocessed) {
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(msg.content)) !== null) {
        const parts = match[1].split('|').map(s => s.trim())
        const fatherName = parts[0]
        const workTitle = parts[1]
        if (!workTitle) continue
        const key = `${fatherName.toLowerCase()}|${workTitle.toLowerCase()}`
        if (resolvedCitations[key] !== undefined) continue
        toResolve.push({ key, fatherName, workTitle, verseRef: parts[2] })
      }
    }
    if (toResolve.length === 0) return

    ;(async () => {
      const updates: Record<string, ResolvedCitation> = {}
      for (const { key, fatherName, workTitle, verseRef } of toResolve) {
        // 1. Check DB for a verse-specific match
        let hasDbMatch = false
        if (verseRef) {
          const vm = verseRef.match(/^(.+?)\s+(\d+):(\d+)/)
          if (vm) {
            hasDbMatch = !!(await fatherOnVerse(fatherName, vm[1].trim(), parseInt(vm[2]), parseInt(vm[3])).catch(() => null))
          }
        }
        if (hasDbMatch) { updates[key] = { hasDbMatch: true }; continue }

        // 2. Try WORK_TITLE_MAP
        let url = lookupWorkByTitle(fatherName, workTitle)
        let aiSuggested = false

        // 3. Try AI (Gemini only — fast, single-shot)
        if (!url && provider === 'gemini' && geminiKey) {
          try {
            const prompt = `Find the URL for "${workTitle}" by ${fatherName} on newadvent.org/fathers, ccel.org/ccel, or tertullian.org/fathers. Reply with ONLY the URL starting with https://, or exactly "not found". No explanation.`
            const result = await fetchGeminiOnce(prompt, geminiModel, geminiKey)
            if (result && result !== 'not found' && result.startsWith('https://') && isTrustedUrl(result)) {
              url = result
              aiSuggested = true
            }
          } catch { /* fall through */ }
        }

        // 4. Fallback: Google search restricted to trusted sites
        if (!url) {
          url = buildFallbackSearchUrl(fatherName, workTitle)
          aiSuggested = true
        }

        updates[key] = { hasDbMatch: false, url, aiSuggested }
      }
      if (Object.keys(updates).length > 0)
        setResolvedCitations(prev => ({ ...prev, ...updates }))
    })()
  }, [messages, streaming])

  function switchProvider(p: Provider) {
    setProvider(p)
    localStorage.setItem(PROVIDER_STORAGE, p)
  }

  function saveGeminiKey() {
    const key = keyDraft.trim()
    setGeminiKey(key)
    localStorage.setItem(GEMINI_KEY_STORAGE, key)
    setShowKeyInput(false)
    setKeyDraft('')
  }

  function handleGeminiModelChange(id: string) {
    setGeminiModel(id)
    localStorage.setItem(GEMINI_MODEL_STORAGE, id)
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    function onMove(ev: MouseEvent) {
      const delta = startY - ev.clientY
      const maxH = Math.floor(window.innerHeight * 0.65)
      onHeightChange(Math.max(AI_PANEL_MIN, Math.min(startH + delta, maxH)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (!streaming) return
    const start = Date.now()
    setElapsed(0)
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
      const a = abortRef.current
      if (a && Date.now() - lastActivity.current > STALL_MS) { a.reason = 'timeout'; a.ctrl.abort() }
    }, 1000)
    return () => clearInterval(id)
  }, [streaming])
  const lastActivity = useRef(0)

  function stop() {
    const a = abortRef.current
    if (a) { a.reason = 'stopped'; a.ctrl.abort() }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    if (provider === 'gemini' && !geminiKey) {
      setShowKeyInput(true)
      return
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)
    setStreamingContent('')
    setThoughts('')
    setStatusNote('')
    const abort = { ctrl: new AbortController(), reason: null as 'stopped' | 'timeout' | null }
    abortRef.current = abort
    lastActivity.current = Date.now()
    const onThought = (t: string) => { lastActivity.current = Date.now(); setPhase('thinking'); setThoughts(prev => prev + t) }

    let contextLines: string[] = []
    if (aiMode === 'scholar') {
      setPhase('searching')
      try {
        const [verses, commentaryResults] = await Promise.all([
          searchVerses(bibleDb, text, 'KJV', [], 5, true),
          searchCommentaryText(bibleDb, text, 5),
        ])
        if (verses.length > 0) {
          contextLines.push('Relevant scripture from the database:')
          verses.forEach(v => {
            contextLines.push(`${v.book} ${v.chapter}:${v.verse} — ${stripUsfm(v.text)}`)
          })
        }
        if (commentaryResults.length > 0) {
          contextLines.push('Relevant Church Fathers commentary:')
          commentaryResults.slice(0, 3).forEach(c => {
            contextLines.push(`${c.father_name} on ${c.book} ${c.chapter}:${c.verse}: "${c.excerpt}"`)
          })
        }
      } catch { /* proceed without context */ }
    }

    const systemPrompt = aiMode === 'context'
      ? buildHistoricalContextPrompt(activeVerse.book, activeVerse.chapter, activeVerse.verse)
      : buildSystemPrompt(activeVerse.book, activeVerse.chapter)

    const userContent = contextLines.length > 0
      ? `${text}\n\n[Reference context from app database:\n${contextLines.join('\n')}]`
      : text

    let fullContent = ''

    try {
      if (provider === 'gemini') {
        const geminiMessages = [
          ...newMessages.slice(0, -1).map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            content: m.content,
          })),
          { role: 'user' as const, content: userContent },
        ]
        // Chosen model first, then the rest: a busy model (503 / no response) falls through
        const order = [geminiModel, ...GEMINI_MODELS.map(m => m.id).filter(id => id !== geminiModel)]
        const label = (id: string) => GEMINI_MODELS.find(m => m.id === id)?.label ?? id
        for (let i = 0; i < order.length; i++) {
          setPhase('waiting')
          lastActivity.current = Date.now()
          try {
            for await (const chunk of streamGemini(geminiMessages, systemPrompt, order[i], geminiKey, { signal: abort.ctrl.signal, onThought })) {
              lastActivity.current = Date.now()
              setPhase('writing')
              fullContent += chunk
              setStreamingContent(fullContent)
            }
            if (i > 0) fullContent += `\n\n_Answered by ${label(order[i])} — ${label(order[0])} was busy._`
            break
          } catch (e) {
            if (!(e instanceof GeminiBusyError) || fullContent || i === order.length - 1 || abort.reason) throw e
            setStatusNote(`${label(order[i])} is busy (${e.message}) — trying ${label(order[i + 1])}…`)
            setThoughts('')
          }
        }
      } else {
        setPhase('starting')
        const ollamaStatus = await window.api.ensureOllama()
        if (!ollamaStatus.success) throw new Error(ollamaStatus.error ?? 'Could not start Ollama.')
        if (!ollamaStatus.alreadyRunning) await new Promise(r => setTimeout(r, 800))

        const ollamaMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...newMessages.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: userContent },
        ]
        setPhase('waiting')
        lastActivity.current = Date.now()
        for await (const chunk of streamChat(ollamaMessages, selectedModel, { signal: abort.ctrl.signal, onThought })) {
          lastActivity.current = Date.now()
          setPhase('writing')
          fullContent += chunk
          setStreamingContent(fullContent)
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (abort.reason === 'stopped') {
        fullContent = (fullContent ? fullContent + '\n\n' : '') + '_Stopped._'
      } else if (abort.reason === 'timeout') {
        fullContent = (fullContent ? fullContent + '\n\n' : '') +
          `⚠️ No response from ${provider === 'gemini' ? 'Gemini' : 'Ollama'} for ${STALL_MS / 60000} minutes, so the request was cancelled. Try again, or pick a lighter model.`
      } else if (provider === 'gemini') {
        if (msg.includes('API_KEY_INVALID') || msg.includes('400')) {
          fullContent = `⚠️ Invalid Gemini API key. Click **API Key** to update it.`
        } else if (msg.includes('429') || msg.includes('quota')) {
          fullContent = `⚠️ Gemini free-tier rate limit reached. Wait a minute, or switch to another model (each has its own limit — see aistudio.google.com/rate-limit).`
        } else {
          fullContent = `⚠️ Gemini error: ${msg}`
        }
      } else {
        const ollamaInstalled = msg !== '' && !msg.includes('ECONNREFUSED')
        if (!ollamaInstalled) {
          fullContent = `⚠️ Ollama is not installed. Download it from https://ollama.com, then run: \`ollama pull ${selectedModel}\``
        } else if (msg.includes('not found') || msg.includes('404') || msg.includes('pull')) {
          fullContent = `⚠️ Ollama is installed but **${selectedModel}** is not pulled. Run:\n\`ollama pull ${selectedModel}\``
        } else if (msg.includes('20 seconds')) {
          fullContent = `⚠️ Ollama took too long to start. Try opening Ollama manually and sending your message again.`
        } else {
          fullContent = `⚠️ Could not start AI Scholar: ${msg}`
        }
      }
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullContent,
      timestamp: Date.now()
    }
    const finalMessages = [...newMessages, assistantMsg]
    setMessages(finalMessages)
    setStreaming(false)
    setStreamingContent('')
    setPhase(null)
    abortRef.current = null

    const sessionId = activeSessionId ?? crypto.randomUUID()
    const existingSession = sessions.find(s => s.id === sessionId)
    const title = existingSession?.title ?? text.slice(0, 60)
    const session: ChatSession = {
      id: sessionId,
      title,
      createdAt: existingSession?.createdAt ?? Date.now(),
      messages: finalMessages
    }
    await window.api.saveChatSession(session)
    if (!activeSessionId) setActiveSessionId(sessionId)
    setSessions(prev => [session, ...prev.filter(s => s.id !== sessionId)])
  }

  async function handleNavigateFather(fatherName: string, book?: string, chapter?: number, verse?: number) {
    if (book && chapter !== undefined && verse !== undefined) {
      const e = await fatherOnVerse(fatherName, book, chapter, verse)
      if (e) { onShowFatherEntry(e); return }
      // No verse-specific match — don't fall back to an unrelated entry
      return
    }
    // No verse context — navigate to first result for this father
    const e = await findCommentaryForCitation(bibleDb, fatherName)
    if (e) onShowFatherEntry(e)
  }

  async function handleLoadSession(id: string) {
    const session = await window.api.loadChatSession(id)
    if (session) { setMessages(session.messages); setActiveSessionId(id) }
  }

  function handleNewChat() {
    setMessages([])
    setActiveSessionId(null)
    setStreamingContent('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div className="ai-panel" style={{ height }}>
      <div className="ai-resize-handle" onMouseDown={handleResizeMouseDown} />
      <div className="ai-panel-body">

        <div className="ai-chat-area">
          <div className="ai-messages">
            {messages.length === 0 && !streaming && (
              <div className="ai-empty">
                {aiMode === 'context'
                  ? <>Ask about the first-century historical &amp; cultural world.<br /><span className="ai-empty-sub">Roman governance, Jewish customs, geography, social structures.</span></>
                  : <>Ask anything about the Bible or Church Fathers.<br /><span className="ai-empty-sub">Cite specific passages or ask general questions.</span></>
                }
              </div>
            )}
            {messages.map(msg => (
              <AiChatMessage
                key={msg.id}
                message={msg}
                onNavigateVerse={onNavigate}
                onNavigateFather={handleNavigateFather}
                resolvedCitations={resolvedCitations}
                alwaysLinkCitations={alwaysLinkCitations}
              />
            ))}
            {streaming && phase && (
              <div className={`ai-status ai-status--${phase}`}>
                <span className="ai-status-dot" />
                <span className="ai-status-label">{PHASE_LABEL[phase](provider === 'gemini' ? 'Gemini' : 'Ollama')}</span>
                <span className="ai-status-time">{elapsed}s</span>
                {statusNote && <span className="ai-status-note">{statusNote}</span>}
                {thoughts && (
                  <details className="ai-thoughts" open={phase === 'thinking'}>
                    <summary>Thought summary</summary>
                    <div className="ai-thoughts-body">{thoughts}</div>
                  </details>
                )}
              </div>
            )}
            {streaming && streamingContent && (
              <AiChatMessage
                key="streaming"
                message={{ id: 'streaming', role: 'assistant', content: streamingContent, timestamp: Date.now() }}
                streaming
                onNavigateVerse={onNavigate}
                onNavigateFather={handleNavigateFather}
                resolvedCitations={resolvedCitations}
                alwaysLinkCitations={alwaysLinkCitations}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-bar">
            {showKeyInput && (
              <div className="ai-key-row">
                <span className="ai-key-label">Gemini API key:</span>
                <input
                  className="ai-key-input"
                  type="password"
                  value={keyDraft}
                  onChange={e => setKeyDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveGeminiKey()}
                  placeholder="AIza…"
                  autoFocus
                />
                <button className="ai-key-save-btn" onClick={saveGeminiKey}>Save</button>
                <button className="ai-key-cancel-btn" onClick={() => setShowKeyInput(false)}>✕</button>
              </div>
            )}
            <div className="ai-input-row">
              <textarea
                ref={textareaRef}
                className="ai-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
                placeholder={aiMode === 'context' ? 'Ask about the first-century historical context… (Enter to send)' : 'Ask about Scripture or the Church Fathers… (Enter to send, Shift+Enter for newline)'}
                rows={2}
                disabled={streaming}
              />
              {streaming ? (
                <button className="ai-send-btn ai-send-btn--stop" onClick={stop} title="Stop">■</button>
              ) : (
                <button className="ai-send-btn" onClick={handleSend} disabled={!input.trim()} title="Send (Enter)">↑</button>
              )}
            </div>
            <div className="ai-model-bar">
              <div className="ai-provider-toggle">
                <button
                  className={`ai-provider-btn${provider === 'ollama' ? ' ai-provider-btn--active' : ''}`}
                  onClick={() => switchProvider('ollama')}
                  disabled={streaming}
                  title="Local Ollama model — runs on your machine"
                >Ollama</button>
                <button
                  className={`ai-provider-btn${provider === 'gemini' ? ' ai-provider-btn--active' : ''}`}
                  onClick={() => switchProvider('gemini')}
                  disabled={streaming}
                  title="Google Gemini API — no local RAM needed"
                >Gemini</button>
              </div>

              {provider === 'ollama' ? (
                <select
                  className="ai-model-select"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  disabled={streaming}
                >
                  {OLLAMA_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label} · {m.ram} RAM</option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    className="ai-model-select"
                    value={geminiModel}
                    onChange={e => handleGeminiModelChange(e.target.value)}
                    disabled={streaming}
                  >
                    {GEMINI_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label} · {m.note}</option>
                    ))}
                  </select>
                  <button
                    className={`ai-key-btn${!geminiKey ? ' ai-key-btn--missing' : ''}`}
                    onClick={() => { setKeyDraft(geminiKey); setShowKeyInput(v => !v) }}
                    disabled={streaming}
                    title={geminiKey ? 'API key saved — click to change' : 'No API key — click to add'}
                  >
                    {geminiKey ? '🔑 Key set' : '🔑 Add key'}
                  </button>
                </>
              )}

              <div className="ai-mode-toggle">
                <button
                  className={`ai-mode-btn${aiMode === 'scholar' ? ' ai-mode-btn--active' : ''}`}
                  onClick={() => setAiMode('scholar')}
                  disabled={streaming}
                  title="Bible & Church Fathers focus"
                >Scholar</button>
                <button
                  className={`ai-mode-btn${aiMode === 'context' ? ' ai-mode-btn--active' : ''}`}
                  onClick={() => setAiMode('context')}
                  disabled={streaming}
                  title="First-century historical & cultural context"
                >Historical Context</button>
              </div>

              <div className="ai-mode-toggle">
                <button
                  className={`ai-mode-btn${!alwaysLinkCitations ? ' ai-mode-btn--active' : ''}`}
                  onClick={() => { setAlwaysLinkCitations(false); localStorage.setItem(CITATION_MODE_STORAGE, 'navigate') }}
                  title="Click father citations to navigate to matching DB entry"
                >DB Nav</button>
                <button
                  className={`ai-mode-btn${alwaysLinkCitations ? ' ai-mode-btn--active' : ''}`}
                  onClick={() => { setAlwaysLinkCitations(true); localStorage.setItem(CITATION_MODE_STORAGE, 'always-link') }}
                  title="Click father citations to open external source link"
                >Always Link</button>
              </div>
            </div>
          </div>
        </div>

        <div className="ai-sessions-sidebar">
          <div className="ai-sessions-header">
            <span className="ai-sessions-title">Sessions</span>
            <button className="ai-new-chat-btn" onClick={handleNewChat}>+ New</button>
          </div>
          <div className="ai-sessions-list">
            {sessions.map(s => (
              <button
                key={s.id}
                className={`ai-session-item ${s.id === activeSessionId ? 'ai-session-active' : ''}`}
                onClick={() => handleLoadSession(s.id)}
                title={s.title}
              >
                {s.title}
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="ai-sessions-empty">No past sessions</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
