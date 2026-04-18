import type { BibleVerse, CommentaryEntry } from '../types'

export interface AIQueryResult {
  verses: Array<BibleVerse & { book: string; chapter: number }>
  commentary: CommentaryEntry[]
  answer?: string
}

export interface AIAdapter {
  query(question: string): Promise<AIQueryResult>
  isAvailable(): boolean
}

class StubAdapter implements AIAdapter {
  isAvailable() { return false }
  async query(_question: string): Promise<AIQueryResult> {
    return { verses: [], commentary: [], answer: 'AI search coming soon.' }
  }
}

// Swap StubAdapter for ClaudeAdapter when ready:
// import { ClaudeAdapter } from './claudeAdapter'
// export const aiAdapter: AIAdapter = new ClaudeAdapter(process.env.ANTHROPIC_API_KEY)

export const aiAdapter: AIAdapter = new StubAdapter()
