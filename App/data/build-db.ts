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

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface BiblehubPassage {
  verse_start: number
  verse_end: number
  heading: string
  text: string
}

function parseVerseRange(line: string): [number | null, number | null] {
  const m = line.match(/Verses?\s*(\d+)\s*[–—-]\s*(\d+)/)
  if (m) return [parseInt(m[1]), parseInt(m[2])]
  const m2 = line.match(/Verses?\s*(\d+)/)
  if (m2) return [parseInt(m2[1]), parseInt(m2[1])]
  return [null, null]
}

function parseHeading(line: string): string {
  const m = line.match(/Verses?\s*\d+\s*[–—-]\s*\d*\s*[–—]\s*(.+)/)
  if (m) return m[1].trim()
  const m2 = line.match(/Verses?\s*\d+\s*[–—-]?\s*\d*\s*[–—]?\s*(.*)/)
  if (m2) return m2[1].trim().replace(/^[–—-]\s*/, '')
  return line.trim()
}

function splitBiblehubSummary(summary: string): { passages: BiblehubPassage[]; essay: string } {
  const paragraphs = summary.split('\n\n').map(p => p.trim()).filter(Boolean)
  const passages: BiblehubPassage[] = []
  let essayParas: string[] = []
  let seenVerses = false
  let i = 0

  while (i < paragraphs.length) {
    const para = paragraphs[i]
    const firstLine = para.split('\n')[0].trim()
    const isVerse = /^Verses?\s*\d+/.test(firstLine)

    if (isVerse) {
      seenVerses = true
      const [vs, ve] = parseVerseRange(firstLine)
      const heading = parseHeading(firstLine)
      const inlineBody = para.split('\n').slice(1).join('\n').trim()
      let body = inlineBody
      if (!body && i + 1 < paragraphs.length) {
        const nxt = paragraphs[i + 1]
        if (!/^Verses?\s*\d+/.test(nxt.split('\n')[0].trim())) {
          body = nxt
          i++
        }
      }
      passages.push({ verse_start: vs ?? 1, verse_end: ve ?? vs ?? 1, heading, text: body })
    } else {
      if (seenVerses) {
        essayParas = paragraphs.slice(i)
        break
      } else {
        essayParas.push(para)
      }
    }
    i++
  }

  // The thematic essay is concatenated directly onto the last passage body (no \n\n separator
  // because <p> tags are stripped without adding paragraph breaks). Split at the boundary:
  // a period immediately followed by a capital letter signals where the essay begins.
  if (passages.length > 0) {
    const fullText = passages[passages.length - 1].text
    if (fullText.length > 300) {
      const m = fullText.match(/(?<![\"'])\.[A-Z]/)
      if (m && m.index !== undefined) {
        const splitPos = m.index + 1
        passages[passages.length - 1].text = fullText.slice(0, splitPos).trim()
        const remainder = fullText.slice(splitPos).trim()
        if (remainder) essayParas = [remainder, ...essayParas]
      }
    }
  }

  return { passages, essay: essayParas.join('\n\n') }
}

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
      gloss TEXT,
      morph TEXT
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
      gloss TEXT,
      morph TEXT
    );
    CREATE TABLE IF NOT EXISTS strongs_greek (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      translit TEXT,
      pronunciation TEXT,
      definition TEXT,
      kjv_usage TEXT
    );
    CREATE TABLE IF NOT EXISTS bsb_strongs_map (
      bsb_num TEXT PRIMARY KEY,
      standard_num TEXT NOT NULL
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
    CREATE TABLE IF NOT EXISTS textual_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      testament TEXT NOT NULL,
      word_ref TEXT DEFAULT '',
      main_type TEXT DEFAULT '',
      main_english TEXT DEFAULT '',
      main_hebrew TEXT DEFAULT '',
      variant_source TEXT NOT NULL,
      variant_source_label TEXT NOT NULL,
      variant_english TEXT DEFAULT '',
      variant_hebrew TEXT DEFAULT '',
      description TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_variants_loc ON textual_variants(book, chapter, verse);
    CREATE TABLE IF NOT EXISTS thayers_greek (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      translit TEXT,
      pronunciation TEXT,
      part_of_speech TEXT,
      strongs_def TEXT,
      outline TEXT,
      thayers_text TEXT,
      kjv_translations TEXT
    );
    CREATE TABLE IF NOT EXISTS bdb_hebrew (
      number TEXT PRIMARY KEY,
      lemma TEXT,
      translit TEXT,
      pronunciation TEXT,
      part_of_speech TEXT,
      strongs_def TEXT,
      outline TEXT,
      bdb_text TEXT,
      kjv_translations TEXT
    );
    CREATE TABLE IF NOT EXISTS overview_verses (
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      note TEXT,
      PRIMARY KEY (book, chapter, verse)
    );
    CREATE TABLE IF NOT EXISTS overview_chapters (
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      themes TEXT,
      summary TEXT,
      PRIMARY KEY (book, chapter)
    );
    CREATE TABLE IF NOT EXISTS overview_pericopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse_start INTEGER NOT NULL,
      verse_end INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pericopes_loc ON overview_pericopes(book, chapter, verse_start);
    CREATE TABLE IF NOT EXISTS biblehub_chapters (
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      passages TEXT,
      essay TEXT,
      PRIMARY KEY (book, chapter)
    );
    CREATE TABLE IF NOT EXISTS biblesummary_chapters (
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      summary TEXT,
      PRIMARY KEY (book, chapter)
    );
    CREATE TABLE IF NOT EXISTS verse_footnotes (
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      marker TEXT NOT NULL,
      word_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (book, chapter, verse, marker)
    );
    CREATE TABLE IF NOT EXISTS lxx_words (
      book     TEXT    NOT NULL,
      chapter  INTEGER NOT NULL,
      verse    INTEGER NOT NULL,
      position INTEGER NOT NULL,
      greek    TEXT    NOT NULL,
      translit TEXT,
      strongs  TEXT,
      gloss    TEXT,
      morph    TEXT,
      greek_norm TEXT,
      PRIMARY KEY (book, chapter, verse, position)
    );
    CREATE INDEX IF NOT EXISTS idx_lxx_words_greek_norm ON lxx_words(greek_norm);
    CREATE TABLE IF NOT EXISTS lxx_a_words (
      book     TEXT    NOT NULL,
      chapter  INTEGER NOT NULL,
      verse    INTEGER NOT NULL,
      position INTEGER NOT NULL,
      greek    TEXT    NOT NULL,
      translit TEXT,
      strongs  TEXT,
      gloss    TEXT,
      morph    TEXT,
      greek_norm TEXT,
      PRIMARY KEY (book, chapter, verse, position)
    );
    CREATE INDEX IF NOT EXISTS idx_lxx_a_words_greek_norm ON lxx_a_words(greek_norm);
    CREATE TABLE IF NOT EXISTS wlc_words (
      book     TEXT    NOT NULL,
      chapter  INTEGER NOT NULL,
      verse    INTEGER NOT NULL,
      position INTEGER NOT NULL,
      hebrew   TEXT    NOT NULL,
      translit TEXT,
      strongs  TEXT,
      gloss    TEXT,
      morph    TEXT,
      PRIMARY KEY (book, chapter, verse, position)
    );
    CREATE TABLE IF NOT EXISTS dss_words (
      book     TEXT    NOT NULL,
      chapter  INTEGER NOT NULL,
      verse    INTEGER NOT NULL,
      position INTEGER NOT NULL,
      hebrew   TEXT    NOT NULL,
      translit TEXT,
      strongs  TEXT,
      gloss    TEXT,
      morph    TEXT,
      PRIMARY KEY (book, chapter, verse, position)
    );
    CREATE TABLE IF NOT EXISTS early_texts (
      book    TEXT    NOT NULL,
      chapter INTEGER NOT NULL,
      verse   INTEGER NOT NULL,
      text    TEXT    NOT NULL,
      PRIMARY KEY (book, chapter, verse)
    );
    CREATE TABLE IF NOT EXISTS early_text_footnotes (
      book    TEXT    NOT NULL,
      chapter INTEGER NOT NULL,
      marker  INTEGER NOT NULL,
      note    TEXT    NOT NULL,
      PRIMARY KEY (book, chapter, marker)
    );
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
    const stmt = db.prepare('INSERT INTO greek_words (book, chapter, verse, position, greek, translit, strongs, morph) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const w of words) {
      stmt.run([w.book, w.chapter, w.verse, w.position, w.greek, w.translit, w.strongs, w.morph ?? ''])
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
    const stmt = db.prepare('INSERT INTO hebrew_words (book, chapter, verse, position, hebrew, translit, strongs, morph) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const w of words) {
      stmt.run([w.book, w.chapter, w.verse, w.position, w.hebrew, w.translit, w.strongs, w.morph ?? ''])
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

  // OT textual variants (from TAHOT Qere/Ketiv, DSS, LXX, etc.)
  const otVariantsPath = join(RAW_DIR, 'ot-variants.json')
  if (existsSync(otVariantsPath)) {
    console.log('Inserting OT textual variants...')
    const variants = JSON.parse(readFileSync(otVariantsPath, 'utf-8'))
    const stmt = db.prepare(`
      INSERT INTO textual_variants
        (book, chapter, verse, testament, word_ref, main_type, main_english, main_hebrew,
         variant_source, variant_source_label, variant_english, variant_hebrew, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const v of variants) {
      stmt.run([
        v.book, v.chapter, v.verse, 'ot',
        v.word_ref ?? '', v.main_type ?? '', v.main_english ?? '', v.main_hebrew ?? '',
        v.variant_source, v.variant_source_label,
        v.variant_english ?? '', v.variant_hebrew ?? '', v.description ?? ''
      ])
    }
    stmt.free()
    console.log(`  Inserted ${variants.length} OT variants`)
  } else {
    console.warn('  ot-variants.json not found — run scripts/extract-tahot-variants.py')
  }

  // NT textual variants (from SBLGNT apparatus: WH, Treg, NIV, RP comparisons)
  const ntVariantsPath = join(RAW_DIR, 'nt-variants.json')
  if (existsSync(ntVariantsPath)) {
    console.log('Inserting NT textual variants...')
    const variants = JSON.parse(readFileSync(ntVariantsPath, 'utf-8'))
    const stmt = db.prepare(`
      INSERT INTO textual_variants
        (book, chapter, verse, testament, word_ref, main_type, main_english, main_hebrew,
         variant_source, variant_source_label, variant_english, variant_hebrew, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const v of variants) {
      stmt.run([
        v.book, v.chapter, v.verse, 'nt',
        v.word_ref ?? '', v.main_type ?? '', v.main_english ?? '', v.main_hebrew ?? '',
        v.variant_source, v.variant_source_label,
        v.variant_english ?? '', v.variant_hebrew ?? '', v.description ?? ''
      ])
    }
    stmt.free()
    console.log(`  Inserted ${variants.length} NT variants`)
  } else {
    console.warn('  nt-variants.json not found — run scripts/fetch-sblgnt-apparatus.py')
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

  // Thayer's Greek Lexicon
  const thayersPath = join(RAW_DIR, 'thayers-greek.json')
  if (existsSync(thayersPath)) {
    console.log('Inserting Thayer\'s Greek Lexicon...')
    const entries = JSON.parse(readFileSync(thayersPath, 'utf-8'))
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO thayers_greek
        (number, lemma, translit, pronunciation, part_of_speech, strongs_def, outline, thayers_text, kjv_translations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const e of entries) {
      stmt.run([e.number, e.lemma ?? '', e.translit ?? '', e.pronunciation ?? '',
        e.part_of_speech ?? '', e.strongs_def ?? '', e.outline ?? '',
        e.thayers_text ?? '', e.kjv_translations ?? ''])
    }
    stmt.free()
    console.log(`  Inserted ${entries.length} Thayer's entries`)
  } else {
    console.warn('  thayers-greek.json not found — run scripts/scrape-blb-lexicons.py --greek')
  }

  // BDB Hebrew Lexicon
  const bdbPath = join(RAW_DIR, 'bdb-hebrew.json')
  if (existsSync(bdbPath)) {
    console.log('Inserting BDB Hebrew Lexicon...')
    const entries = JSON.parse(readFileSync(bdbPath, 'utf-8'))
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bdb_hebrew
        (number, lemma, translit, pronunciation, part_of_speech, strongs_def, outline, bdb_text, kjv_translations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const e of entries) {
      stmt.run([e.number, e.lemma ?? '', e.translit ?? '', e.pronunciation ?? '',
        e.part_of_speech ?? '', e.strongs_def ?? '', e.outline ?? '',
        e.thayers_text ?? '', e.kjv_translations ?? ''])
    }
    stmt.free()
    console.log(`  Inserted ${entries.length} BDB entries`)
  } else {
    console.warn('  bdb-hebrew.json not found — run scripts/scrape-blb-lexicons.py --hebrew')
  }

  // bibleref.com Overview — verse notes
  const brVersesPath = join(RAW_DIR, 'bibleref-verses.json')
  if (existsSync(brVersesPath)) {
    console.log('Inserting bibleref verse notes...')
    const brVerses = JSON.parse(readFileSync(brVersesPath, 'utf-8'))
    const vStmt = db.prepare(`
      INSERT OR REPLACE INTO overview_verses (book, chapter, verse, note)
      VALUES (?, ?, ?, ?)
    `)
    const pStmt = db.prepare(`
      INSERT OR IGNORE INTO overview_pericopes (book, chapter, verse_start, verse_end, title, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const seenPericopes = new Set<string>()
    for (const e of brVerses) {
      vStmt.run([e.book, e.chapter, e.verse, e.note ?? ''])
      if (e.pericope_verse_start != null && e.pericope_verse_end != null) {
        const pk = `${e.book}:${e.chapter}:${e.pericope_verse_start}:${e.pericope_verse_end}`
        if (!seenPericopes.has(pk)) {
          seenPericopes.add(pk)
          pStmt.run([e.book, e.chapter, e.pericope_verse_start, e.pericope_verse_end,
            e.pericope_title ?? '', e.pericope_desc ?? ''])
        }
      }
    }
    vStmt.free()
    pStmt.free()
    console.log(`  Inserted ${brVerses.length} verse notes, ${seenPericopes.size} pericopes`)
  } else {
    console.warn('  bibleref-verses.json not found — run scripts/scrape-bibleref.py')
  }

  // bibleref.com Overview — chapter summaries + Nave's themes
  const brChaptersPath = join(RAW_DIR, 'bibleref-chapters.json')
  if (existsSync(brChaptersPath)) {
    console.log('Inserting bibleref chapter summaries + computing themes...')
    const brChapters = JSON.parse(readFileSync(brChaptersPath, 'utf-8'))
    const cStmt = db.prepare(`
      INSERT OR REPLACE INTO overview_chapters (book, chapter, themes, summary)
      VALUES (?, ?, ?, ?)
    `)
    for (const e of brChapters) {
      let themes: string[] = []
      try {
        const themeRows = db.prepare(`
          SELECT nt.name FROM naves_refs nr
          JOIN naves_topics nt ON nr.topic_id = nt.id
          WHERE nr.book = ? AND nr.chapter = ?
          GROUP BY nt.name ORDER BY COUNT(*) DESC LIMIT 5
        `)
        themeRows.bind([e.book, e.chapter])
        while (themeRows.step()) {
          const row = themeRows.getAsObject() as any
          themes.push(row.name)
        }
        themeRows.free()
      } catch { /* naves_refs not yet populated — themes stay empty */ }
      cStmt.run([e.book, e.chapter, JSON.stringify(themes), e.summary ?? ''])
    }
    cStmt.free()
    console.log(`  Inserted ${brChapters.length} chapter entries`)
  } else {
    console.warn('  bibleref-chapters.json not found — run scripts/scrape-bibleref.py')
  }

  // BibleHub chapter summaries — split into passage entries (for Context scope) + thematic essay (for Chapter scope)
  const biblehubPath = join(RAW_DIR, 'biblehub-chapters.json')
  if (existsSync(biblehubPath)) {
    console.log('Inserting BibleHub chapter summaries...')
    const entries = JSON.parse(readFileSync(biblehubPath, 'utf-8'))
    const stmt = db.prepare('INSERT OR REPLACE INTO biblehub_chapters (book, chapter, passages, essay) VALUES (?, ?, ?, ?)')
    for (const e of entries) {
      const { passages, essay } = splitBiblehubSummary(e.summary ?? '')
      stmt.run([e.book, e.chapter, JSON.stringify(passages), essay])
    }
    stmt.free()
    console.log(`  Inserted ${entries.length} BibleHub chapters`)
  } else {
    console.warn('  biblehub-chapters.json not found — run scripts/scrape-biblehub.py')
  }

  // BibleSummary short chapter summaries
  const biblesummaryPath = join(RAW_DIR, 'biblesummary-chapters.json')
  if (existsSync(biblesummaryPath)) {
    console.log('Inserting BibleSummary chapter summaries...')
    const entries = JSON.parse(readFileSync(biblesummaryPath, 'utf-8'))
    const stmt = db.prepare('INSERT OR REPLACE INTO biblesummary_chapters (book, chapter, summary) VALUES (?, ?, ?)')
    for (const e of entries) stmt.run([e.book, e.chapter, e.summary ?? ''])
    stmt.free()
    console.log(`  Inserted ${entries.length} BibleSummary chapters`)
  } else {
    console.warn('  biblesummary-chapters.json not found — run scripts/scrape-biblesummary.py')
  }

  // KJV marginal notes (translator footnotes)
  const kjvNotesPath = join(RAW_DIR, 'kjv-footnotes.json')
  if (existsSync(kjvNotesPath)) {
    console.log('Inserting KJV marginal notes...')
    const notes = JSON.parse(readFileSync(kjvNotesPath, 'utf-8'))
    const fnStmt = db.prepare(
      'INSERT OR REPLACE INTO verse_footnotes (book, chapter, verse, marker, word_index, content) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const n of notes) {
      fnStmt.run([n.book, n.chapter, n.verse, n.marker, n.word_index, n.content])
    }
    fnStmt.free()
    console.log(`  Inserted ${notes.length} footnote records`)
  } else {
    console.warn('  kjv-footnotes.json not found — run: npm run fetch-kjv-notes')
  }

  // BSB extended Strong's → standard Strong's mapping
  // Strips diacritics in TypeScript (SQLite LIKE can't handle polytonic Greek) to
  // prefix-match BSB surface forms (G5625+) against standard lemmas, scoring by gloss overlap.
  console.log('Building BSB extended Strong\'s map...')
  const extRes = db.exec(`SELECT DISTINCT strongs FROM greek_words WHERE CAST(REPLACE(strongs,'G','') AS INTEGER) > 5624`)
  if (extRes.length && extRes[0].values.length) {
    const sgRes = db.exec(`SELECT number, lemma, kjv_usage FROM strongs_greek WHERE lemma IS NOT NULL AND lemma != '' AND CAST(REPLACE(number,'G','') AS INTEGER) <= 5624`)
    const stdEntries: Array<{num: string; stripped: string; kjv: string}> = sgRes.length
      ? (sgRes[0].values as any[][]).map(([num, lemma, kjv]) => ({
          num: num as string,
          stripped: stripDiacritics(lemma as string),
          kjv: ((kjv as string) || '').toLowerCase()
        }))
      : []
    const mapStmt = db.prepare('INSERT OR REPLACE INTO bsb_strongs_map (bsb_num, standard_num) VALUES (?, ?)')
    const fStmt = db.prepare('SELECT DISTINCT greek, gloss FROM greek_words WHERE strongs = ? AND greek IS NOT NULL')
    let mapped = 0
    for (const [bsbNum] of extRes[0].values as any[][]) {
      fStmt.bind([bsbNum as string])
      const formData: Array<{strippedPfx: string; gloss: string}> = []
      while (fStmt.step()) {
        const row = fStmt.getAsObject() as any
        const strippedPfx = stripDiacritics(row.greek as string).slice(0, 3)
        if (strippedPfx.length >= 2) formData.push({ strippedPfx, gloss: ((row.gloss as string) || '').toLowerCase() })
      }
      fStmt.reset()
      if (!formData.length) continue
      const rawGloss = formData.find(f => f.gloss)?.gloss ?? ''
      const glossWords = rawGloss.split(/\s+/).filter(w => w.length > 2)
      let best: string | null = null
      let bestScore = -Infinity
      for (const { num, stripped, kjv } of stdEntries) {
        if (!formData.some(f => stripped.startsWith(f.strippedPfx))) continue
        const glossScore = glossWords.filter(w =>
          kjv.includes(w) || (w.endsWith('s') && w.length > 3 && kjv.includes(w.slice(0, -1)))
        ).length
        const total = glossScore * 10000 - parseInt(num.replace(/\D/g, ''), 10)
        if (total > bestScore) { bestScore = total; best = num }
      }
      if (best) { mapStmt.run([bsbNum, best]); mapped++ }
    }
    fStmt.free()
    mapStmt.free()
    console.log(`  Mapped ${mapped} / ${extRes[0].values.length} BSB extended numbers`)
  }

  // Write to disk
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
  db.close()
  console.log(`\nDone! Database written to: ${DB_PATH}`)
}

main().catch(console.error)
