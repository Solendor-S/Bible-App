import React, { useState, useEffect, useRef } from 'react'
import { AiChatMessage } from './AiChatMessage'
import { streamChat, buildSystemPrompt, OLLAMA_MODELS, DEFAULT_MODEL } from '../lib/ollamaClient'
import type { ChatMessage, ChatSession, CommentarySearchResult, SelectedVerse } from '../types'

const AI_PANEL_MIN = 200
const AI_PANEL_DEFAULT = 320

interface Props {
  height: number
  activeVerse: SelectedVerse
  onHeightChange: (h: number) => void
  onNavigate: (book: string, chapter: number, verse: number) => void
  onShowFatherEntry: (entry: CommentarySearchResult) => void
}

export function AiPanel({ height, activeVerse, onHeightChange, onNavigate, onShowFatherEntry }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.chatApi.getSessions().then(setSessions)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

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

    // Fetch relevant DB context in parallel
    let contextLines: string[] = []
    try {
      const [searchResult, commentaryResults] = await Promise.all([
        window.bibleApi.search(text),
        window.chatApi.searchCommentary(text)
      ])
      if (searchResult.verses.length > 0) {
        contextLines.push('Relevant scripture from the database:')
        searchResult.verses.slice(0, 5).forEach(v => {
          contextLines.push(`${v.book} ${v.chapter}:${v.verse} — ${v.text}`)
        })
      }
      if (commentaryResults.length > 0) {
        contextLines.push('Relevant Church Fathers commentary:')
        commentaryResults.slice(0, 3).forEach(c => {
          contextLines.push(`${c.father_name} on ${c.book} ${c.chapter}:${c.verse}: "${c.excerpt}"`)
        })
      }
    } catch {
      // context fetch failed — proceed without it
    }

    const systemPrompt = buildSystemPrompt(activeVerse.book, activeVerse.chapter)
    const ollamaMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...newMessages.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      {
        role: 'user' as const,
        content: contextLines.length > 0
          ? `${text}\n\n[Reference context from app database:\n${contextLines.join('\n')}]`
          : text
      }
    ]

    let fullContent = ''
    let ollamaInstalled = false
    try {
      // Start Ollama if it isn't already running
      setStreamingContent('Starting AI Scholar…')
      const ollamaStatus = await window.bibleApi.ensureOllama()
      setStreamingContent('')
      if (!ollamaStatus.success) {
        throw new Error(ollamaStatus.error ?? 'Could not start Ollama.')
      }
      ollamaInstalled = true
      if (!ollamaStatus.alreadyRunning) {
        // Brief pause to let the model server fully settle after cold start
        await new Promise(r => setTimeout(r, 800))
      }

      for await (const chunk of streamChat(ollamaMessages, selectedModel)) {
        fullContent += chunk
        setStreamingContent(fullContent)
      }
    } catch (err: any) {
      const msg = err?.message ?? ''
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

    // Persist session
    const sessionId = activeSessionId ?? crypto.randomUUID()
    const existingSession = sessions.find(s => s.id === sessionId)
    const title = existingSession?.title ?? text.slice(0, 60)
    const session: ChatSession = {
      id: sessionId,
      title,
      createdAt: existingSession?.createdAt ?? Date.now(),
      messages: finalMessages
    }
    await window.chatApi.saveSession(session)
    if (!activeSessionId) setActiveSessionId(sessionId)
    setSessions(prev => [session, ...prev.filter(s => s.id !== sessionId)])
  }

  async function handleNavigateFather(fatherName: string, book?: string, chapter?: number, verse?: number) {
    const results = (book && chapter !== undefined && verse !== undefined)
      ? await window.chatApi.searchCommentaryByFatherAndVerse(fatherName, book, chapter, verse)
      : await window.chatApi.searchCommentaryByFather(fatherName)
    if (results.length > 0) onShowFatherEntry(results[0])
  }

  async function handleLoadSession(id: string) {
    const session = await window.chatApi.loadSession(id)
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
                Ask anything about the Bible or Church Fathers.<br />
                <span className="ai-empty-sub">Cite specific passages or ask general questions.</span>
              </div>
            )}
            {messages.map(msg => (
              <AiChatMessage
                key={msg.id}
                message={msg}
                onNavigateVerse={onNavigate}
                onNavigateFather={handleNavigateFather}
              />
            ))}
            {streaming && (
              <AiChatMessage
                key="streaming"
                message={{ id: 'streaming', role: 'assistant', content: streamingContent, timestamp: Date.now() }}
                streaming
                onNavigateVerse={onNavigate}
                onNavigateFather={handleNavigateFather}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-bar">
            <div className="ai-input-row">
              <textarea
                ref={textareaRef}
                className="ai-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
                placeholder="Ask about Scripture or the Church Fathers… (Enter to send, Shift+Enter for newline)"
                rows={2}
                disabled={streaming}
              />
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                title="Send (Enter)"
              >
                {streaming ? '…' : '↑'}
              </button>
            </div>
            <div className="ai-model-bar">
              <span className="ai-model-label">Model:</span>
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
