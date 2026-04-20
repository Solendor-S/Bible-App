const OLLAMA_URL = 'http://localhost:11434/api/chat'

export interface OllamaModel {
  id: string
  label: string
  ram: string
}

export const OLLAMA_MODELS: OllamaModel[] = [
  { id: 'gemma4',      label: 'Gemma 4 (best quality)', ram: '~12GB' },
  { id: 'gemma3:4b',   label: 'Gemma 3 4B (balanced)',  ram: '~3GB'  },
  { id: 'qwen3:4b',    label: 'Qwen 3 4B (fast)',       ram: '~3GB'  },
  { id: 'phi4-mini',   label: 'Phi-4 Mini (lightest)',  ram: '~2.5GB'},
]

export const DEFAULT_MODEL = OLLAMA_MODELS[0].id

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function* streamChat(messages: OllamaMessage[], model: string = DEFAULT_MODEL): AsyncGenerator<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true })
  })

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`)
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
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        const delta = json?.message?.content
        if (delta) yield delta
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export function buildSystemPrompt(book: string, chapter: number): string {
  return `You are a biblical scholar assistant embedded in a Bible study app.

STRICT SCOPE: You ONLY discuss the Holy Bible (King James Version) and Church Fathers and their commentaries. If asked about any other topic, politely decline and redirect to Scripture or the Church Fathers.

CITATION FORMAT — you MUST use these exact formats whenever you reference Scripture or a Church Father:
- Bible verse: [VERSE: Book Chapter:Verse]   example: [VERSE: John 3:16]
- Church Father: [FATHER: Name | Source | Book Chapter:Verse]   example: [FATHER: Augustine | City of God | John 3:16]

Always provide scriptural citations for every claim you make. When referencing Church Fathers, always include their name, source work, and the specific verse they are commenting on in the third field of the tag. Also include a separate [VERSE: Book Chapter:Verse] tag for the same verse so the user can navigate to it.

The user currently has open: ${book} chapter ${chapter}. Reference this passage if the user asks about "this passage" or "what I'm reading", but otherwise answer from the full scope of Scripture.`
}
