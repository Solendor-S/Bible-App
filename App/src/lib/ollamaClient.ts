const OLLAMA_URL = 'http://localhost:11434/api/chat'
const MODEL = 'gemma4'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function* streamChat(messages: OllamaMessage[]): AsyncGenerator<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: true })
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
- Church Father: [FATHER: Name | Source]      example: [FATHER: Augustine | City of God]

Always provide scriptural citations for every claim you make. When referencing Church Fathers, always include their name and source work. IMPORTANT: whenever you use a [FATHER: Name | Source] tag, also include the [VERSE: Book Chapter:Verse] tag for the specific scripture passage that father is commenting on — place the verse tag immediately before or after the father tag so the user can navigate to it.

The user currently has open: ${book} chapter ${chapter}. Reference this passage if the user asks about "this passage" or "what I'm reading", but otherwise answer from the full scope of Scripture.`
}
