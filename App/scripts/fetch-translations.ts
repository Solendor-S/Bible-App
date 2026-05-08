/**
 * Downloads ASV and WEB translations from scrollmapper/bible_databases
 * and inserts them into bible.db.
 * Run: npm run fetch-translations
 */

import initSqlJs from 'sql.js'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as https from 'https'

const DB_PATH = join(__dirname, '../data/bible.db')

// Book number (1-based) → canonical name matching bible_verses table
const BOOK_NAMES: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi',
  40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts',
  45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians', 48: 'Galatians',
  49: 'Ephesians', 50: 'Philippians', 51: 'Colossians',
  52: '1 Thessalonians', 53: '2 Thessalonians',
  54: '1 Timothy', 55: '2 Timothy', 56: 'Titus', 57: 'Philemon',
  58: 'Hebrews', 59: 'James', 60: '1 Peter', 61: '2 Peter',
  62: '1 John', 63: '2 John', 64: '3 John', 65: 'Jude', 66: 'Revelation',
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = (u: string) => {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location!); return
        }
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve(data))
      }).on('error', reject)
    }
    get(url)
  })
}

// Parse scrollmapper CSV: Book,Chapter,Verse,Text
function parseCsv(csv: string): { book: string; chapter: number; verse: number; text: string }[] {
  const lines = csv.split('\n')
  const result = []
  for (let i = 1; i < lines.length; i++) {  // skip header
    const line = lines[i].trim()
    if (!line) continue
    // Format: BookName,chapter,verse,text  (text may contain commas)
    const parts = line.split(',')
    const book    = parts[0].trim()
    const chapter = parseInt(parts[1])
    const verse   = parseInt(parts[2])
    const text    = parts.slice(3).join(',').trim()
    if (!book || isNaN(chapter) || isNaN(verse) || !text) continue
    result.push({ book, chapter, verse, text })
  }
  return result
}

const TRANSLATIONS: { key: string; url: string; format: 'scrollmapper-csv' | 'bolls-json' }[] = [
  {
    key: 'ASV',
    url: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/csv/ASV.csv',
    format: 'scrollmapper-csv',
  },
  {
    key: 'WEB',
    url: 'https://bolls.life/static/translations/WEB.json',
    format: 'bolls-json',
  },
]

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error('bible.db not found — run npm run build-db first')
    process.exit(1)
  }

  const SQL = await initSqlJs()
  const db = new SQL.Database(readFileSync(DB_PATH))

  db.run(`
    CREATE TABLE IF NOT EXISTS bible_translations (
      translation TEXT NOT NULL,
      book        TEXT NOT NULL,
      chapter     INTEGER NOT NULL,
      verse       INTEGER NOT NULL,
      text        TEXT NOT NULL,
      PRIMARY KEY (translation, book, chapter, verse)
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_btrans_bcv ON bible_translations(translation, book, chapter, verse)`)

  for (const t of TRANSLATIONS) {
    // Check if already populated
    const existing = db.exec(`SELECT COUNT(*) as n FROM bible_translations WHERE translation = '${t.key}'`)
    const count = existing[0]?.values[0]?.[0] as number ?? 0
    if (count > 0) {
      console.log(`${t.key}: already in DB (${count} verses) — skipping`)
      continue
    }

    console.log(`Downloading ${t.key}...`)
    const raw = await fetchText(t.url)

    type Row = { book: string; chapter: number; verse: number; text: string }
    let rows: Row[] = []

    if (t.format === 'scrollmapper-csv') {
      rows = parseCsv(raw)
    } else {
      // bolls-json: [{pk,translation,book,chapter,verse,text}] where book is 1-based number
      const arr: { book: number; chapter: number; verse: number; text: string }[] = JSON.parse(raw)
      for (const r of arr) {
        const bookName = BOOK_NAMES[r.book]
        if (!bookName) continue
        rows.push({ book: bookName, chapter: r.chapter, verse: r.verse, text: r.text })
      }
    }

    console.log(`  Parsed ${rows.length} verses`)

    const stmt = db.prepare(
      'INSERT OR REPLACE INTO bible_translations (translation, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)'
    )
    let inserted = 0
    for (const r of rows) {
      stmt.run([t.key, r.book, r.chapter, r.verse, r.text])
      inserted++
    }
    stmt.free()
    console.log(`  Inserted ${inserted} verses for ${t.key}`)
  }

  writeFileSync(DB_PATH, Buffer.from(db.export()))
  console.log('\nDone. Rebuild the Android DB copy:')
  console.log('  copy data\\bible.db ..\\..\\BibleAndroidApp\\assets\\db\\bible.db')
}

main().catch(err => { console.error(err); process.exit(1) })
