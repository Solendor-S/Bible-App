/**
 * Fetches commentary from catenabible.com's API directly.
 * Endpoint discovered via JS bundle analysis: /anc_com/c/{book}/{chapter}/{verse}?tags=["ALL"]
 * Run: npm run fetch-catenabible-api
 * Outputs: data/raw/commentary-catenabible.json
 */

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'

const API_BASE = 'https://api.catenabible.com:8080'
const OUT_PATH = path.join(__dirname, '../data/raw/commentary-catenabible.json')
const PROGRESS_PATH = path.join(__dirname, '../data/raw/catenabible-api-progress.json')

// Book abbreviations extracted from catenabible.com JS bundle
const BOOKS: Array<{ abbr: string; name: string; chapters: number }> = [
  { abbr: 'gn',   name: 'Genesis',          chapters: 50 },
  { abbr: 'ex',   name: 'Exodus',           chapters: 40 },
  { abbr: 'lv',   name: 'Leviticus',        chapters: 27 },
  { abbr: 'nm',   name: 'Numbers',          chapters: 36 },
  { abbr: 'dt',   name: 'Deuteronomy',      chapters: 34 },
  { abbr: 'jo',   name: 'Joshua',           chapters: 24 },
  { abbr: 'jgs',  name: 'Judges',           chapters: 21 },
  { abbr: 'ru',   name: 'Ruth',             chapters: 4  },
  { abbr: '1sm',  name: '1 Samuel',         chapters: 31 },
  { abbr: '2sm',  name: '2 Samuel',         chapters: 24 },
  { abbr: '1kgs', name: '1 Kings',          chapters: 22 },
  { abbr: '2kgs', name: '2 Kings',          chapters: 25 },
  { abbr: '1chr', name: '1 Chronicles',     chapters: 29 },
  { abbr: '2chr', name: '2 Chronicles',     chapters: 36 },
  { abbr: 'ezr',  name: 'Ezra',             chapters: 10 },
  { abbr: 'neh',  name: 'Nehemiah',         chapters: 13 },
  { abbr: 'est',  name: 'Esther',           chapters: 10 },
  { abbr: 'ps',   name: 'Psalms',           chapters: 150 },
  { abbr: 'jb',   name: 'Job',              chapters: 42 },
  { abbr: 'prv',  name: 'Proverbs',         chapters: 31 },
  { abbr: 'eccl', name: 'Ecclesiastes',     chapters: 12 },
  { abbr: 'sg',   name: 'Song of Solomon',  chapters: 8  },
  { abbr: 'is',   name: 'Isaiah',           chapters: 66 },
  { abbr: 'jer',  name: 'Jeremiah',         chapters: 52 },
  { abbr: 'lam',  name: 'Lamentations',     chapters: 5  },
  { abbr: 'ez',   name: 'Ezekiel',          chapters: 48 },
  { abbr: 'dn',   name: 'Daniel',           chapters: 12 },
  { abbr: 'hos',  name: 'Hosea',            chapters: 14 },
  { abbr: 'jl',   name: 'Joel',             chapters: 3  },
  { abbr: 'am',   name: 'Amos',             chapters: 9  },
  { abbr: 'ob',   name: 'Obadiah',          chapters: 1  },
  { abbr: 'jon',  name: 'Jonah',            chapters: 4  },
  { abbr: 'mi',   name: 'Micah',            chapters: 7  },
  { abbr: 'na',   name: 'Nahum',            chapters: 3  },
  { abbr: 'hb',   name: 'Habakkuk',         chapters: 3  },
  { abbr: 'zep',  name: 'Zephaniah',        chapters: 3  },
  { abbr: 'hg',   name: 'Haggai',           chapters: 2  },
  { abbr: 'zec',  name: 'Zechariah',        chapters: 14 },
  { abbr: 'mal',  name: 'Malachi',          chapters: 4  },
  { abbr: 'mt',   name: 'Matthew',          chapters: 28 },
  { abbr: 'mk',   name: 'Mark',             chapters: 16 },
  { abbr: 'lk',   name: 'Luke',             chapters: 24 },
  { abbr: 'jn',   name: 'John',             chapters: 21 },
  { abbr: 'acts',  name: 'Acts',             chapters: 28 },
  { abbr: 'rom',   name: 'Romans',           chapters: 16 },
  { abbr: '1cor',  name: '1 Corinthians',    chapters: 16 },
  { abbr: '2cor',  name: '2 Corinthians',    chapters: 13 },
  { abbr: 'gal',   name: 'Galatians',        chapters: 6  },
  { abbr: 'eph',   name: 'Ephesians',        chapters: 6  },
  { abbr: 'phil',  name: 'Philippians',      chapters: 4  },
  { abbr: 'col',   name: 'Colossians',       chapters: 4  },
  { abbr: '1thes', name: '1 Thessalonians',  chapters: 5  },
  { abbr: '2thes', name: '2 Thessalonians',  chapters: 3  },
  { abbr: '1tm',   name: '1 Timothy',        chapters: 6  },
  { abbr: '2tm',   name: '2 Timothy',        chapters: 4  },
  { abbr: 'ti',    name: 'Titus',            chapters: 3  },
  { abbr: 'phlm',  name: 'Philemon',         chapters: 1  },
  { abbr: 'heb',   name: 'Hebrews',          chapters: 13 },
  { abbr: 'jas',   name: 'James',            chapters: 5  },
  { abbr: '1pt',   name: '1 Peter',          chapters: 5  },
  { abbr: '2pt',   name: '2 Peter',          chapters: 3  },
  { abbr: '1jn',   name: '1 John',           chapters: 5  },
  { abbr: '2jn',   name: '2 John',           chapters: 1  },
  { abbr: '3jn',   name: '3 John',           chapters: 1  },
  { abbr: 'jude',  name: 'Jude',             chapters: 1  },
  { abbr: 'rv',    name: 'Revelation',       chapters: 22 },
]

// Verse counts per chapter (from catenabible.com JS bundle)
const VERSES_PER_CHAPTER: Record<string, number[]> = {
  mt: [0,25,23,17,25,48,31,40,25,36,32,22,21,29,36,33,22,44,25,26,16,26,26,27,27,28,27,24,27],
  mk: [0,45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
  lk: [0,80,56,38,42,44,35,39,40,46,42,46,36,52,36,30,36,30,44,40,45,26,34,35,46],
  jn: [0,51,36,36,27,25,19,27,53,42,35,35,38,50,38,35,18,26,36,40,22,41,46],
  acts:[0,26,47,47,37,20,32,22,46,45,44,50,42,19,39,43,49,29,30,26,21,35,38,32,32,28,27,34,38],
  rom: [0,32,29,31,25,21,23,25,39,33,21,36,21,14,26,33,24],
  gal: [0,24,21,29,31,26,18],
  eph: [0,23,23,23,24,23,24],
  phil:[0,30,23,21,23],
  col: [0,29,23,25,18],
  '1cor':[0,31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24],
  '2cor':[0,24,17,18,18,21,18,16,24,15,18,33,21,14],
  '1thes':[0,10,20,13,18,28],
  '2thes':[0,12,17,18],
  '1tm': [0,20,15,16,16,25,21],
  '2tm': [0,18,26,17,22],
  ti:   [0,16,15,15],
  phlm: [0,25],
  heb:  [0,14,18,19,16,14,20,28,13,28,39,40,29,25],
  jas:  [0,27,26,18,17,20],
  '1pt':[0,25,25,22,19,14],
  '2pt':[0,21,22,18],
  '1jn':[0,10,29,24,21,21],
  '2jn':[0,13],
  '3jn':[0,14],
  jude: [0,25],
  rv:   [0,20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21],
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.catenabible.com',
        'Referer': 'https://www.catenabible.com/'
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location!).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', reject)
  })
}

// Map catenabible.com's father tag to era string and order
const ERA_MAP: Record<string, { era: string; order: number }> = {
  'EF': { era: 'Early Church',   order: 4 }, // Early Father
  'CC': { era: 'Medieval',       order: 8 }, // Church Commentary
  'EO': { era: 'Byzantine',      order: 9 }, // Eastern Orthodox
  'RC': { era: 'Post-Medieval',  order: 12 }, // Roman Catholic (post-medieval)
}

function normalizeEntry(raw: any, bookName: string, chapter: number, verse: number): any | null {
  if (!raw || typeof raw !== 'object') return null

  // Actual API shape: { father: { fullName, infoUrl, tag, date }, commentary: "...", ... }
  const father = raw.father || {}
  const fatherName = father.fullName || (father.en && father.en.name) || ''
  const text = (raw.commentary || '').replace(/&#\d+;/g, c => {
    const code = parseInt(c.slice(2, -1))
    return String.fromCharCode(code)
  }).replace(/\s+/g, ' ').trim()

  if (!fatherName || !text || text.length < 20) return null

  const tag = father.tag || 'EF'
  const eraInfo = ERA_MAP[tag] || { era: 'Early Church', order: 5 }
  const infoUrl = father.infoUrl || (father.en && father.en.infoUrl) || ''

  return {
    book: bookName,
    chapter,
    verse,
    father_name: fatherName,
    father_era: eraInfo.era,
    father_era_order: eraInfo.order,
    excerpt: text.length > 220 ? text.slice(0, 217) + '…' : text,
    full_text: text,
    source: `Commentary on ${bookName} ${chapter}:${verse} (catenabible.com)`,
    source_url: infoUrl
  }
}

async function fetchVerse(abbr: string, bookName: string, chapter: number, verse: number): Promise<any[]> {
  const url = `${API_BASE}/anc_com/c/${abbr}/${chapter}/${verse}?tags=["ALL"]&sort=era`
  try {
    const data = await fetchJson(url)
    if (!data || !Array.isArray(data)) return []
    return data
      .map((raw: any) => normalizeEntry(raw, bookName, chapter, verse))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function getVerseCount(abbr: string, chapter: number): Promise<number[]> {
  // Returns array of comment counts per verse for this chapter
  const url = `${API_BASE}/anc_com/i/${abbr}/${chapter}?tags=["ALL"]`
  try {
    const data = await fetchJson(url)
    if (!Array.isArray(data)) return []
    return data // index 0 = null, index 1+ = verse counts
  } catch {
    return []
  }
}

async function main() {
  // Load progress
  let progress: Record<string, string[]> = {}
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
    console.log('Resuming from previous progress...')
  }

  let allEntries: any[] = []
  if (fs.existsSync(OUT_PATH)) {
    allEntries = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'))
    console.log(`Loaded ${allEntries.length} existing entries`)
  }

  for (const book of BOOKS) {
    const doneChapters: string[] = progress[book.abbr] || []
    process.stdout.write(`\n${book.name}: `)

    for (let ch = 1; ch <= book.chapters; ch++) {
      const chKey = String(ch)
      if (doneChapters.includes(chKey)) {
        process.stdout.write('.')
        continue
      }

      // Get verse counts from index endpoint
      const counts = await getVerseCount(book.abbr, ch)
      await sleep(300)

      let chapterEntries = 0

      if (counts.length > 1) {
        // Fetch verses that have commentary
        for (let v = 1; v < counts.length; v++) {
          const count = counts[v]
          if (!count || count === 0) continue

          const entries = await fetchVerse(book.abbr, book.name, ch, v)
          if (entries.length > 0) {
            allEntries.push(...entries)
            chapterEntries += entries.length
          }
          await sleep(200)
        }
      } else {
        // Fallback: try verses 1-50 if index fails
        const maxVerses = (VERSES_PER_CHAPTER[book.abbr] || [])[ch] || 40
        let emptyStreak = 0
        for (let v = 1; v <= maxVerses; v++) {
          const entries = await fetchVerse(book.abbr, book.name, ch, v)
          if (entries.length > 0) {
            allEntries.push(...entries)
            chapterEntries += entries.length
            emptyStreak = 0
          } else {
            emptyStreak++
            if (emptyStreak > 5) break
          }
          await sleep(200)
        }
      }

      if (chapterEntries > 0) {
        process.stdout.write(`${ch}(${chapterEntries}) `)
      } else {
        process.stdout.write('_')
      }

      doneChapters.push(chKey)
      progress[book.abbr] = doneChapters

      fs.writeFileSync(OUT_PATH, JSON.stringify(allEntries, null, 2))
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))

      await sleep(300)
    }
  }

  console.log(`\n\nComplete! Saved ${allEntries.length} entries to ${OUT_PATH}`)
}

main().catch(console.error)
