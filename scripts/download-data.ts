/**
 * Downloads source data files and builds bible.db
 * Run: npm run setup-data
 */

import { execSync } from 'child_process'
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as https from 'https'

const RAW_DIR = join(__dirname, '../data/raw')
mkdirSync(RAW_DIR, { recursive: true })

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) {
      console.log(`  Already exists: ${dest}`)
      resolve()
      return
    }
    console.log(`  Downloading ${url}`)
    const file = createWriteStream(dest)
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        download(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', reject)
  })
}

async function main() {
  console.log('=== Downloading Bible data ===\n')

  // KJV from ebible.org (public domain USFX, we'll use a pre-converted JSON)
  // We generate a minimal KJV JSON from the public domain source
  console.log('Generating KJV placeholder data...')
  generateKjvSample()

  // OpenBible cross-references
  await download(
    'https://a.openbible.info/data/cross-references.zip',
    join(RAW_DIR, 'cross_refs.zip')
  )
  // Unzip if zip tool available, otherwise note manual step
  try {
    execSync(`cd "${RAW_DIR}" && tar -xf cross_refs.zip 2>/dev/null || powershell -Command "Expand-Archive -Path cross_refs.zip -DestinationPath . -Force"`)
    // Rename to expected filename
    execSync(`cd "${RAW_DIR}" && mv cross-references.txt cross_refs.txt 2>/dev/null || rename cross-references.txt cross_refs.txt`)
  } catch {
    console.warn('  Could not auto-extract cross_refs.zip — extract manually to data/raw/cross_refs.txt')
  }

  // Generate sample commentary JSON
  console.log('Generating sample commentary data...')
  generateCommentarySample()

  console.log('\n=== Building database ===\n')
  execSync('npx ts-node data/build-db.ts', { stdio: 'inherit', cwd: join(__dirname, '..') })

  console.log('\n✓ Setup complete. Run: npm run dev')
}

function generateKjvSample() {
  // Full KJV can be sourced from https://github.com/thiagobodruk/bible
  // For now we write instructions and a tiny sample so the app runs
  const dest = join(RAW_DIR, 'kjv.json')
  if (existsSync(dest)) return

  const books = [
    { name: 'Genesis', order: 1 },
    { name: 'Exodus', order: 2 },
    { name: 'Psalms', order: 19 },
    { name: 'Matthew', order: 40 },
    { name: 'John', order: 43 },
    { name: 'Romans', order: 45 },
    { name: 'Revelation', order: 66 }
  ]

  const sample: any[] = []
  for (const book of books) {
    const verses = getSampleVerses(book.name)
    for (const v of verses) {
      sample.push({ book: book.name, book_order: book.order, ...v })
    }
  }
  writeFileSync(dest, JSON.stringify(sample, null, 2))
  console.log(`  Written ${sample.length} sample verses — replace with full KJV JSON for complete data`)
  console.log('  Full KJV JSON: https://github.com/thiagobodruk/bible/blob/master/json/en_kjv.json')
}

function getSampleVerses(book: string): { chapter: number; verse: number; text: string }[] {
  const data: Record<string, { chapter: number; verse: number; text: string }[]> = {
    Genesis: [
      { chapter: 1, verse: 1, text: 'In the beginning God created the heaven and the earth.' },
      { chapter: 1, verse: 2, text: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.' },
      { chapter: 1, verse: 3, text: 'And God said, Let there be light: and there was light.' }
    ],
    John: [
      { chapter: 1, verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
      { chapter: 1, verse: 2, text: 'The same was in the beginning with God.' },
      { chapter: 1, verse: 3, text: 'All things were made by him; and without him was not any thing made that was made.' },
      { chapter: 1, verse: 14, text: 'And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.' },
      { chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' }
    ],
    Romans: [
      { chapter: 8, verse: 28, text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
      { chapter: 8, verse: 38, text: 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,' },
      { chapter: 8, verse: 39, text: 'Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.' }
    ],
    Matthew: [
      { chapter: 5, verse: 3, text: 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.' },
      { chapter: 5, verse: 4, text: 'Blessed are they that mourn: for they shall be comforted.' },
      { chapter: 5, verse: 5, text: 'Blessed are the meek: for they shall inherit the earth.' }
    ],
    Psalms: [
      { chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.' },
      { chapter: 23, verse: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' },
      { chapter: 23, verse: 3, text: 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.' }
    ],
    Exodus: [
      { chapter: 20, verse: 1, text: 'And God spake all these words, saying,' },
      { chapter: 20, verse: 2, text: 'I am the LORD thy God, which have brought thee out of the land of Egypt, out of the house of bondage.' },
      { chapter: 20, verse: 3, text: 'Thou shalt have no other gods before me.' }
    ],
    Revelation: [
      { chapter: 1, verse: 1, text: 'The Revelation of Jesus Christ, which God gave unto him, to shew unto his servants things which must shortly come to pass; and he sent and signified it by his angel unto his servant John:' },
      { chapter: 22, verse: 20, text: 'He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus.' },
      { chapter: 22, verse: 21, text: 'The grace of our Lord Jesus Christ be with you all. Amen.' }
    ]
  }
  return data[book] ?? []
}

function generateCommentarySample() {
  const dest = join(RAW_DIR, 'commentary.json')
  if (existsSync(dest)) return

  const commentary = [
    {
      book: 'John', chapter: 1, verse: 1,
      father_name: 'Augustine of Hippo', father_era: '4th–5th c.', father_era_order: 4,
      excerpt: '"In the beginning was the Word" — not in a temporal beginning, but the Word coeternal with the Father.',
      full_text: 'Augustine writes in his Homilies on John: "In the beginning was the Word." Which beginning? Not in a temporal beginning, as if the Word began to be at some time. For if the Word began, then it was not in the beginning; for what begins is not yet. But "In the beginning was" — that is, already was before all things. The Word was not made, but all things were made by the Word.',
      source: 'Homilies on the Gospel of John, Tractate 1'
    },
    {
      book: 'John', chapter: 1, verse: 1,
      father_name: 'John Chrysostom', father_era: '4th c.', father_era_order: 4,
      excerpt: 'Why does John not say "At first was the Word" but "In the beginning"? To show that the Word has no beginning of existence.',
      full_text: 'Chrysostom asks in his Homilies on John: Why does he not say "At first"? Because "in the beginning" points to an existence before all ages and time. Had he said "from the first," one might imagine a beginning. But "was in the beginning" destroys all such imagination and shows the Son is without beginning.',
      source: 'Homilies on the Gospel of John, Homily 2'
    },
    {
      book: 'John', chapter: 1, verse: 1,
      father_name: 'Origen of Alexandria', father_era: '3rd c.', father_era_order: 3,
      excerpt: 'The Word is the image of the invisible God, the first-born of all creation, yet not first in time but in dignity.',
      full_text: 'Origen writes in his Commentary on John: We must understand "Word" not as a mere sound but as the Wisdom, the Truth, the Life. The Word is with God, not as a lesser being beside a greater, but as one who shares the divine nature while remaining distinct in person. The preposition "with" indicates both communion and distinction.',
      source: 'Commentary on the Gospel of John, Book 1'
    },
    {
      book: 'John', chapter: 1, verse: 14,
      father_name: 'Cyril of Alexandria', father_era: '5th c.', father_era_order: 5,
      excerpt: '"The Word was made flesh" — not by ceasing to be the Word, but by taking flesh into union with himself.',
      full_text: 'Cyril of Alexandria in his Commentary on John: The Word was not changed into flesh; the divine nature does not admit change. Rather, the Word assumed human nature into personal union — so that what is said of the flesh is said of the Word, and what is said of the Word is said of the flesh, because there is one person, one Christ.',
      source: 'Commentary on the Gospel of John, Book 2'
    },
    {
      book: 'Genesis', chapter: 1, verse: 1,
      father_name: 'Basil of Caesarea', father_era: '4th c.', father_era_order: 4,
      excerpt: '"In the beginning" signals not a beginning of time, but the first moment from which all subsequent time proceeds.',
      full_text: 'Basil writes in the Hexaemeron: "In the beginning God created." The beginning is the starting point, and just as a road has a beginning and an end, so creation has a beginning. God, being outside time, created time itself along with heaven and earth. Before this beginning, there was not even silence or rest, for these require time, and time had not yet been made.',
      source: 'Hexaemeron, Homily 1'
    },
    {
      book: 'John', chapter: 3, verse: 16,
      father_name: 'Augustine of Hippo', father_era: '4th–5th c.', father_era_order: 4,
      excerpt: 'God so loved the world not as one who admires it, but as one who wished to heal it of its corruption.',
      full_text: 'Augustine in his Tractates on John: "For God so loved the world" — observe that it does not say God loved the world as something beautiful. He did not love it because it was beautiful; he made it beautiful because he loved it. His love is not the consequence of our goodness but the cause of it. He gave his only-begotten Son that we who were dead might live through him.',
      source: 'Tractates on the Gospel of John, Tractate 12'
    },
    {
      book: 'Psalms', chapter: 23, verse: 1,
      father_name: 'Ambrose of Milan', father_era: '4th c.', father_era_order: 4,
      excerpt: '"The Lord is my shepherd" — the good shepherd lays down his life for the sheep, feeding them with his own body and blood.',
      full_text: 'Ambrose writes: David says "The Lord is my shepherd." He speaks not of any shepherd but of the Lord himself. And who is this Lord-shepherd? He who said "I am the good shepherd." He feeds us with heavenly pastures; he leads us to the waters of rest — the waters of holy baptism where the soul finds its true refreshment.',
      source: 'Exposition of Psalm 118 and related writings'
    },
    {
      book: 'Romans', chapter: 8, verse: 28,
      father_name: 'John Chrysostom', father_era: '4th c.', father_era_order: 4,
      excerpt: '"All things work together for good" — even our sins, if we repent, God turns to our benefit, training us through the fall itself.',
      full_text: 'Chrysostom comments: Paul does not say that all things are good, but that all things work together for good — which is a greater thing. Even what seems evil, even tribulations and trials, God orchestrates for the benefit of those who love him. The very fact that they love God is itself a gift of God; and having received this gift, they receive all things with it.',
      source: 'Homilies on Romans, Homily 15'
    }
  ]

  writeFileSync(dest, JSON.stringify(commentary, null, 2))
  console.log(`  Written ${commentary.length} sample commentary entries`)
}

main().catch(console.error)
