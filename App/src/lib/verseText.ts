// Pure verse-text parsing, ported from the Android reader (Patristica ReaderScreen.tsx).
import type { Segment } from '../data/redLetter'
import { BOOK_MAP } from '../data/books'
import type { Footnote } from '../types'

// ── Footnote anchoring ────────────────────────────────────
// USFM word counts differ from DB text, so the stored word_index is unreliable: find the
// footnote's anchor phrase (text before ':') in the verse and attach after its last word.
export function buildFnByWord(text: string, footnotes: Footnote[]): Map<number, Footnote> {
  const rawWords = text.split(/\s+/).filter(w => w)
  const normWords = rawWords.map(w => w.toLowerCase().replace(/[^a-z'-]/g, ''))
  const map = new Map<number, Footnote>()
  for (const fn of footnotes) {
    const colonIdx = fn.content.indexOf(':')
    let insertAt = -1
    if (colonIdx > 0) {
      const anchor = fn.content.slice(0, colonIdx).replace(/[……â\xa6]+/g, '').trim()
      const anchorWords = anchor.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z'-]/g, '')).filter(w => w)
      if (anchorWords.length) {
        const last = anchorWords[anchorWords.length - 1]
        for (let i = normWords.length - 1; i >= 0; i--) {
          if (normWords[i] !== last) continue
          if (anchorWords.length === 1) { insertAt = i + 1; break }
          let match = true
          for (let j = 0; j < anchorWords.length; j++) {
            const vi = i - (anchorWords.length - 1 - j)
            if (vi < 0 || normWords[vi] !== anchorWords[j]) { match = false; break }
          }
          if (match) { insertAt = i + 1; break }
        }
      }
    }
    if (insertAt < 0 && fn.word_index <= normWords.length) insertAt = fn.word_index
    if (insertAt > 0 && !map.has(insertAt)) map.set(insertAt, fn)
  }
  return map
}

export function buildVerseMap<T extends { verse: number }>(items: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>()
  items.forEach(item => {
    const arr = map.get(item.verse) ?? []
    arr.push(item)
    map.set(item.verse, arr)
  })
  return map
}

// ── KJV+ / TR+ / WLC+ / LXX+ parser ──────────────────────

export type KJVToken = { word: string; strongs?: string[]; italic?: boolean }

const dedupe = (arr: string[]) => [...new Set(arr)]

// lazyPush=true (KJV+ English order): accumulate ALL consecutive strongs for
// the pending word and flush only when the next word arrives.
// lazyPush=false (I_KJV+ interlinear): push immediately on first strongs;
// subsequent strongs with no preceding word defer to the next word.
export function parseKJVPlus(text: string, lazyPush = false): KJVToken[] {
  const tokens: KJVToken[] = []
  const parts = text.split(' ')
  let pending: string | null = null
  let pendingItalic = false
  let pendingStrongs: string[] = []
  let deferred: string[] = []

  for (const p of parts) {
    if (p && /^[GH]\d+$/.test(p)) {
      if (lazyPush) {
        if (pending !== null) pendingStrongs.push(p)
        else if (tokens.length > 0) tokens[tokens.length - 1].strongs = [...(tokens[tokens.length - 1].strongs ?? []), p]
      } else if (pending !== null) {
        tokens.push({ word: pending, strongs: [...deferred, p], italic: pendingItalic || undefined })
        pending = null; pendingItalic = false; deferred = []
      } else {
        deferred.push(p)
      }
    } else {
      if (lazyPush) {
        if (pending !== null) {
          tokens.push({ word: pending, strongs: pendingStrongs.length > 0 ? dedupe(pendingStrongs) : undefined, italic: pendingItalic || undefined })
          pendingStrongs = []
        }
      } else if (pending !== null) {
        if (deferred.length > 0) {
          tokens.push({ word: pending, strongs: dedupe(deferred), italic: pendingItalic || undefined })
          deferred = []
        } else {
          tokens.push({ word: pending, italic: pendingItalic || undefined })
        }
      }
      const italic = p.includes('{')
      pending = italic ? p.replace(/[{}]/g, '') : (p || null)
      pendingItalic = italic
    }
  }

  if (lazyPush) {
    if (pending !== null) {
      tokens.push({ word: pending, strongs: pendingStrongs.length > 0 ? dedupe(pendingStrongs) : undefined, italic: pendingItalic || undefined })
    } else if (pendingStrongs.length > 0 && tokens.length > 0) {
      const last = tokens[tokens.length - 1]
      last.strongs = dedupe([...(last.strongs ?? []), ...pendingStrongs])
    }
  } else if (pending !== null) {
    tokens.push({ word: pending, strongs: deferred.length > 0 ? dedupe(deferred) : undefined, italic: pendingItalic || undefined })
  } else if (deferred.length > 0 && tokens.length > 0) {
    // Trailing Strongs with no following word (e.g. Heb 7:3 "continually G1519 G1336")
    const last = tokens[tokens.length - 1]
    last.strongs = dedupe([...(last.strongs ?? []), ...deferred])
  }
  return tokens
}

// ── Segments: italics + OT quote caps ─────────────────────

export function applyItalics(seg: Segment): Segment[] {
  if (!seg.t.includes('{')) return [seg]
  const result: Segment[] = []
  const re = /\{([^}]*)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(seg.t)) !== null) {
    if (m.index > last) result.push({ t: seg.t.slice(last, m.index), red: seg.red })
    if (m[1]) result.push({ t: m[1], red: seg.red, italic: true })
    // empty {} (artifact of stripping \+w inside italic markers) → consume but push nothing
    last = m.index + m[0].length
  }
  if (last < seg.t.length) result.push({ t: seg.t.slice(last), red: seg.red })
  return result
}

export function applyOtQuoteCaps(segments: Segment[], wordStart: number, wordEnd: number): Segment[] {
  const result: Segment[] = []
  let wordIdx = 0
  for (const seg of segments) {
    const tokens = seg.t.split(/(\s+)/)
    let buf = ''
    let bufCaps = seg.caps ?? false
    for (const tok of tokens) {
      if (/^\s+$/.test(tok) || tok === '') { buf += tok; continue }
      const inQuote = wordIdx >= wordStart && wordIdx < wordEnd
      if (inQuote !== bufCaps && buf) { result.push({ ...seg, t: buf, caps: bufCaps }); buf = '' }
      bufCaps = inQuote
      buf += tok
      wordIdx++
    }
    if (buf) result.push({ ...seg, t: buf, caps: bufCaps })
  }
  return result
}

/** Prose (reading mode): "{word}" KJV italic markers → segments. */
export function parseItalicSegments(text: string): { t: string; italic: boolean }[] {
  const segs: { t: string; italic: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open === -1) { segs.push({ t: text.slice(i), italic: false }); break }
    if (open > i) segs.push({ t: text.slice(i, open), italic: false })
    const close = text.indexOf('}', open + 1)
    if (close === -1) { segs.push({ t: text.slice(open), italic: false }); break }
    segs.push({ t: text.slice(open + 1, close), italic: true })
    i = close + 1
  }
  return segs.filter(s => s.t.length > 0)
}

// ── Focus mode (bionic reading) ───────────────────────────

const ALPHA_RE = /[a-zA-Z]/

/** Bold the first ~60% of each word's letters. */
export function focusSplit(word: string): [string, string] {
  let letterCount = 0
  for (let i = 0; i < word.length; i++) if (ALPHA_RE.test(word[i])) letterCount++
  if (letterCount < 3) return [word, '']
  const boldCount = Math.ceil(letterCount * 0.6)
  let seen = 0
  for (let i = 0; i < word.length; i++) {
    if (ALPHA_RE.test(word[i])) seen++
    if (seen === boldCount) return [word.slice(0, i + 1), word.slice(i + 1)]
  }
  return [word, '']
}

// ── DSS editorial markers ─────────────────────────────────

export type DssSeg = { t: string; lacuna: boolean; uncertain: boolean; supralinear: boolean }

export function parseDssMarkers(text: string): DssSeg[] {
  const segs: DssSeg[] = []
  let cur = ''
  let lacuna = false, uncertain = false, supralinear = false

  const flush = (l: boolean, u: boolean, s: boolean) => {
    if (cur) segs.push({ t: cur, lacuna, uncertain, supralinear })
    cur = ''; lacuna = l; uncertain = u; supralinear = s
  }

  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '#' || ch === '?') { i++; continue }
    if (ch === '(' && next === '^') {
      flush(lacuna, true, true)
      i += 2
      if (text[i] === ' ') i++
    } else if (ch === '^' && next === ')') {
      if (cur.endsWith(' ')) cur = cur.slice(0, -1)
      flush(lacuna, false, false)
      i += 2
    } else if (ch === '[') { flush(true,  uncertain, supralinear); i++ }
      else if (ch === ']') { flush(false, uncertain, supralinear); i++ }
      else if (ch === '(') { flush(lacuna, true,  supralinear); i++ }
      else if (ch === ')') { flush(lacuna, false, supralinear); i++ }
      else { cur += ch; i++ }
  }
  if (cur) segs.push({ t: cur, lacuna, uncertain, supralinear })
  return segs.filter(s => s.t)
}

// ── BSB scrape artifacts ──────────────────────────────────
// In Psalms a |reftext| span marks where verse 1 begins; everything before it is the
// superscription (shown separately as the psalm heading). Stray <p>/<b> tags are dropped.
const BSB_VERSE1_MARKER = /^[\s\S]*?<span class=\|reftext\|>[\s\S]*?<\/span>/
function stripBsbMarkup(s: string): string {
  return s.replace(BSB_VERSE1_MARKER, '').replace(/<[^>]*>/g, '')
}

/** ". . ." runs mark Greek words folded into the English; foldedOn keeps one marker. */
export function cleanBsbText(stripped: string, foldedOn: boolean): string {
  let out = stripBsbMarkup(stripped).replace(/(\.[ ]?){3,}/g, foldedOn ? '. . . ' : ' ')
  if (!foldedOn) out = out.replace(/\s+([,;:.!?])/g, '$1')
  return out.replace(/  +/g, ' ').trim()
}

/** Reader display: clean, then [x] → {x} italic markers. */
export function formatBsbText(stripped: string, foldedOn: boolean): string {
  return cleanBsbText(stripped, foldedOn).replace(/\[([^\]0-9][^\]]*)\]/g, '{$1}')
}

// ── Inline references ─────────────────────────────────────

/** Splits early-text prose on "[12]" footnote markers and "Philippians 1:5"-style refs. */
export const INLINE_SCRIPTURE_RE = /(\[\d+\]|[1-3]?\s*[A-Z][a-z]+(?:\s+[A-Za-z]+)?\s+\d+:\d+(?:-\d+)?)/
export const INLINE_BOOK_RE = /^([1-3]?\s*[A-Z][a-z]+(?:\s+[A-Za-z]+)?)\s+(\d+):(\d+)/

const BSB_BOOK_ALIASES: Record<string, string> = { Psalm: 'Psalms' }

export function parseBsbRef(raw: string): { book: string; chapter: number; verse: number } | null {
  const s = raw.trim().replace(/^[Ss]ee\s+/, '')
  const m = s.match(INLINE_BOOK_RE)
  if (!m) return null
  const book = BSB_BOOK_ALIASES[m[1].trim()] ?? m[1].trim()
  if (!BOOK_MAP[book]) return null
  return { book, chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) }
}

// E_LXX / Brenton notes cite like "Mat. 3. 3" or "John 1. 23"
export const ELXX_REF_RE = /([1-4]\s+)?([A-Z][A-Za-z]+)\.?\s+(\d+)\.\s*(\d+)/g

const BRENTON_BASE_BOOK: Record<string, string> = {
  Mat: 'Matthew', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts',
  Rom: 'Romans', Cor: 'Corinthians', Gal: 'Galatians', Eph: 'Ephesians',
  Phil: 'Philippians', Col: 'Colossians', Thes: 'Thessalonians',
  Tim: 'Timothy', Tit: 'Titus', Phlm: 'Philemon', Heb: 'Hebrews',
  Jas: 'James', Pet: 'Peter', Pe: 'Peter',
  Jude: 'Jude', Rev: 'Revelation',
  Gen: 'Genesis', Ex: 'Exodus', Lev: 'Leviticus', Num: 'Numbers',
  Deu: 'Deuteronomy', Dt: 'Deuteronomy', Josh: 'Joshua', Jos: 'Joshua',
  Judg: 'Judges', Ruth: 'Ruth', Sam: 'Samuel', Kings: 'Kings', Chr: 'Chronicles',
  Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther', Job: 'Job',
  Ps: 'Psalms', Psa: 'Psalms', Prov: 'Proverbs', Ecc: 'Ecclesiastes',
  Song: 'Song of Solomon', Is: 'Isaiah', ISAIAH: 'Isaiah', Isa: 'Isaiah',
  Jer: 'Jeremiah', Lam: 'Lamentations', Ezek: 'Ezekiel', Dan: 'Daniel',
  Hos: 'Hosea', Joel: 'Joel', Amos: 'Amos', Obad: 'Obadiah',
  Jon: 'Jonah', Mic: 'Micah', Nah: 'Nahum', Hab: 'Habakkuk',
  Zeph: 'Zephaniah', Hag: 'Haggai', Zech: 'Zechariah', Mal: 'Malachi',
}

const LXX_KINGDOM_MAP: Record<string, string> = {
  '1 Kingdoms': '1 Samuel', '2 Kingdoms': '2 Samuel',
  '3 Kingdoms': '1 Kings',  '4 Kingdoms': '2 Kings',
}

export function parseElxxRef(numPrefix: string | undefined, abbrev: string, ch: string, v: string)
  : { book: string; chapter: number; verse: number } | null {
  const base = BRENTON_BASE_BOOK[abbrev]
  if (!base) return null
  const num = numPrefix?.trim()
  const full = num ? `${num} ${base}` : base
  const canonical = LXX_KINGDOM_MAP[full] ?? full
  if (!BOOK_MAP[canonical]) return null
  return { book: canonical, chapter: parseInt(ch, 10), verse: parseInt(v, 10) }
}

// Book abbreviations for compact reference chips
const BOOK_ABBREVS: Record<string, string> = {
  'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num',
  'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg',
  '1 Samuel': '1 Sam', '2 Samuel': '2 Sam', '1 Kings': '1 Kgs', '2 Kings': '2 Kgs',
  '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', 'Nehemiah': 'Neh',
  'Psalms': 'Ps', 'Proverbs': 'Prov', 'Ecclesiastes': 'Eccl', 'Song of Solomon': 'Song',
  'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Ezek',
  'Daniel': 'Dan', 'Hosea': 'Hos', 'Obadiah': 'Obad', 'Habakkuk': 'Hab',
  'Zephaniah': 'Zeph', 'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal',
  'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
  'Romans': 'Rom', '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
  '1 Thessalonians': '1 Thess', '2 Thessalonians': '2 Thess',
  '1 Timothy': '1 Tim', '2 Timothy': '2 Tim', 'Titus': 'Tit', 'Philemon': 'Phlm',
  'Hebrews': 'Heb', 'James': 'Jas', '1 Peter': '1 Pet', '2 Peter': '2 Pet',
  '1 John': '1 Jn', '2 John': '2 Jn', '3 John': '3 Jn', 'Jude': 'Jude',
  'Revelation': 'Rev',
  'Wisdom of Solomon': 'Wis', 'Sirach': 'Sir', 'Tobit': 'Tob', 'Judith': 'Jdt',
  'Baruch': 'Bar', '1 Maccabees': '1 Macc', '2 Maccabees': '2 Macc',
  '3 Maccabees': '3 Macc', '4 Maccabees': '4 Macc',
  '1 Esdras': '1 Esd', '2 Esdras': '2 Esd',
  'Prayer of Manasseh': 'Pr. Man', 'Prayer of Azariah': 'Pr. Azar',
  'Bel and the Dragon': 'Bel & Drag', 'Psalm 151': 'Ps 151',
  '1 Enoch': '1 En', 'Jubilees': 'Jub',
  '1 Meqabyan': '1 Meq', '2 Meqabyan': '2 Meq', '3 Meqabyan': '3 Meq',
  'Ignatius to the Ephesians': 'Ign. Eph', 'Ignatius to the Magnesians': 'Ign. Mag',
  'Ignatius to the Trallians': 'Ign. Tra', 'Ignatius to the Romans': 'Ign. Rom',
  'Ignatius to the Philadelphians': 'Ign. Phil', 'Ignatius to the Smyrnaeans': 'Ign. Smyr',
  'Ignatius to Polycarp': 'Ign. Poly', 'Epistle to Diognetus': 'Ep. Diog',
  'Epistle of Barnabas': 'Ep. Bar', 'Epistle of Polycarp': 'Ep. Poly',
  'Martyrdom of Polycarp': 'Mart. Poly',
  'Justin Martyr — First Apology': 'Justin 1 Apol',
  'Justin Martyr — Dialogue with Trypho': 'Justin Dial',
  'Tertullian — Apologeticus': 'Tert. Apol',
  'Against Heresies Book 1': 'Ag. Her. 1', 'Against Heresies Book 2': 'Ag. Her. 2',
  'Against Heresies Book 3': 'Ag. Her. 3', 'Against Heresies Book 4': 'Ag. Her. 4',
  'Against Heresies Book 5': 'Ag. Her. 5',
}
export const abbrevBook = (b: string) => BOOK_ABBREVS[b] ?? b
