/**
 * Downloads and parses Catena Aurea XML from CCEL for Matthew and Mark.
 * Run: npm run fetch-ccel
 * Outputs: data/raw/commentary-ccel.json
 */

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as cheerio from 'cheerio'

const OUT_PATH = path.join(__dirname, '../data/raw/commentary-ccel.json')

const FATHER_MAP: Record<string, { name: string; era: string; era_order: number; url: string }> = {
  'chrys':       { name: 'John Chrysostom',      era: '4th c.',      era_order: 4,  url: 'https://www.newadvent.org/fathers/2001.htm' },
  'aug':         { name: 'Augustine of Hippo',    era: '4th–5th c.',  era_order: 4,  url: 'https://www.newadvent.org/fathers/1301.htm' },
  'jerome':      { name: 'Jerome of Stridon',     era: '4th–5th c.',  era_order: 4,  url: 'https://www.newadvent.org/fathers/3009.htm' },
  'ambrose':     { name: 'Ambrose of Milan',      era: '4th c.',      era_order: 4,  url: 'https://www.newadvent.org/fathers/3401.htm' },
  'bede':        { name: 'Venerable Bede',        era: '7th–8th c.', era_order: 7,  url: 'https://www.newadvent.org/fathers/3508.htm' },
  'greg':        { name: 'Gregory the Great',     era: '6th–7th c.', era_order: 6,  url: 'https://www.newadvent.org/fathers/3601.htm' },
  'origen':      { name: 'Origen of Alexandria',  era: '3rd c.',      era_order: 3,  url: 'https://www.newadvent.org/fathers/1016.htm' },
  'cyril':       { name: 'Cyril of Alexandria',   era: '5th c.',      era_order: 5,  url: 'https://www.newadvent.org/fathers/2092.htm' },
  'hilary':      { name: 'Hilary of Poitiers',    era: '4th c.',      era_order: 4,  url: 'https://www.newadvent.org/fathers/3300.htm' },
  'rabanus':     { name: 'Rabanus Maurus',        era: '9th c.',      era_order: 9,  url: 'https://www.newadvent.org/cathen/12638b.htm' },
  'anselm':      { name: 'Anselm of Canterbury',  era: '11th–12th c.', era_order: 11, url: 'https://www.newadvent.org/cathen/01546d.htm' },
  'basil':       { name: 'Basil of Caesarea',     era: '4th c.',      era_order: 4,  url: 'https://www.newadvent.org/fathers/3201.htm' },
  'theoph':      { name: 'Theophylact of Ohrid',  era: '11th–12th c.', era_order: 11, url: 'https://www.newadvent.org/cathen/14626a.htm' },
  'remig':       { name: 'Remigius of Auxerre',   era: '9th c.',      era_order: 9,  url: 'https://www.newadvent.org/cathen/12764a.htm' },
  'leo':         { name: 'Leo the Great',         era: '5th c.',      era_order: 5,  url: 'https://www.newadvent.org/fathers/3601.htm' },
  'chrysolog':   { name: 'Peter Chrysologus',     era: '5th c.',      era_order: 5,  url: 'https://www.newadvent.org/fathers/3606.htm' },
  'john dam':    { name: 'John of Damascus',      era: '8th c.',      era_order: 8,  url: 'https://www.newadvent.org/fathers/3302.htm' },
}

function resolveFather(raw: string): { name: string; era: string; era_order: number; url: string } | null {
  const lower = raw.toLowerCase()
  for (const [key, val] of Object.entries(FATHER_MAP)) {
    if (lower.startsWith(key)) return val
  }
  // Fallback: if it looks like a proper name, keep it
  const cleaned = raw.trim().replace(/[,.:]+$/, '').trim()
  if (cleaned.length > 2 && /^[A-Z]/.test(cleaned) && !cleaned.includes('ed.') && !cleaned.includes('note')) {
    return { name: cleaned, era: 'Early Church', era_order: 5, url: 'https://www.newadvent.org/fathers/' }
  }
  return null
}

function parseOsisRef(osisRef: string): { book: string; chapter: number; verse: number } | null {
  const match = osisRef.match(/Bible:(\w+)\.(\d+)\.(\d+)/)
  if (!match) return null
  const bookMap: Record<string, string> = {
    'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John'
  }
  const book = bookMap[match[1]]
  if (!book) return null
  return { book, chapter: parseInt(match[2]), verse: parseInt(match[3]) }
}

function fetchXml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchXml(res.headers.location!).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function parseParagraph(text: string, verse: { book: string; chapter: number; verse: number }): any | null {
  const t = text.trim()
  if (t.length < 30) return null

  // Pattern: "FatherName[, work ref]: commentary text"
  // The Father attribution ends at the first colon that follows a name pattern
  const colonIdx = t.indexOf(':')
  if (colonIdx < 2 || colonIdx > 120) return null

  const rawFather = t.slice(0, colonIdx).trim()
  const commentary = t.slice(colonIdx + 1).trim()

  // Skip if it looks like a scripture ref or editor note
  if (rawFather.startsWith('[') || rawFather.toLowerCase().includes('ver.') || commentary.length < 20) return null

  const father = resolveFather(rawFather)
  if (!father) return null

  // Clean up editorial notes [ed. note: ...]
  const cleaned = commentary.replace(/\[ed\. note:[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 20) return null

  const excerpt = cleaned.length > 220 ? cleaned.slice(0, 217) + '…' : cleaned

  return {
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    father_name: father.name,
    father_era: father.era,
    father_era_order: father.era_order,
    excerpt,
    full_text: cleaned,
    source: `Catena Aurea on ${verse.book} ${verse.chapter}:${verse.verse} (Thomas Aquinas, tr. Whiston)`,
    source_url: father.url
  }
}

function parseXml(xml: string): any[] {
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: true })
  const entries: any[] = []
  let currentVerse: { book: string; chapter: number; verse: number } | null = null
  let currentBook = ''
  let currentChapter = 0

  // Walk every element in document order using a flat selector
  $('*').each((_, el) => {
    const tag = (el as any).name?.toLowerCase() || ''
    const $el = $(el)

    // scripCom marks chapter start (used in Mark format)
    if (tag === 'scripcom') {
      const osisRef = $el.attr('osisref') || $el.attr('osisRef') || ''
      const m = osisRef.match(/Bible:(\w+)\.(\d+)/)
      if (m) {
        const bookMap: Record<string, string> = {
          'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John'
        }
        currentBook = bookMap[m[1]] || m[1]
        currentChapter = parseInt(m[2])
      }
      return
    }

    if (tag !== 'p') return
    const cls = $el.attr('class') || ''

    if (cls.includes('scripture')) {
      // Matthew format: has <scripRef osisRef="Bible:Matt.1.1"> inside
      const scripRef = $el.find('scripref')
      const osisRef = scripRef.attr('osisref') || scripRef.attr('osisRef') || ''
      if (osisRef) {
        const parsed = parseOsisRef(osisRef)
        if (parsed) { currentVerse = parsed; return }
      }

      // Mark format: "Ver. N: ..." text in scripture paragraph
      if (currentBook && currentChapter) {
        const text = $el.text().trim()
        const verseMatch = text.match(/^Ver\.\s*(\d+)[:\.]/)
        if (verseMatch) {
          currentVerse = { book: currentBook, chapter: currentChapter, verse: parseInt(verseMatch[1]) }
        }
      }
    } else if (cls.includes('normal') && currentVerse) {
      const text = $el.text()
      const entry = parseParagraph(text, currentVerse)
      if (entry) entries.push(entry)
    }
  })

  return entries
}

async function main() {
  const sources = [
    { url: 'https://www.ccel.org/ccel/aquinas/catena1.xml', label: 'Matthew' },
    { url: 'https://www.ccel.org/ccel/aquinas/catena2.xml', label: 'Mark' },
  ]

  const allEntries: any[] = []

  for (const src of sources) {
    console.log(`Fetching Catena Aurea — ${src.label}...`)
    try {
      const xml = await fetchXml(src.url)
      console.log(`  Downloaded ${Math.round(xml.length / 1024)}KB`)
      const entries = parseXml(xml)
      console.log(`  Parsed ${entries.length} commentary entries`)

      // Show sample
      if (entries.length > 0) {
        const s = entries[0]
        console.log(`  Sample: ${s.book} ${s.chapter}:${s.verse} — ${s.father_name}`)
      }

      allEntries.push(...entries)
    } catch (err) {
      console.error(`  Failed:`, (err as Error).message)
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(allEntries, null, 2))
  console.log(`\nSaved ${allEntries.length} total entries → ${OUT_PATH}`)
}

main().catch(console.error)
