/**
 * Downloads Strong's dictionaries + STEPBible tagged Greek NT and Hebrew OT.
 * Run: npm run fetch-strongs
 * Sources (all CC-BY or public domain):
 *   - OpenScriptures Strong's Greek/Hebrew dictionaries
 *   - STEPBible Translators Amalgamated Greek NT (TAGNT)
 *   - STEPBible Translators Amalgamated Hebrew OT (TAHOT)
 */

import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const RAW = path.join(__dirname, '../data/raw')

const NT_BOOKS: Record<string, string> = {
  Mat: 'Matthew', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John',
  Act: 'Acts', Rom: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians',
  Gal: 'Galatians', Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians',
  '1Th': '1 Thessalonians', '2Th': '2 Thessalonians', '1Ti': '1 Timothy',
  '2Ti': '2 Timothy', Tit: 'Titus', Phm: 'Philemon', Heb: 'Hebrews',
  Jas: 'James', '1Pe': '1 Peter', '2Pe': '2 Peter', '1Jn': '1 John',
  '2Jn': '2 John', '3Jn': '3 John', Jud: 'Jude', Rev: 'Revelation',
}

const OT_BOOKS: Record<string, string> = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers',
  Deu: 'Deuteronomy', Jos: 'Joshua', Jdg: 'Judges', Rut: 'Ruth',
  '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings',
  '1Ch': '1 Chronicles', '2Ch': '2 Chronicles', Ezr: 'Ezra', Neh: 'Nehemiah',
  Est: 'Esther', Job: 'Job', Psa: 'Psalms', Pro: 'Proverbs',
  Ecc: 'Ecclesiastes', Son: 'Song of Solomon', Isa: 'Isaiah', Jer: 'Jeremiah',
  Lam: 'Lamentations', Eze: 'Ezekiel', Dan: 'Daniel', Hos: 'Hosea',
  Joe: 'Joel', Amo: 'Amos', Oba: 'Obadiah', Jon: 'Jonah', Mic: 'Micah',
  Nah: 'Nahum', Hab: 'Habakkuk', Zep: 'Zephaniah', Hag: 'Haggai',
  Zec: 'Zechariah', Mal: 'Malachi',
}

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    ;(mod as typeof https).get(url, { headers: { 'User-Agent': 'BibleApp/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetch(res.headers.location!).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function parseStrongsDict(js: string): Record<string, any> {
  // Strip "var X = " prefix and "; module.exports = ..." suffix
  const start = js.indexOf('{')
  const end = js.lastIndexOf('}')
  return JSON.parse(js.slice(start, end + 1))
}

function extractGreekStrongsNum(col3: string): string {
  // col3 like "G0976=N-NSF" or "G2424G=N-GSM-P"
  const m = col3.match(/^([GH]\d+[A-Za-z]?)=/)
  return m ? m[1] : ''
}

function extractHebrewStrongsNum(col4: string): string {
  // col4 like "{H1254A}" or "H9003/{H7225G}" or "H9009/{H8064}"
  // Priority: number inside {} that is NOT H9000-H9030 (grammatical prefixes)
  const bracketed = col4.match(/\{(H\d+[A-Za-z]?)\}/g)
  if (bracketed) {
    for (const b of bracketed) {
      const m = b.match(/H(\d+)/)
      if (m && parseInt(m[1]) < 9000) return b.replace(/[{}]/g, '')
    }
  }
  // Fallback: first H number
  const m = col4.match(/H(\d+[A-Za-z]?)/)
  return m ? `H${m[1]}` : ''
}

function parseTagnt(text: string): any[] {
  const words: any[] = []
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('\t') || line.startsWith('=') || line.startsWith('T')) continue
    const cols = line.split('\t')
    if (cols.length < 4) continue
    // col0: "Mat.1.1#01=NKO"
    const refMatch = cols[0].match(/^(\w+)\.(\d+)\.(\d+)#(\d+)/)
    if (!refMatch) continue
    const bookAbbr = refMatch[1]
    const book = NT_BOOKS[bookAbbr]
    if (!book) continue
    const chapter = parseInt(refMatch[2])
    const verse = parseInt(refMatch[3])
    const position = parseInt(refMatch[4])
    // col1: "Βίβλος (Biblos)"
    const greekMatch = cols[1].match(/^(.+?)\s*\(([^)]+)\)/)
    const greek = greekMatch ? greekMatch[1].trim() : cols[1].trim()
    const translit = greekMatch ? greekMatch[2].trim() : ''
    const strongs = extractGreekStrongsNum(cols[3] || '')
    if (!strongs) continue
    words.push({ book, chapter, verse, position, greek, translit, strongs })
  }
  return words
}

function parseTahot(text: string): any[] {
  const words: any[] = []
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('\t') || line.startsWith('=') || line.startsWith('T')) continue
    const cols = line.split('\t')
    if (cols.length < 5) continue
    const refMatch = cols[0].match(/^(\w+)\.(\d+)\.(\d+)#(\d+)/)
    if (!refMatch) continue
    const bookAbbr = refMatch[1]
    const book = OT_BOOKS[bookAbbr]
    if (!book) continue
    const chapter = parseInt(refMatch[2])
    const verse = parseInt(refMatch[3])
    const position = parseInt(refMatch[4])
    // col1: Hebrew word (may include / prefix separator)
    const hebrew = cols[1].trim()
    // col2: transliteration
    const translit = cols[2].trim()
    // col4: Strong's numbers
    const strongs = extractHebrewStrongsNum(cols[4] || '')
    if (!strongs || !hebrew) continue
    words.push({ book, chapter, verse, position, hebrew, translit, strongs })
  }
  return words
}

async function main() {
  // --- Strong's Greek dictionary ---
  console.log('Downloading Strong\'s Greek dictionary...')
  const greekJs = await fetch('https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js')
  const greekDict = parseStrongsDict(greekJs)
  fs.writeFileSync(path.join(RAW, 'strongs-greek.json'), JSON.stringify(greekDict))
  console.log(`  ${Object.keys(greekDict).length} Greek entries`)

  // --- Strong's Hebrew dictionary ---
  console.log('Downloading Strong\'s Hebrew dictionary...')
  const hebJs = await fetch('https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js')
  const hebDict = parseStrongsDict(hebJs)
  fs.writeFileSync(path.join(RAW, 'strongs-hebrew.json'), JSON.stringify(hebDict))
  console.log(`  ${Object.keys(hebDict).length} Hebrew entries`)

  // --- TAGNT Greek NT ---
  const tagntUrls = [
    'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
    'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt',
  ]
  const ntWords: any[] = []
  for (const url of tagntUrls) {
    const label = url.includes('Mat-Jhn') ? 'Mat-Jhn' : 'Act-Rev'
    console.log(`Downloading TAGNT ${label}...`)
    const text = await fetch(url)
    const words = parseTagnt(text)
    console.log(`  ${words.length} Greek words`)
    ntWords.push(...words)
  }
  fs.writeFileSync(path.join(RAW, 'nt-words.json'), JSON.stringify(ntWords))
  console.log(`NT total: ${ntWords.length} words`)

  // --- TAHOT Hebrew OT ---
  const tahot = [
    { label: 'Gen-Deu', url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt' },
    { label: 'Jos-Est', url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt' },
    { label: 'Job-Sng', url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt' },
    { label: 'Isa-Mal', url: 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt' },
  ]
  const otWords: any[] = []
  for (const src of tahot) {
    console.log(`Downloading TAHOT ${src.label}...`)
    const text = await fetch(src.url)
    const words = parseTahot(text)
    console.log(`  ${words.length} Hebrew words`)
    otWords.push(...words)
  }
  fs.writeFileSync(path.join(RAW, 'ot-words.json'), JSON.stringify(otWords))
  console.log(`OT total: ${otWords.length} words`)

  console.log('\nDone. Now run: npm run build-db')
}

main().catch(console.error)
