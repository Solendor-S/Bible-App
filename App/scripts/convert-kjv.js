const fs = require('fs')

const BOOK_NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
]

// Strip BOM and parse
let raw = fs.readFileSync('C:/Projects/BibleApp/data/raw/kjv_raw.json', 'utf-8')
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
const books = JSON.parse(raw)

const verses = []
for (let bi = 0; bi < books.length; bi++) {
  const book = books[bi]
  const bookName = BOOK_NAMES[bi] || book.abbrev
  for (let ci = 0; ci < book.chapters.length; ci++) {
    for (let vi = 0; vi < book.chapters[ci].length; vi++) {
      // Strip Hebrew/marginal annotations in {curly braces}
      const text = book.chapters[ci][vi].replace(/\s*\{[^}]*\}/g, '').trim()
      verses.push({ book: bookName, book_order: bi + 1, chapter: ci + 1, verse: vi + 1, text })
    }
  }
}

fs.writeFileSync('C:/Projects/BibleApp/data/raw/kjv.json', JSON.stringify(verses))
console.log(`Books: ${books.length} | Verses: ${verses.length}`)
