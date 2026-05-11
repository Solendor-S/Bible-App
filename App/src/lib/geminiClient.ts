export interface GeminiModel {
  id: string
  label: string
  note: string
}

export const GEMINI_MODELS: GeminiModel[] = [
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      note: '1,500/day free' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: '1,500/day free, fastest' },
  { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        note: '50/day free, best quality' },
]

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiMessage {
  role: 'user' | 'model'
  content: string
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
