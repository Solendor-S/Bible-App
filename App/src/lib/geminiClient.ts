export interface GeminiModel {
  id: string
  label: string
  note: string
}

export const GEMINI_MODELS: GeminiModel[] = [
  // Free-tier text models, Oct 2026 (ai.google.dev/gemini-api/docs/models + /pricing).
  // Exact daily limits vary per project — see aistudio.google.com/rate-limit.
  // 3.6 first: 3.8 is the newest but is frequently overloaded (503 "high demand"); busy
  // models fall back down this list automatically (see AiPanel).
  { id: 'gemini-3.6-flash',      label: 'Gemini 3.6 Flash',      note: 'free tier, recommended' },
  { id: 'gemini-3.8-flash',      label: 'Gemini 3.8 Flash',      note: 'free tier, newest — often busy' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: 'free tier, fastest' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: 'free tier, lightest' },
]

/** Saved choice, or the default if it was retired from the list (e.g. 2.5 / 3 Flash preview). */
export function resolveGeminiModel(saved: string | null): string {
  return GEMINI_MODELS.some(m => m.id === saved) ? saved! : GEMINI_MODELS[0].id
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiMessage {
  role: 'user' | 'model'
  content: string
}

const TRUSTED_LINK_DOMAINS = ['newadvent.org', 'ccel.org', 'tertullian.org']

export function isTrustedUrl(url: string): boolean {
  return TRUSTED_LINK_DOMAINS.some(d => url.includes(d))
}

export function buildFallbackSearchUrl(fatherName: string, workTitle: string): string {
  const q = encodeURIComponent(`${fatherName} "${workTitle}"`)
  return `https://www.google.com/search?q=${q}+site:newadvent.org+OR+site:ccel.org+OR+site:tertullian.org`
}

/** The model is overloaded or rate-limited — worth retrying on another model. */
export class GeminiBusyError extends Error {}

/** No response headers within this long = treat the model as busy. When overloaded, the
 *  streaming endpoint just holds the connection open instead of returning 503. */
const CONNECT_TIMEOUT_MS = 25_000

export interface StreamOptions {
  signal?: AbortSignal
  /** Thought-summary text from thinking models, as it arrives. */
  onThought?: (text: string) => void
}

interface GeminiPart { text?: string; thought?: boolean }

/** Answer text of a response — every non-thought part. Thinking models often put a
 *  thought or signature part first, so reading parts[0] alone returns nothing. */
function answerText(parts: GeminiPart[] | undefined): string {
  return (parts ?? []).filter(p => !p.thought && p.text).map(p => p.text).join('')
}

export async function fetchGeminiOnce(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // Headroom for thinking models: thought tokens count against maxOutputTokens
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Gemini ${response.status}`)
  const json = await response.json()
  return answerText(json?.candidates?.[0]?.content?.parts).trim()
}

const FINISH_REASON_MESSAGE: Record<string, string> = {
  SAFETY: 'Gemini withheld the answer under its safety filter. Try rephrasing the question.',
  RECITATION: 'Gemini stopped because the answer would quote a source too closely. Try rephrasing.',
  MAX_TOKENS: 'Gemini used its whole output budget thinking and returned no answer. Try a narrower question.',
  PROHIBITED_CONTENT: 'Gemini declined to answer this request.',
  BLOCKLIST: 'Gemini declined to answer this request.',
}

export async function* streamGemini(
  messages: GeminiMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
  { signal, onThought }: StreamOptions = {},
): AsyncGenerator<string> {
  const url = `${BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7, thinkingConfig: { includeThoughts: true } },
  }

  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  let connectTimedOut = false
  const timer = setTimeout(() => { connectTimedOut = true; ctrl.abort() }, CONNECT_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    if (connectTimedOut) throw new GeminiBusyError(`no response within ${CONNECT_TIMEOUT_MS / 1000}s`)
    throw e
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const err = await response.text()
    let msg = `Gemini API error ${response.status}`
    try {
      const parsed = JSON.parse(err)
      msg = parsed?.error?.message ?? msg
    } catch { /* use default */ }
    signal?.removeEventListener('abort', onAbort)
    if (response.status === 503 || response.status === 429 || response.status === 500) throw new GeminiBusyError(msg)
    throw new Error(msg)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let gotText = false
  let finishReason = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      let json: any
      try { json = JSON.parse(data) } catch { continue }
      const cand = json?.candidates?.[0]
      if (json?.promptFeedback?.blockReason) finishReason = json.promptFeedback.blockReason
      if (cand?.finishReason) finishReason = cand.finishReason
      for (const part of (cand?.content?.parts ?? []) as GeminiPart[]) {
        if (!part.text) continue
        if (part.thought) onThought?.(part.text)
        else { gotText = true; yield part.text }
      }
    }
  }
  if (!gotText) {
    throw new Error(FINISH_REASON_MESSAGE[finishReason] ?? `Gemini returned no answer${finishReason ? ` (${finishReason})` : ''}.`)
  }
}
