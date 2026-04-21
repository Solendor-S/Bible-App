/**
 * Downloads Josephus texts from Project Gutenberg and parses them into sections.
 * Run: npm run fetch-josephus
 * Outputs: data/raw/josephus-antiquities.json, data/raw/josephus-war.json
 */

import * as https from 'https'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const RAW_DIR = join(__dirname, '../data/raw')
mkdirSync(RAW_DIR, { recursive: true })

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BibleApp/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (loc) return fetchText(loc).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', (c: Buffer) => { data += c.toString() })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function fromRoman(s: string): number {
  const vals: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  const upper = s.toUpperCase()
  // If it's already a number, parse directly
  if (/^\d+$/.test(upper)) return parseInt(upper)
  let total = 0
  for (let i = 0; i < upper.length; i++) {
    const cur = vals[upper[i]] ?? 0
    const nxt = vals[upper[i + 1]] ?? 0
    total += cur < nxt ? -cur : cur
  }
  return total
}

interface JosephusSection {
  work: string
  book: number
  chapter: number
  section: number
  text: string
  ref: string
}

function parseJosephus(rawText: string, work: string, abbr: string): JosephusSection[] {
  // Strip Gutenberg header/footer
  const startIdx = rawText.indexOf('*** START OF')
  const endIdx = rawText.indexOf('*** END OF')
  const body = startIdx >= 0
    ? rawText.slice(rawText.indexOf('\n', startIdx) + 1, endIdx >= 0 ? endIdx : undefined)
    : rawText

  const sections: JosephusSection[] = []
  const paragraphs = body.split(/\r?\n[ \t]*\r?\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

  let book = 0, chapter = 0, section = 0
  let buf: string[] = []

  function flush() {
    if (section > 0 && book > 0 && buf.length > 0) {
      const text = buf.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 3000)
      sections.push({ work, book, chapter, section, text, ref: `${abbr} ${book}.${chapter}.${section}` })
    }
    buf = []
  }

  for (const para of paragraphs) {
    // Match "BOOK XIV." or "BOOK I. Containing..." (allow long subtitles after the numeral)
    const bookMatch = para.match(/^BOOK\s+([IVXLCDM\d]+)\.?(?:\s|$)/i)
    if (bookMatch) {
      flush(); book = fromRoman(bookMatch[1]); chapter = 0; section = 0
      continue
    }

    // Match "CHAPTER I." or "CHAPTER I" at start of paragraph
    const chapMatch = para.match(/^CHAPTER\s+([IVXLCDM\d]+)\.?(?:\s|$)/i)
    if (chapMatch) {
      flush(); chapter = fromRoman(chapMatch[1]); section = 0
      continue
    }

    // Section: paragraph starting with "1." or "23." followed by a word character
    const secMatch = para.match(/^(\d{1,3})\.\s+\w/)
    if (secMatch) {
      flush(); section = parseInt(secMatch[1])
      buf.push(para)
      continue
    }

    // Continuation text
    if (section > 0 && book > 0) {
      // Skip lines that look like chapter titles / descriptive headers (all caps, short)
      if (para.length < 120 && /^[A-Z\s,;\.'-]+$/.test(para)) continue
      buf.push(para)
    }
  }
  flush()

  return sections
}

async function main() {
  console.log('Fetching Antiquities of the Jews (Gutenberg pg2848)...')
  const antText = await fetchText('https://www.gutenberg.org/cache/epub/2848/pg2848.txt')
  const ant = parseJosephus(antText, 'Antiquities', 'Ant.')
  console.log(`  Parsed ${ant.length} sections`)
  writeFileSync(join(RAW_DIR, 'josephus-antiquities.json'), JSON.stringify(ant, null, 2))

  console.log('Fetching The Jewish War (Gutenberg pg2850)...')
  const warText = await fetchText('https://www.gutenberg.org/cache/epub/2850/pg2850.txt')
  const war = parseJosephus(warText, 'Jewish War', 'War')
  console.log(`  Parsed ${war.length} sections`)
  writeFileSync(join(RAW_DIR, 'josephus-war.json'), JSON.stringify(war, null, 2))

  console.log('\nDone! Files written to data/raw/')
  console.log('Next: npm run build-db')
}

main().catch(console.error)
