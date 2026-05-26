export interface GeminiModel {
  id: string
  label: string
  note: string
}

export const GEMINI_MODELS: GeminiModel[] = [
  { id: 'gemini-3-flash-preview',  label: 'Gemini 3 Flash',        note: '1,500/day free' },
  { id: 'gemini-3.1-flash-lite',   label: 'Gemini 3.1 Flash Lite', note: '1,500/day free, fastest' },
  { id: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash',      note: '1,500/day free' },
  { id: 'gemini-2.5-flash-lite',   label: 'Gemini 2.5 Flash Lite', note: '1,500/day free, fastest' },
]

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id
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

export async function fetchGeminiOnce(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 200 },
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Gemini ${response.status}`)
  const json = await response.json()
  return (json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
}

export async function* streamGemini(
  messages: GeminiMessage[],
  systemPrompt: string,
  model: string,
  apiKey: string,
): AsyncGenerator<string> {
  const url = `${BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7 },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    let msg = `Gemini API error ${response.status}`
    try {
      const parsed = JSON.parse(err)
      msg = parsed?.error?.message ?? msg
    } catch { /* use default */ }
    throw new Error(msg)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch { /* ignore malformed */ }
    }
  }
}
