/**
 * Builds bible.db from raw source files in data/raw/
 * Run: npm run build-db
 */

import initSqlJs from 'sql.js'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const DB_PATH = join(__dirname, 'bible.db')
const RAW_DIR = join(__dirname, 'raw')

async function main() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`PRAGMA journal_mode = WAL;`)

  db.run(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      book_order INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commentary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      father_name TEXT NOT NULL,
      father_era TEXT NOT NULL,
      father_era_order INTEGER DEFAULT 0,
      excerpt TEXT NOT NULL,
      full_text TEXT NOT NULL,
      source TEXT DEFAULT '',
      source_url TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS cross_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_book TEXT NOT NULL,
      from_chapter INTEGER NOT NULL,
      from_verse INTEGER NOT NULL,
      to_book TEXT NOT NULL,
      to_chapter INTEGER NOT NULL,
      to_verse INTEGER NOT NULL,
      weight REAL DEFAULT 1.0
    );
    CREATE INDEX IF NOT EXISTS idx_verses_loc ON bible_verses(book, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_commentary_loc ON commentary(book, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_crossrefs_from ON cross_refs(from_book, from_chapter, from_verse);
  `)

  // Bible text
  const kjvPath = join(RAW_DIR, 'kjv.json')
  if (existsSync(kjvPath)) {
    console.log('Inserting Bible verses...')
    const verses = JSON.parse(readFileSync(kjvPath, 'utf-8'))
    const stmt = db.prepare(
      'INSERT INTO bible_verses (book, book_order, chapter, verse, text) VALUES (?, ?, ?, ?, ?)'
    )
    for (const r of verses) {
      stmt.run([r.book, r.book_order, r.chapter, r.verse, r.text])
    }
    stmt.free()
    console.log(`  Inserted ${verses.length} verses`)
  } else {
    console.warn('  kjv.json not found — skipping')
  }

  // Commentary — merge all sources
  const commentarySources = [
    { file: 'commentary.json', label: 'hand-curated' },
    { file: 'commentary-ccel.json', label: 'CCEL Catena Aurea' },
    { file: 'commentary-catenabible.json', label: 'catenabible.com' },
  ]

  const insertCommentary = db.prepare(`
    INSERT INTO commentary (book, chapter, verse, father_name, father_era, father_era_order, excerpt, full_text, source, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Deduplicate: same location+father+text start = truly duplicate quote
  const seen = new Set<string>()
  let totalInserted = 0

  for (const src of commentarySources) {
    const filePath = join(RAW_DIR, src.file)
    if (!existsSync(filePath)) {
      console.log(`  Skipping ${src.file} (not found)`)
      continue
    }
    const entries = JSON.parse(readFileSync(filePath, 'utf-8'))
    let count = 0
    for (const r of entries) {
      const textSnippet = (r.full_text ?? r.excerpt ?? '').slice(0, 60)
      const key = `${r.book}|${r.chapter}|${r.verse}|${r.father_name}|${textSnippet}`
      if (seen.has(key)) continue
      seen.add(key)
      insertCommentary.run([
        r.book, r.chapter, r.verse,
        r.father_name, r.father_era ?? 'Early Church', r.father_era_order ?? 5,
        r.excerpt ?? (r.full_text ?? '').slice(0, 200),
        r.full_text ?? r.excerpt ?? '',
        r.source ?? '', r.source_url ?? ''
      ])
      count++
    }
    console.log(`  ${src.label}: inserted ${count} entries`)
    totalInserted += count
  }
  insertCommentary.free()
  console.log(`  Total commentary: ${totalInserted} entries`)

  // OpenBible OSIS abbreviation → KJV full name
  const BOOK_MAP: Record<string, string> = {
    Gen: 'Genesis', Exod: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deut: 'Deuteronomy',
    Josh: 'Joshua', Judg: 'Judges', Ruth: 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
    '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles',
    Ezra: 'Ezra', Neh: 'Nehemiah', Esth: 'Esther', Job: 'Job', Ps: 'Psalms',
    Prov: 'Proverbs', Eccl: 'Ecclesiastes', Song: 'Song of Solomon', Isa: 'Isaiah',
    Jer: 'Jeremiah', Lam: 'Lamentations', Ezek: 'Ezekiel', Dan: 'Daniel', Hos: 'Hosea',
    Joel: 'Joel', Amos: 'Amos', Obad: 'Obadiah', Jonah: 'Jonah', Mic: 'Micah',
    Nah: 'Nahum', Hab: 'Habakkuk', Zeph: 'Zephaniah', Hag: 'Haggai', Zech: 'Zechariah',
    Mal: 'Malachi', Matt: 'Matthew', Mark: 'Mark', Luke: 'Luke', John: 'John',
    Acts: 'Acts', Rom: 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians',
    Gal: 'Galatians', Eph: 'Ephesians', Phil: 'Philippians', Col: 'Colossians',
    '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1Tim': '1 Timothy',
    '2Tim': '2 Timothy', Titus: 'Titus', Phlm: 'Philemon', Heb: 'Hebrews',
    Jas: 'James', '1Pet': '1 Peter', '2Pet': '2 Peter', '1John': '1 John',
    '2John': '2 John', '3John': '3 John', Jude: 'Jude', Rev: 'Revelation',
  }

  // Cross-references (OpenBible TSV)
  const crossRefPath = existsSync(join(RAW_DIR, 'cross_refs.txt'))
    ? join(RAW_DIR, 'cross_refs.txt')
    : join(RAW_DIR, 'cross_references.txt')
  if (existsSync(crossRefPath)) {
    console.log('Inserting cross-references...')
    const lines = readFileSync(crossRefPath, 'utf-8').split('\n').filter(l => l && !l.startsWith('#'))
    const stmt = db.prepare(
      'INSERT INTO cross_refs (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    let count = 0
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 3) continue
      const [fromRef, toRef, votes] = parts
      // Handle verse ranges (e.g. "Ps.89.11-Ps.89.12") — take only the first verse
      const [fb, fc, fv] = fromRef.split('.')
      const [tb, tc, tv] = toRef.split('.').map(p => p.split('-')[0])
      const fromChapter = parseInt(fc)
      const fromVerse = parseInt(fv)
      const toChapter = parseInt(tc)
      const toVerse = parseInt(tv)
      const fromBook = BOOK_MAP[fb] ?? fb
      const toBook = BOOK_MAP[tb] ?? tb
      if (!fromBook || !toBook || isNaN(fromChapter) || isNaN(fromVerse) || isNaN(toChapter) || isNaN(toVerse)) continue
      stmt.run([fromBook, fromChapter, fromVerse, toBook, toChapter, toVerse, parseFloat(votes) || 1])
      count++
    }
    stmt.free()
    console.log(`  Inserted ${count} cross-references`)
  } else {
    console.warn('  cross_refs.txt not found — skipping')
  }

  // Write to disk
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
  db.close()
  console.log(`\nDone! Database written to: ${DB_PATH}`)
}

main().catch(console.error)
