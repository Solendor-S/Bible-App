// Reader word highlight driven by the Words tab (desktop feature): given the selected
// original-language word's gloss and KJV usage, find the matching English word in the verse.
import type { StrongsEntry } from '../db/queries'

export interface WordHighlight {
  gloss: string | null
  glossTerms: string[]
  positionRatio: number
}

const GLOSS_STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'at',
  'it', 'he', 'she', 'they', 'we', 'ye',
  'as', 'so', 'no', 'on', 'not',
])

export function extractGlossTerms(entry: StrongsEntry | null): string[] {
  if (!entry?.kjv_usage) return []
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of entry.kjv_usage.split(',')) {
    let t = raw.trim()
    if (/^[X+]\s/i.test(t)) continue
    const parenMatch = t.match(/^(\w[\w\s]*)\((-\w+)\)/)
    if (parenMatch) {
      const base = parenMatch[1].trim().toLowerCase()
      const variant = (parenMatch[1].trim() + parenMatch[2].slice(1)).toLowerCase()
      if (!GLOSS_STOPWORDS.has(base) && base.length >= 2 && !seen.has(base)) { seen.add(base); terms.push(base) }
      if (!GLOSS_STOPWORDS.has(variant) && variant.length >= 2 && !seen.has(variant)) { seen.add(variant); terms.push(variant) }
      continue
    }
    t = t.replace(/\s*\(.*?\)/g, '').trim().toLowerCase()
    if (!t || t === 'etc' || t.length < 2 || /^\d+$/.test(t)) continue
    if (GLOSS_STOPWORDS.has(t) || seen.has(t)) continue
    seen.add(t); terms.push(t)
    if (terms.length >= 10) break
  }
  return terms
}

// KJV archaic irregular forms → modern base
const KJV_IRREG: Record<string, string> = {
  // Copula (to be) — gloss "to be" maps to these KJV forms
  was: 'be', were: 'be', is: 'be', am: 'be', been: 'be',
  // Archaic 2nd-person copula
  art: 'be', wast: 'be',
  // Common -eth forms
  saith: 'say', hath: 'have', doth: 'do', doeth: 'do', goeth: 'go',
  seeth: 'see', cometh: 'come', knoweth: 'know', giveth: 'give',
  // Short -est forms (< 6 chars, can't be caught by suffix rule below)
  doest: 'do', goest: 'go',
  // Other archaics
  hast: 'have', wilt: 'will', shalt: 'shall',
  canst: 'can', wouldst: 'would', shouldst: 'should',
}

// Normalize a word for matching: handles KJV archaic forms, standard stemming, silent 'e'
function normalizeForMatch(s: string): string {
  let w = s.replace(/[^\w']/g, '').toLowerCase()
  if (KJV_IRREG[w]) return KJV_IRREG[w]
  // Strip KJV -eth suffix: maketh→mak, loveth→lov, speaketh→speak
  if (w.endsWith('eth') && w.length >= 5) w = w.slice(0, -3)
  // Strip KJV -est suffix (2nd person singular): makest→mak, knowest→know, sayest→say
  // Guard length >= 6 to avoid words like "chest", "best", "west"
  if (w.endsWith('est') && w.length >= 6) w = w.slice(0, -3)
  // Standard stemming
  const r = w.replace(/(ing|tion|ed|es|ly|s)$/, '')
  if (r.length >= 3) w = r
  // Strip trailing silent 'e' for consistent comparison: make→mak, love→lov
  if (w.endsWith('e') && w.length >= 4) w = w.slice(0, -1)
  return w
}

// Pronoun prefixes common in TAHOT verbal glosses ("he created", "she said", "they went")
const VERBAL_PREFIXES = new Set(['he', 'she', 'it', 'they', 'we', 'i', 'you', 'ye'])

// Phase 1: match a single specific gloss term (OpenGNT / TAHOT context-sensitive)
export function resolveHighlightIndices(tokens: string[], hl: WordHighlight): Set<number> {
  const normalized = tokens.map(normalizeForMatch)

  if (hl.gloss) {
    // Try gloss words from most specific (longest) to least, skipping verbal pronoun prefixes.
    // This handles both single-word NT glosses ("beginning") and multi-word OT glosses ("he created").
    const glossWords = hl.gloss.split(/\s+/).map(normalizeForMatch).filter(w => w.length >= 2)
    const target = hl.positionRatio * (tokens.length - 1)

    // Sort: skip pronoun prefixes first, then prefer longer words
    const candidates = glossWords
      .filter(w => !VERBAL_PREFIXES.has(w))
      .sort((a, b) => b.length - a.length)
    // Fallback: if only pronoun prefix words, use them too
    const tryWords = candidates.length > 0 ? candidates : glossWords

    for (const g of tryWords) {
      const hits = normalized.map((_, i) => i).filter(i => normalized[i] === g)
      if (hits.length === 1) return new Set(hits)
      if (hits.length > 1) {
        hits.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
        return new Set([hits[0]])
      }
    }
    // Gloss not found (KJV/Berean divergence) — fall through to Phase 2
  }

  return resolveHighlightIndicesFuzzy(normalized, hl.glossTerms, hl.positionRatio, tokens.length)
}

// Phase 2: improved fuzzy fallback used for OT and NT cases where gloss is null/unmatched
function resolveHighlightIndicesFuzzy(
  normalized: string[],
  glossTerms: string[],
  positionRatio: number,
  tokenCount: number
): Set<number> {
  if (!glossTerms.length) return new Set()

  // Score each candidate token index by term priority + match type
  const scores = new Map<number, number>()

  for (let termIdx = 0; termIdx < glossTerms.length; termIdx++) {
    const termWeight = 1 / (termIdx + 1)
    const termParts = glossTerms[termIdx].split(/\s+/).map(normalizeForMatch)

    if (termParts.length === 1) {
      const t = termParts[0]
      for (let i = 0; i < normalized.length; i++) {
        const w = normalized[i]
        if (!w) continue
        if (w === t) scores.set(i, (scores.get(i) ?? 0) + termWeight * 2)
      }
    } else {
      // Multi-word phrase
      outer: for (let i = 0; i <= normalized.length - termParts.length; i++) {
        for (let j = 0; j < termParts.length; j++) {
          if (normalized[i + j] !== termParts[j]) continue outer
        }
        scores.set(i, (scores.get(i) ?? 0) + termWeight * 2)
      }
    }
  }

  if (!scores.size) return new Set()

  // Apply position window — drop candidates more than 45% away from target position
  const target = positionRatio * (tokenCount - 1)
  const window = tokenCount * 0.45
  const windowed = [...scores.entries()].filter(([i]) => Math.abs(i - target) <= window)
  const pool = windowed.length > 0 ? windowed : [...scores.entries()]

  // Pick highest-scoring candidate; positionRatio breaks ties
  pool.sort((a, b) => b[1] - a[1] || Math.abs(a[0] - target) - Math.abs(b[0] - target))
  return new Set([pool[0][0]])
}
