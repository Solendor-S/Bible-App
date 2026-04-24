/**
 * Builds bible.db from raw source files in data/raw/
 * Run: npm run build-db
 */

import initSqlJs from 'sql.js'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { HISTORICAL_CREATE_SQL, HISTORICAL_SOURCES, HISTORICAL_REFS } from '../electron/historicalData'
import { APOCRYPHA_CREATE_SQL, APOCRYPHA_BOOKS, APOCRYPHA_VERSES } from '../electron/apocryphaData'

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
    CREATE TABLE IF NOT EXISTS greek_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      position INTEGER NOT NULL,
      greek TEXT NOT NULL,
      translit TEXT NOT NULL,
      strongs TEXT NOT NULL,
      gloss TEXT
    );
    CREATE TABLE IF NOT EXISTS hebrew_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      position INTEGER NOT NULL,
      hebrew TEXT NOT NULL,
      translit TEXT NOT NULL,
      strongs TEXT NOT NULL,
      gloss TEXT
    );
    CREATE TABLE IF NOT EXISTS strongs_greek (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      translit TEXT,
      pronunciation TEXT,
      definition TEXT,
      kjv_usage TEXT
    );
    CREATE TABLE IF NOT EXISTS strongs_hebrew (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      translit TEXT,
      pronunciation TEXT,
      definition TEXT,
      kjv_usage TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_verses_loc ON bible_verses(book, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_commentary_loc ON commentary(book, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_crossrefs_from ON cross_refs(from_book, from_chapter, from_verse);
    CREATE INDEX IF NOT EXISTS idx_greek_loc ON greek_words(book, chapter, verse);
    CREATE INDEX IF NOT EXISTS idx_hebrew_loc ON hebrew_words(book, chapter, verse);
    CREATE TABLE IF NOT EXISTS josephus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work TEXT NOT NULL,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      section INTEGER NOT NULL,
      text TEXT NOT NULL,
      ref TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_josephus_loc ON josephus(work, book, chapter, section);
    CREATE TABLE IF NOT EXISTS josephus_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bible_book TEXT NOT NULL,
      bible_chapter INTEGER NOT NULL,
      bible_verse INTEGER NOT NULL,
      jos_work TEXT NOT NULL,
      jos_book INTEGER NOT NULL,
      jos_chapter INTEGER NOT NULL,
      jos_section INTEGER NOT NULL,
      ref TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_josephus_refs_loc ON josephus_refs(bible_book, bible_chapter, bible_verse);
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

  // Strong's Greek dictionary
  const strongsGreekPath = join(RAW_DIR, 'strongs-greek.json')
  if (existsSync(strongsGreekPath)) {
    console.log('Inserting Strong\'s Greek dictionary...')
    const dict = JSON.parse(readFileSync(strongsGreekPath, 'utf-8'))
    const stmt = db.prepare('INSERT OR REPLACE INTO strongs_greek (number, lemma, translit, pronunciation, definition, kjv_usage) VALUES (?, ?, ?, ?, ?, ?)')
    let count = 0
    for (const [key, val] of Object.entries(dict) as any) {
      stmt.run([key, val.lemma ?? '', val.translit ?? '', val.pronunciation ?? '', val.strongs_def ?? '', val.kjv_def ?? ''])
      count++
    }
    stmt.free()
    console.log(`  Inserted ${count} entries`)
  }

  // Strong's Hebrew dictionary
  const strongsHebPath = join(RAW_DIR, 'strongs-hebrew.json')
  if (existsSync(strongsHebPath)) {
    console.log('Inserting Strong\'s Hebrew dictionary...')
    const dict = JSON.parse(readFileSync(strongsHebPath, 'utf-8'))
    const stmt = db.prepare('INSERT OR REPLACE INTO strongs_hebrew (number, lemma, translit, pronunciation, definition, kjv_usage) VALUES (?, ?, ?, ?, ?, ?)')
    let count = 0
    for (const [key, val] of Object.entries(dict) as any) {
      stmt.run([key, val.lemma ?? '', val.translit ?? '', val.pronunciation ?? '', val.strongs_def ?? '', val.kjv_def ?? ''])
      count++
    }
    stmt.free()
    console.log(`  Inserted ${count} entries`)
  }

  // Greek NT words
  const ntWordsPath = join(RAW_DIR, 'nt-words.json')
  if (existsSync(ntWordsPath)) {
    console.log('Inserting Greek NT words...')
    const words = JSON.parse(readFileSync(ntWordsPath, 'utf-8'))
    const stmt = db.prepare('INSERT INTO greek_words (book, chapter, verse, position, greek, translit, strongs) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const w of words) {
      stmt.run([w.book, w.chapter, w.verse, w.position, w.greek, w.translit, w.strongs])
    }
    stmt.free()
    console.log(`  Inserted ${words.length} words`)
  }

  // OpenGNT per-word context-sensitive English glosses
  const ntGlossesPath = join(RAW_DIR, 'nt-glosses.json')
  if (existsSync(ntGlossesPath)) {
    console.log('Updating Greek words with OpenGNT glosses...')
    const glosses = JSON.parse(readFileSync(ntGlossesPath, 'utf-8'))
    const stmt = db.prepare('UPDATE greek_words SET gloss = ? WHERE book = ? AND chapter = ? AND verse = ? AND position = ?')
    let count = 0
    for (const g of glosses) {
      stmt.run([g.gloss, g.book, g.chapter, g.verse, g.position])
      count++
    }
    stmt.free()
    console.log(`  Updated ${count} word glosses`)
  }

  // Hebrew OT words
  const otWordsPath = join(RAW_DIR, 'ot-words.json')
  if (existsSync(otWordsPath)) {
    console.log('Inserting Hebrew OT words...')
    const words = JSON.parse(readFileSync(otWordsPath, 'utf-8'))
    const stmt = db.prepare('INSERT INTO hebrew_words (book, chapter, verse, position, hebrew, translit, strongs) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const w of words) {
      stmt.run([w.book, w.chapter, w.verse, w.position, w.hebrew, w.translit, w.strongs])
    }
    stmt.free()
    console.log(`  Inserted ${words.length} words`)
  }

  // Hebrew OT per-word context glosses (from STEP Bible TAHOT)
  const otGlossesPath = join(RAW_DIR, 'ot-glosses.json')
  if (existsSync(otGlossesPath)) {
    console.log('Updating Hebrew words with TAHOT glosses...')
    const glosses = JSON.parse(readFileSync(otGlossesPath, 'utf-8'))
    const stmt = db.prepare('UPDATE hebrew_words SET gloss = ? WHERE book = ? AND chapter = ? AND verse = ? AND position = ?')
    let count = 0
    for (const g of glosses) {
      stmt.run([g.gloss, g.book, g.chapter, g.verse, g.position])
      count++
    }
    stmt.free()
    console.log(`  Updated ${count} word glosses`)
  }

  // Josephus sections
  for (const josFile of ['josephus-antiquities.json', 'josephus-war.json']) {
    const josPath = join(RAW_DIR, josFile)
    if (existsSync(josPath)) {
      const label = josFile.includes('antiquities') ? 'Antiquities' : 'Jewish War'
      console.log(`Inserting Josephus ${label}...`)
      const sections = JSON.parse(readFileSync(josPath, 'utf-8'))
      const stmt = db.prepare('INSERT INTO josephus (work, book, chapter, section, text, ref) VALUES (?, ?, ?, ?, ?, ?)')
      for (const s of sections) {
        stmt.run([s.work, s.book, s.chapter, s.section, s.text, s.ref])
      }
      stmt.free()
      console.log(`  Inserted ${sections.length} sections`)
    }
  }

  // Josephus curated cross-reference map
  const josRefsPath = join(RAW_DIR, 'josephus-refs.json')
  if (existsSync(josRefsPath)) {
    console.log('Inserting Josephus curated refs...')
    const refs = JSON.parse(readFileSync(josRefsPath, 'utf-8'))
    const stmt = db.prepare(`INSERT INTO josephus_refs (bible_book, bible_chapter, bible_verse, jos_work, jos_book, jos_chapter, jos_section, ref, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const r of refs) {
      stmt.run([r.bible_book, r.bible_chapter, r.bible_verse, r.jos_work, r.jos_book, r.jos_chapter, r.jos_section, r.ref, r.note ?? ''])
    }
    stmt.free()
    console.log(`  Inserted ${refs.length} curated refs`)
  }

  // Historical sources (Tacitus, Pliny, archaeology, inscriptions, etc.)
  console.log('Inserting historical sources...')
  db.run(HISTORICAL_CREATE_SQL)
  const hSrcStmt = db.prepare(`
    INSERT OR IGNORE INTO historical_sources
      (source_key, title, category, author, date_desc, location, description, significance, citation, testament, sort_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const s of HISTORICAL_SOURCES) {
    hSrcStmt.run([s.source_key, s.title, s.category, s.author, s.date_desc, s.location, s.description, s.significance, s.citation, s.testament, s.sort_year])
  }
  hSrcStmt.free()
  const hRefStmt = db.prepare(`
    INSERT INTO historical_refs (bible_book, bible_chapter, bible_verse, source_key) VALUES (?, ?, ?, ?)
  `)
  for (const r of HISTORICAL_REFS) {
    hRefStmt.run([r.bible_book, r.bible_chapter, r.bible_verse, r.source_key])
  }
  hRefStmt.free()
  console.log(`  Inserted ${HISTORICAL_SOURCES.length} sources, ${HISTORICAL_REFS.length} refs`)

  // Apocrypha books and verses
  console.log('Inserting apocrypha metadata and verses...')
  db.run(APOCRYPHA_CREATE_SQL)
  const aBkStmt = db.prepare(`INSERT OR IGNORE INTO apocrypha_books (book, book_order, group_label, chapter_count) VALUES (?, ?, ?, ?)`)
  for (const b of APOCRYPHA_BOOKS) {
    aBkStmt.run([b.book, b.book_order, b.group_label, b.chapter_count])
  }
  aBkStmt.free()
  const aVStmt = db.prepare(`INSERT INTO apocrypha_verses (book, book_order, chapter, verse, text) VALUES (?, ?, ?, ?, ?)`)
  for (const v of APOCRYPHA_VERSES) {
    const bookOrder = APOCRYPHA_BOOKS.find(b => b.book === v.book)?.book_order ?? 99
    aVStmt.run([v.book, bookOrder, v.chapter, v.verse, v.text])
  }
  aVStmt.free()
  console.log(`  Inserted ${APOCRYPHA_BOOKS.length} books, ${APOCRYPHA_VERSES.length} verses`)

  // Write to disk
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
  db.close()
  console.log(`\nDone! Database written to: ${DB_PATH}`)
}

main().catch(console.error)
