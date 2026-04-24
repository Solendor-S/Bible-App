/**
 * Fetches public domain apocrypha text and writes electron/apocryphaVerses.ts
 * Run: npm run fetch-apocrypha
 *
 * Sources:
 *   KJV Apocrypha  — getBible API v2 (api.getbible.net/v2/kjva)
 *   1 Enoch        — scrollmapper/bible_databases_deuterocanonical (R.H. Charles style)
 *   Jubilees       — scrollmapper (R.H. Charles 1902)
 *   1-3 Meqabyan   — Wikisource community translation (CC BY-SA 3.0)
 */

import * as https from 'https'
import * as http from 'http'
import { writeFileSync } from 'fs'
import { join } from 'path'

interface Verse { book: string; chapter: number; verse: number; text: string }

function fetchUrl(url: string, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'BibleApp/1.0' } }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirects > 0) {
        return fetchUrl(res.headers.location, redirects - 1).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      let data = ''
      res.on('data', (chunk: string) => data += chunk)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
  })
}

async function fetchJson(url: string): Promise<any> {
  return JSON.parse(await fetchUrl(url))
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── getBible KJVA ─────────────────────────────────────────────────────────────
const GETBIBLE_BOOKS = [
  { name: '1 Esdras',           bookNr: 67, chapters: 9 },
  { name: '2 Esdras',           bookNr: 68, chapters: 16 },
  { name: 'Tobit',              bookNr: 69, chapters: 14 },
  { name: 'Judith',             bookNr: 70, chapters: 16 },
  { name: 'Wisdom of Solomon',  bookNr: 73, chapters: 19 },
  { name: 'Sirach',             bookNr: 74, chapters: 51 },
  { name: 'Baruch',             bookNr: 75, chapters: 6 },
  { name: 'Prayer of Azariah',  bookNr: 76, chapters: 1 },
  { name: 'Susanna',            bookNr: 77, chapters: 1 },
  { name: 'Bel and the Dragon', bookNr: 78, chapters: 1 },
  // Prayer of Manasseh: getBible returns only 1 merged verse; use baseline data instead
  { name: '1 Maccabees',        bookNr: 80, chapters: 16 },
  { name: '2 Maccabees',        bookNr: 81, chapters: 15 },
]

async function fetchGetBibleBook(name: string, bookNr: number, chapterCount: number): Promise<Verse[]> {
  const verses: Verse[] = []
  process.stdout.write(`  ${name}`)
  for (let ch = 1; ch <= chapterCount; ch++) {
    const url = `https://api.getbible.net/v2/kjva/${bookNr}/${ch}.json`
    try {
      const data = await fetchJson(url)
      for (const v of data.verses) {
        verses.push({ book: name, chapter: ch, verse: v.verse, text: v.text.trim() })
      }
      if (ch % 10 === 0) process.stdout.write('.')
    } catch (e: any) {
      console.error(`\n  ⚠ Failed ${name} ${ch}: ${e.message}`)
    }
    await sleep(60)
  }
  console.log(` → ${verses.length} verses`)
  return verses
}

// ── scrollmapper deuterocanonical ─────────────────────────────────────────────
const SCROLLMAPPER_BASE = 'https://raw.githubusercontent.com/scrollmapper/bible_databases_deuterocanonical/master/sources/en/'

const SCROLLMAPPER_BOOKS = [
  { name: '1 Enoch', path: '1-enoch/1-enoch.json' },
  { name: 'Jubilees', path: 'book-of-jubilees/book-of-jubilees.json' },
]

async function fetchScrollmapper(name: string, filePath: string): Promise<Verse[]> {
  console.log(`  ${name}`)
  const data = await fetchJson(SCROLLMAPPER_BASE + filePath)
  const verses: Verse[] = []
  const bookData = (data.books ?? [data])[0]
  for (const ch of bookData.chapters) {
    for (const v of ch.verses) {
      verses.push({ book: name, chapter: Number(ch.chapter), verse: Number(v.verse), text: String(v.text).trim() })
    }
  }
  console.log(`  → ${verses.length} verses`)
  return verses
}

// ── Wikisource Meqabyan ───────────────────────────────────────────────────────
function cleanWikitext(s: string): string {
  return s
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1') // [[link|label]] → label
    .replace(/\[\[[^\]]+\]\]/g, '')                    // bare [[links]]
    .replace(/'{2,}/g, '')                             // bold/italic marks
    .replace(/<[^>]+>/g, '')                           // HTML tags
    .replace(/\{\{[^}]+\}\}/g, '')                     // templates
    .replace(/\s+/g, ' ')
    .trim()
}

function parseWikisourceVerses(bookName: string, wikitext: string): Verse[] {
  const verses: Verse[] = []
  let chapter = 0

  for (const line of wikitext.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Chapter headings: ==Chapter N==, ==N==, or plain "Chapter N"
    const chMatch = trimmed.match(/^=+\s*(?:Chapter\s+)?(\d+)\s*=+\s*$/)
      ?? trimmed.match(/^Chapter\s+(\d+)\s*$/i)
    if (chMatch) { chapter = parseInt(chMatch[1]); continue }
    if (chapter === 0) continue

    // Verse formats (in priority order):
    //   1 Text...               (plain number prefix — Meqabyan style)
    //   [1] Text...
    //   '''1''' Text...   or   :'''1''' Text...
    const vMatch = trimmed.match(/^(\d+)\s+([A-Z].+)/)   // plain "N Text" (capital letter start)
      ?? trimmed.match(/^\[(\d+)\]\s*(.+)/)              // [N] Text
      ?? trimmed.match(/^:?'{2,}(\d+)'{2,}[.:)]\s*(.+)/) // '''N''' Text
    if (vMatch) {
      const num = parseInt(vMatch[1])
      const text = cleanWikitext(vMatch[2])
      if (text && num > 0) verses.push({ book: bookName, chapter, verse: num, text })
    }
  }
  return verses
}

async function fetchWikisource(bookName: string, pageTitle: string): Promise<Verse[]> {
  console.log(`  ${bookName}`)
  const apiBase = 'https://en.wikisource.org/w/api.php'

  // Fetch main page wikitext
  const mainUrl = `${apiBase}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`
  const mainData = await fetchJson(mainUrl)
  const mainWikitext: string = mainData.parse?.wikitext?.['*'] ?? ''

  // Check if content is on subpages (e.g. {{:Translation:1 Meqabyan/Chapter 1}})
  const subpageRe = /\{\{:?(Translation:[^/}]+\/Chapter\s*\d+)\}\}/gi
  const subpageMatches = Array.from(mainWikitext.matchAll(subpageRe))

  let allVerses: Verse[] = []

  if (subpageMatches.length > 0) {
    // Fetch each subpage
    for (const match of subpageMatches) {
      const subTitle = match[1].trim()
      try {
        const subUrl = `${apiBase}?action=parse&page=${encodeURIComponent(subTitle)}&prop=wikitext&format=json`
        const subData = await fetchJson(subUrl)
        const subWikitext: string = subData.parse?.wikitext?.['*'] ?? ''
        allVerses.push(...parseWikisourceVerses(bookName, subWikitext))
        await sleep(200)
      } catch(e: any) {
        console.error(`    ⚠ Failed subpage ${subTitle}: ${e.message}`)
      }
    }
  } else {
    // Content is inline
    allVerses = parseWikisourceVerses(bookName, mainWikitext)

    // If no verses found, try fetching chapter subpages directly
    if (allVerses.length === 0) {
      for (let ch = 1; ch <= 50; ch++) {
        const subTitle = `${pageTitle}/Chapter ${ch}`
        try {
          const subUrl = `${apiBase}?action=parse&page=${encodeURIComponent(subTitle)}&prop=wikitext&format=json`
          const subData = await fetchJson(subUrl)
          if (subData.error) break
          const subWikitext: string = subData.parse?.wikitext?.['*'] ?? ''
          const chVerses = parseWikisourceVerses(bookName, subWikitext)
          if (chVerses.length === 0) {
            // Try parsing directly numbered verses from subpage
            const lines = subWikitext.split('\n')
            for (const line of lines) {
              const m = line.match(/^\*+\s*(\d+)\s+(.+)/) ?? line.match(/^(\d+)\.\s+(.+)/)
              if (m) allVerses.push({ book: bookName, chapter: ch, verse: parseInt(m[1]), text: m[2].trim() })
            }
          } else {
            // Fix chapter numbers that might have been parsed from subpage headings
            for (const v of chVerses) {
              allVerses.push({ ...v, chapter: ch })
            }
          }
          await sleep(200)
        } catch { break }
      }
    }
  }

  console.log(`  → ${allVerses.length} verses`)
  return allVerses
}

// ── 3 & 4 Maccabees via getBible LXX ─────────────────────────────────────────
// LXX translation has III Maccabees (82) and IV Maccabees (83)
const LXX_EXTRA_BOOKS = [
  { name: '3 Maccabees', bookNr: 82, chapters: 7 },
  { name: '4 Maccabees', bookNr: 83, chapters: 18 },
]

async function fetchGetBibleLxx(name: string, bookNr: number, chapterCount: number): Promise<Verse[]> {
  const verses: Verse[] = []
  process.stdout.write(`  ${name}`)
  for (let ch = 1; ch <= chapterCount; ch++) {
    const url = `https://api.getbible.net/v2/lxx/${bookNr}/${ch}.json`
    try {
      const data = await fetchJson(url)
      if (!data.verses) break
      for (const v of data.verses) {
        // Strip Strong's numbers like <S>G1234</S> or {G1234} if present
        const text = v.text.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()
        verses.push({ book: name, chapter: ch, verse: v.verse, text })
      }
      if (ch % 5 === 0) process.stdout.write('.')
    } catch {
      // Chapter doesn't exist — stop
      break
    }
    await sleep(60)
  }
  console.log(` → ${verses.length} verses`)
  return verses
}

// ── Psalm 151 via scrollmapper ────────────────────────────────────────────────
async function fetchPsalm151(): Promise<Verse[]> {
  console.log('  Psalm 151')
  const data = await fetchJson(SCROLLMAPPER_BASE + 'five-psalms-of-david/five-psalms-of-david.json')
  const bookData = (data.books ?? [data])[0]
  // Chapter 1 = Psalm 151
  const ch = bookData.chapters[0]
  const verses = ch.verses.map((v: any) => ({
    book: 'Psalm 151', chapter: 1, verse: Number(v.verse), text: String(v.text).trim()
  }))
  console.log(`  → ${verses.length} verses`)
  return verses
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all: Verse[] = []

  console.log('\n=== KJV Apocrypha via getBible ===')
  for (const b of GETBIBLE_BOOKS) {
    all.push(...await fetchGetBibleBook(b.name, b.bookNr, b.chapters))
  }

  console.log('\n=== Psalm 151 via scrollmapper ===')
  all.push(...await fetchPsalm151())

  console.log('\n=== 1 Enoch & Jubilees via scrollmapper ===')
  for (const b of SCROLLMAPPER_BOOKS) {
    all.push(...await fetchScrollmapper(b.name, b.path))
  }

  console.log('\n=== 3 & 4 Maccabees via getBible LXX ===')
  for (const b of LXX_EXTRA_BOOKS) {
    all.push(...await fetchGetBibleLxx(b.name, b.bookNr, b.chapters))
  }

  console.log('\n=== 1-3 Meqabyan via Wikisource ===')
  all.push(...await fetchWikisource('1 Meqabyan', 'Translation:1 Meqabyan'))
  all.push(...await fetchWikisource('2 Meqabyan', 'Translation:2 Meqabyan'))
  all.push(...await fetchWikisource('3 Meqabyan', 'Translation:3 Meqabyan'))

  // Sort: book_order → chapter → verse
  // (order will be natural insertion order; sort for safety)
  all.sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse)

  // Write TypeScript file
  const bookCounts: Record<string, number> = {}
  for (const v of all) bookCounts[v.book] = (bookCounts[v.book] ?? 0) + 1

  const lines = [
    '// Auto-generated by data/fetch-apocrypha.ts — do not edit by hand',
    '// Run `npm run fetch-apocrypha` to regenerate',
    `// Generated: ${new Date().toISOString()}`,
    `// Total verses: ${all.length}`,
    '',
    'export interface ApocryphaVerseSeed { book: string; chapter: number; verse: number; text: string }',
    '',
    'export const APOCRYPHA_FETCHED_VERSES: ApocryphaVerseSeed[] = [',
  ]

  let currentBook = ''
  for (const v of all) {
    if (v.book !== currentBook) {
      lines.push(`  // ${v.book} (${bookCounts[v.book]} verses)`)
      currentBook = v.book
    }
    lines.push(`  { book: ${JSON.stringify(v.book)}, chapter: ${v.chapter}, verse: ${v.verse}, text: ${JSON.stringify(v.text)} },`)
  }
  lines.push(']')

  const outPath = join(__dirname, '../electron/apocryphaVerses.ts')
  writeFileSync(outPath, lines.join('\n') + '\n')

  console.log('\n=== Summary ===')
  for (const [book, count] of Object.entries(bookCounts)) {
    console.log(`  ${book}: ${count} verses`)
  }
  console.log(`\nTotal: ${all.length} verses`)
  console.log(`Written to: ${outPath}`)
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1) })
