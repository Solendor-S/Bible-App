import type { PassageRef } from '../types'

const CANONICAL_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
]

// Normalized key → canonical name (no spaces, lowercase)
const NORM_BOOKS: Record<string, string> = {}
for (const b of CANONICAL_BOOKS) {
  NORM_BOOKS[b.toLowerCase().replace(/\s+/g, '')] = b
}

const ALIASES: Record<string, string> = {
  // Genesis
  gen: 'Genesis', ge: 'Genesis', gn: 'Genesis',
  // Exodus
  ex: 'Exodus', exo: 'Exodus', exod: 'Exodus',
  // Leviticus
  lev: 'Leviticus', le: 'Leviticus', lv: 'Leviticus',
  // Numbers
  num: 'Numbers', nu: 'Numbers', nm: 'Numbers', numb: 'Numbers',
  // Deuteronomy
  deu: 'Deuteronomy', deut: 'Deuteronomy', dt: 'Deuteronomy',
  // Joshua
  jos: 'Joshua', josh: 'Joshua', jsh: 'Joshua',
  // Judges
  jdg: 'Judges', judg: 'Judges', jdgs: 'Judges',
  // Ruth
  ru: 'Ruth', rut: 'Ruth', rth: 'Ruth',
  // Samuel
  '1sa': '1 Samuel', '1sam': '1 Samuel', '1s': '1 Samuel',
  '2sa': '2 Samuel', '2sam': '2 Samuel', '2s': '2 Samuel',
  // Kings
  '1ki': '1 Kings', '1kgs': '1 Kings', '1kg': '1 Kings',
  '2ki': '2 Kings', '2kgs': '2 Kings', '2kg': '2 Kings',
  // Chronicles
  '1ch': '1 Chronicles', '1chr': '1 Chronicles', '1chron': '1 Chronicles',
  '2ch': '2 Chronicles', '2chr': '2 Chronicles', '2chron': '2 Chronicles',
  // Ezra–Malachi
  ezr: 'Ezra',
  neh: 'Nehemiah',
  est: 'Esther', esth: 'Esther',
  job: 'Job', jb: 'Job',
  ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms', pss: 'Psalms',
  pro: 'Proverbs', prov: 'Proverbs', pr: 'Proverbs', prv: 'Proverbs',
  ecc: 'Ecclesiastes', eccl: 'Ecclesiastes', qoh: 'Ecclesiastes',
  sos: 'Song of Solomon', sng: 'Song of Solomon', ss: 'Song of Solomon',
  song: 'Song of Solomon', cant: 'Song of Solomon',
  isa: 'Isaiah', is: 'Isaiah',
  jer: 'Jeremiah',
  lam: 'Lamentations', la: 'Lamentations',
  eze: 'Ezekiel', ezek: 'Ezekiel', ezk: 'Ezekiel',
  dan: 'Daniel', da: 'Daniel', dn: 'Daniel',
  hos: 'Hosea', ho: 'Hosea',
  joe: 'Joel', jl: 'Joel',
  amo: 'Amos', am: 'Amos',
  oba: 'Obadiah', ob: 'Obadiah',
  jon: 'Jonah',
  mic: 'Micah', mi: 'Micah',
  nah: 'Nahum', na: 'Nahum',
  hab: 'Habakkuk',
  zep: 'Zephaniah', zeph: 'Zephaniah', zp: 'Zephaniah',
  hag: 'Haggai', hg: 'Haggai',
  zec: 'Zechariah', zech: 'Zechariah', zch: 'Zechariah',
  mal: 'Malachi',
  // NT
  mt: 'Matthew', mat: 'Matthew', matt: 'Matthew', mth: 'Matthew',
  mk: 'Mark', mar: 'Mark', mrk: 'Mark',
  lk: 'Luke', luk: 'Luke',
  jn: 'John', joh: 'John', jhn: 'John',
  ac: 'Acts', act: 'Acts', acts: 'Acts',
  ro: 'Romans', rom: 'Romans',
  '1co': '1 Corinthians', '1cor': '1 Corinthians',
  '2co': '2 Corinthians', '2cor': '2 Corinthians',
  gal: 'Galatians',
  eph: 'Ephesians',
  php: 'Philippians', phil: 'Philippians', phl: 'Philippians',
  col: 'Colossians',
  '1th': '1 Thessalonians', '1thes': '1 Thessalonians', '1thess': '1 Thessalonians',
  '2th': '2 Thessalonians', '2thes': '2 Thessalonians', '2thess': '2 Thessalonians',
  '1ti': '1 Timothy', '1tim': '1 Timothy',
  '2ti': '2 Timothy', '2tim': '2 Timothy',
  tit: 'Titus', ti: 'Titus',
  phm: 'Philemon', phlm: 'Philemon',
  heb: 'Hebrews',
  jas: 'James', jam: 'James', jms: 'James',
  '1pe': '1 Peter', '1pet': '1 Peter', '1pt': '1 Peter',
  '2pe': '2 Peter', '2pet': '2 Peter', '2pt': '2 Peter',
  '1jn': '1 John', '1jo': '1 John',
  '2jn': '2 John', '2jo': '2 John',
  '3jn': '3 John', '3jo': '3 John',
  jud: 'Jude',
  rev: 'Revelation', re: 'Revelation', apoc: 'Revelation', rv: 'Revelation',
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function resolveBook(raw: string): string {
  const key = raw.toLowerCase().replace(/\s+/g, '')

  // 1. Exact alias match
  if (ALIASES[key]) return ALIASES[key]

  // 2. Exact canonical match (normalized)
  if (NORM_BOOKS[key]) return NORM_BOOKS[key]

  // 3. Prefix match against canonical books (normalized, no spaces)
  //    e.g. "mat" → "matthew", "gen" → "genesis"
  const prefixMatch = CANONICAL_BOOKS.find(b =>
    b.toLowerCase().replace(/\s+/g, '').startsWith(key)
  )
  if (prefixMatch) return prefixMatch

  // 4. Fuzzy match — find canonical book with lowest Levenshtein distance
  //    Only accept if distance ≤ 2 to avoid wild mismatches
  let best: string | null = null
  let bestDist = Infinity
  for (const b of CANONICAL_BOOKS) {
    const normB = b.toLowerCase().replace(/\s+/g, '')
    // Compare against the full name and also a prefix of equal length
    const dist = Math.min(
      levenshtein(key, normB),
      levenshtein(key, normB.slice(0, key.length))
    )
    if (dist < bestDist) { bestDist = dist; best = b }
  }
  const maxDist = Math.max(1, Math.floor(key.length / 3))
  if (best && bestDist <= maxDist) return best

  // 5. Title-case fallback (unknown book, let DB return empty)
  return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// Regex: optional number prefix + book word(s) + chapter + optional :verse[-verse]
const PASSAGE_RE = /^([1-3]?\s*[a-z]+(?:\s+[a-z]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i
// Cross-chapter range with book: "1 thes 4:10-5:2"
const CROSS_CHAPTER_RE = /^([1-3]?\s*[a-z]+(?:\s+[a-z]+)*)\s+(\d+):(\d+)-(\d+):(\d+)$/i
// Orphan chapter/verse (no book): "5" / "5:10" / "5:10-15"
const ORPHAN_RE = /^(\d+)(?::(\d+)(?:-(\d+))?)?$/
// Orphan cross-chapter (no book): "5:10-6:2"
const ORPHAN_CROSS_RE = /^(\d+):(\d+)-(\d+):(\d+)$/
// Book-only: optional number prefix + book name, nothing else
const BOOK_ONLY_RE = /^([1-3]?\s*[a-z]+(?:\s+[a-z]+)*)$/i

// Expands a cross-chapter range into PassageRefs, inserting whole chapters in between.
// ch1:v1 → ch2:v2  (v2=undefined means include whole last chapter)
function expandCrossChapter(book: string, ch1: number, v1: number, ch2: number, v2: number | undefined, raw: string): PassageRef[] {
  const refs: PassageRef[] = []
  refs.push({ book, chapter: ch1, verseStart: v1, verseEnd: 999, raw })
  for (let ch = ch1 + 1; ch < ch2; ch++) {
    refs.push({ book, chapter: ch, raw: '' })
  }
  if (v2 !== undefined) {
    refs.push({ book, chapter: ch2, verseStart: 1, verseEnd: v2, raw: '' })
  } else {
    refs.push({ book, chapter: ch2, raw: '' })
  }
  return refs
}

export function parsePassage(input: string): PassageRef[] {
  const tokens = input.split(/[;,]/).map(s => s.trim()).filter(Boolean)
  const results: PassageRef[] = []
  let prevBook: string | null = null

  for (const token of tokens) {
    // Cross-chapter range with explicit book: "1 thes 4:10-5:2" / "john 1:45-3:1"
    const cross = token.match(CROSS_CHAPTER_RE)
    if (cross) {
      const book = resolveBook(cross[1].trim())
      const ch1 = parseInt(cross[2], 10), v1 = parseInt(cross[3], 10)
      const ch2 = parseInt(cross[4], 10), v2 = parseInt(cross[5], 10)
      results.push(...expandCrossChapter(book, ch1, v1, ch2, v2, token))
      prevBook = book
      continue
    }

    // Normal passage with explicit book: "1 thes 4" / "4:10" / "4:10-15"
    const m = token.match(PASSAGE_RE)
    if (m) {
      const book = resolveBook(m[1].trim())
      const chapter = parseInt(m[2], 10)
      const verseStart = m[3] ? parseInt(m[3], 10) : undefined
      const verseEnd = m[4] ? parseInt(m[4], 10) : undefined
      // "john 1:45-2" / "john 1:45-3" — verseEnd < verseStart means it's a chapter, not a verse
      if (verseStart !== undefined && verseEnd !== undefined && verseEnd < verseStart) {
        results.push(...expandCrossChapter(book, chapter, verseStart, verseEnd, undefined, token))
        prevBook = book
        continue
      }
      results.push({ book, chapter, verseStart, verseEnd, raw: token })
      prevBook = book
      continue
    }

    if (prevBook) {
      // Orphan cross-chapter (carry-forward book): "5:10-6:2" / "5:10-7:3"
      const oc = token.match(ORPHAN_CROSS_RE)
      if (oc) {
        const ch1 = parseInt(oc[1], 10), v1 = parseInt(oc[2], 10)
        const ch2 = parseInt(oc[3], 10), v2 = parseInt(oc[4], 10)
        results.push(...expandCrossChapter(prevBook, ch1, v1, ch2, v2, token))
        continue
      }

      // Orphan chapter/verse (carry-forward book): "5" / "5:10" / "5:10-15"
      const ov = token.match(ORPHAN_RE)
      if (ov) {
        const chapter = parseInt(ov[1], 10)
        const verseStart = ov[2] ? parseInt(ov[2], 10) : undefined
        const verseEnd = ov[3] ? parseInt(ov[3], 10) : undefined
        // "1:45-2" / "1:45-3" orphan — verseEnd < verseStart means it's a chapter
        if (verseStart !== undefined && verseEnd !== undefined && verseEnd < verseStart) {
          results.push(...expandCrossChapter(prevBook, chapter, verseStart, verseEnd, undefined, token))
          continue
        }
        results.push({ book: prevBook, chapter, verseStart, verseEnd, raw: token })
        continue
      }
    }

    // Book-only input (e.g. "John", "1 Peter", "Dan")
    if (BOOK_ONLY_RE.test(token)) {
      const book = resolveBook(token)
      if (CANONICAL_BOOKS.includes(book)) {
        results.push({ book, chapter: 1, raw: token, bookOnly: true })
        prevBook = book
        continue
      }
    }
  }

  return results
}

export function passagesToString(passages: PassageRef[]): string {
  return passages.map(p => p.raw).filter(Boolean).join('; ')
}
