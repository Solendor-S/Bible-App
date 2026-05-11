// Maps (father_name, bible_book) to a "Read full text" URL.
// Priority: book-specific work → author-level fallback → existing source_url → null
//
// New Advent URL pattern: https://www.newadvent.org/fathers/{4-digit-work-id}{2-digit-chapter}.htm
// CCEL URL pattern:       https://www.ccel.org/ccel/{author}/{work}

const NA   = 'https://www.newadvent.org/fathers'
const CCEL = 'https://www.ccel.org/ccel'
const TERT = 'https://www.tertullian.org/fathers'

// ── Book-specific work URLs ───────────────────────────────────────────────────
// Use these when a father wrote a dedicated commentary on a particular Bible book.

const WORK_MAP: Record<string, Record<string, string>> = {
  'John Chrysostom': {
    'Matthew':          `${NA}/2001.htm`,
    'John':             `${NA}/2401.htm`,
    'Acts':             `${NA}/2101.htm`,
    'Romans':           `${NA}/2102.htm`,
    '1 Corinthians':    `${NA}/2201.htm`,
    '2 Corinthians':    `${NA}/2202.htm`,
    'Galatians':        `${NA}/2302.htm`,
    'Ephesians':        `${NA}/2303.htm`,
    'Philippians':      `${NA}/2304.htm`,
    'Colossians':       `${NA}/2305.htm`,
    '1 Thessalonians':  `${NA}/2306.htm`,
    '2 Thessalonians':  `${NA}/2307.htm`,
    '1 Timothy':        `${NA}/2308.htm`,
    '2 Timothy':        `${NA}/2309.htm`,
    'Titus':            `${NA}/2311.htm`,
    'Philemon':         `${NA}/2310.htm`,
    'Hebrews':          `${NA}/2403.htm`,
    'Genesis':          `${NA}/2101.htm`,
    'Psalms':           `${NA}/2102.htm`,
  },
  'Augustine of Hippo': {
    'Psalms':           `${NA}/1501.htm`,
    'John':             `${NA}/1701.htm`,
    '1 John':           `${NA}/1702.htm`,
    'Matthew':          `${NA}/1302.htm`,
    'Galatians':        `${NA}/1303.htm`,
    'Romans':           `${NA}/1304.htm`,
    'Genesis':          `${NA}/1701.htm`,
    'Sermon on the Mount': `${NA}/1302.htm`,
  },
  'Jerome of Stridon': {
    'Matthew':          `${NA}/3009.htm`,
    'Mark':             `${NA}/3009.htm`,
    'Galatians':        `${NA}/3008.htm`,
    'Ephesians':        `${NA}/3010.htm`,
    'Titus':            `${NA}/3011.htm`,
    'Philemon':         `${NA}/3012.htm`,
    'Isaiah':           `${NA}/3013.htm`,
    'Ezekiel':          `${NA}/3014.htm`,
    'Daniel':           `${NA}/3015.htm`,
  },
  'Origen of Alexandria': {
    'Matthew':          `${NA}/1016.htm`,
    'John':             `${NA}/1017.htm`,
    'Romans':           `${NA}/1028.htm`,
    'Song of Solomon':  `${NA}/1030.htm`,
    'Genesis':          `${NA}/1002.htm`,
    'Exodus':           `${NA}/1003.htm`,
    'Leviticus':        `${NA}/1005.htm`,
    'Numbers':          `${NA}/1007.htm`,
    'Joshua':           `${NA}/1009.htm`,
    'Psalms':           `${NA}/1019.htm`,
  },
  'Cyril of Alexandria': {
    'John':             `${NA}/2092.htm`,
    'Luke':             `${NA}/2095.htm`,
    'Isaiah':           `${NA}/2096.htm`,
  },
  'Ambrose of Milan': {
    'Luke':             `${NA}/2104.htm`,
    'Psalms':           `${NA}/2102.htm`,
  },
  'Hilary of Poitiers': {
    'Matthew':          `${NA}/3300.htm`,
    'Psalms':           `${NA}/3301.htm`,
  },
  'Basil of Caesarea': {
    'Isaiah':           `${NA}/3201.htm`,
    'Psalms':           `${NA}/3202.htm`,
    'Genesis':          `${NA}/3203.htm`,
  },
  'Gregory of Nyssa': {
    'Song of Solomon':  `${NA}/2907.htm`,
    'Psalms':           `${NA}/2903.htm`,
    'Ecclesiastes':     `${NA}/2906.htm`,
  },
  'Gregory the Great': {
    'Job':              `${NA}/3601.htm`,
    'Ezekiel':          `${NA}/3602.htm`,
    'Song of Solomon':  `${NA}/3603.htm`,
  },
  'Theophylact of Ohrid': {
    'Matthew':          `${NA}/2001.htm`,
    'Mark':             `${CCEL}/theophylact/markcomm`,
    'Luke':             `${CCEL}/theophylact/lukecomm`,
    'John':             `${CCEL}/theophylact/johncomm`,
  },
  'Theophylact of Ochrid': {
    'Matthew':          `${NA}/2001.htm`,
    'Mark':             `${CCEL}/theophylact/markcomm`,
    'Luke':             `${CCEL}/theophylact/lukecomm`,
    'John':             `${CCEL}/theophylact/johncomm`,
  },
  'Venerable Bede': {
    'Luke':             `${NA}/3508.htm`,
    'Acts':             `${NA}/3509.htm`,
    'Mark':             `${NA}/3507.htm`,
    '1 Peter':          `${NA}/3510.htm`,
    '2 Peter':          `${NA}/3510.htm`,
    '1 John':           `${NA}/3510.htm`,
    'Revelation':       `${NA}/3511.htm`,
    'Proverbs':         `${NA}/3504.htm`,
  },
  'Bede': {
    'Luke':             `${NA}/3508.htm`,
    'Acts':             `${NA}/3509.htm`,
    'Mark':             `${NA}/3507.htm`,
  },
  'Tertullian': {
    'Matthew':          `${NA}/0302.htm`,
    'Luke':             `${NA}/0302.htm`,
    'John':             `${NA}/0302.htm`,
    'Mark':             `${NA}/0302.htm`,
  },
  'Tertullian of Carthage': {
    'Matthew':          `${NA}/0302.htm`,
    'Luke':             `${NA}/0302.htm`,
    'John':             `${NA}/0302.htm`,
    'Mark':             `${NA}/0302.htm`,
  },
  'Irenaeus of Lyons': {
    'Matthew':          `${NA}/0103.htm`,
    'Luke':             `${NA}/0103.htm`,
    'John':             `${NA}/0103.htm`,
    'Revelation':       `${NA}/0103.htm`,
  },
  'Cyprian of Carthage': {
    'Matthew':          `${NA}/0507.htm`,
    'Luke':             `${NA}/0507.htm`,
    'John':             `${NA}/0507.htm`,
  },
  'Eusebius of Caesarea': {
    'Matthew':          `${NA}/2901.htm`,
    'Luke':             `${NA}/2901.htm`,
    'Isaiah':           `${NA}/2902.htm`,
    'Psalms':           `${NA}/2903.htm`,
  },
  'Athanasius of Alexandria': {
    'Psalms':           `${NA}/2802.htm`,
    'Matthew':          `${NA}/2806.htm`,
  },
  'Cyril of Jerusalem': {
    'Matthew':          `${NA}/3101.htm`,
    'John':             `${NA}/3101.htm`,
  },
  'Leo the Great': {
    'Matthew':          `${NA}/3601.htm`,
    'Luke':             `${NA}/3601.htm`,
    'John':             `${NA}/3601.htm`,
  },
  'Thomas Aquinas': {
    'Matthew':          `${CCEL}/aquinas/catena1.i.html`,
    'Mark':             `${CCEL}/aquinas/catena2.i.html`,
    'Luke':             `${CCEL}/aquinas/catena3.i.html`,
    'John':             `${CCEL}/aquinas/catena4.i.html`,
  },
  'Cornelius a Lapide': {
    'Matthew':          'https://www.ecatholic2000.com/cornelius/matthew/matt1.shtml',
    'Mark':             'https://www.ecatholic2000.com/cornelius/mark/mark1.shtml',
    'Luke':             'https://www.ecatholic2000.com/cornelius/luke/luke1.shtml',
    'John':             'https://www.ecatholic2000.com/cornelius/john/john1.shtml',
  },
  'Ambrosiaster': {
    'Romans':           `${NA}/2107.htm`,
    'Galatians':        `${NA}/2107.htm`,
    'Ephesians':        `${NA}/2107.htm`,
    'Philippians':      `${NA}/2107.htm`,
    'Colossians':       `${NA}/2107.htm`,
    '1 Corinthians':    `${NA}/2107.htm`,
    '2 Corinthians':    `${NA}/2107.htm`,
    '1 Timothy':        `${NA}/2107.htm`,
    '2 Timothy':        `${NA}/2107.htm`,
    'Titus':            `${NA}/2107.htm`,
    'Philemon':         `${NA}/2107.htm`,
    '1 Thessalonians':  `${NA}/2107.htm`,
    '2 Thessalonians':  `${NA}/2107.htm`,
  },
  'Hippolytus of Rome': {
    'Daniel':           `${NA}/0503.htm`,
    'Genesis':          `${NA}/0503.htm`,
    'Revelation':       `${NA}/0503.htm`,
  },
}

// ── Author-level fallback URLs ────────────────────────────────────────────────
// Shown when no book-specific work is mapped. Links to the author's works index.

const AUTHOR_MAP: Record<string, string> = {
  // Same person, different name variants
  'Jerome':                     `${NA}/3009.htm`,
  'Gregory The Dialogist':      `${NA}/3601.htm`,    // = Gregory the Great
  'Athanasius the Apostolic':   `${NA}/2802.htm`,    // = Athanasius of Alexandria
  'Basil the Great':            `${NA}/3202.htm`,    // = Basil of Caesarea
  'Raban':                      `${TERT}/index.htm`, // = Rabanus Maurus

  // Full author pages
  'George Leo Haydock':         'https://www.ecatholic2000.com/haydock/title.shtml',
  'Richard Challoner':          'https://drbo.org/drl/',
  'Ambrosiaster':               `${NA}/2107.htm`,
  'Clement Of Alexandria':      `${NA}/0209.htm`,
  'Hippolytus of Rome':         `${NA}/0503.htm`,
  // ANF Vol 1 — Apostolic Fathers (Ignatius, Clement of Rome, Barnabas, Hermas, Polycarp)
  // Full volume in one page → Ctrl+F works across all their letters
  'Ignatius of Antioch':        `${CCEL}/schaff/anf01`,
  'Clement Of Rome':            `${CCEL}/schaff/anf01`,
  'Shepherd of Hermas':         `${CCEL}/schaff/anf01`,
  'The Apostolic Constitutions': `${CCEL}/schaff/anf07`,

  // ANF Vol 2 — Fathers of 2nd century (Justin, Theophilus, Clement of Alexandria, Irenaeus)
  'Justin Martyr':              `${CCEL}/schaff/anf01`,
  'Theophilus of Antioch':      `${CCEL}/schaff/anf02`,
  'Clement Of Alexandria':      `${CCEL}/schaff/anf02`,

  // ANF Vol 5 — Hippolytus, Cyprian
  'Hippolytus of Rome':         `${CCEL}/schaff/anf05`,

  // ANF Vol 6 — Gregory Thaumaturgus, Methodius, others
  'Methodius of Olympus':       `${CCEL}/schaff/anf06`,

  // NPNF 2nd series — Cassian, Gregory Nazianzen, John of Damascus
  'John Cassian':               `${CCEL}/schaff/npnf211`,
  'Gregory the Theologian':     `${CCEL}/schaff/npnf207`,  // = Gregory Nazianzen, NPNF2 vol 7
  'John of Damascus':           `${CCEL}/schaff/npnf209`,  // NPNF2 vol 9

  // Ephrem — tertullian.org has the fullest English collection
  'Ephrem The Syrian':          `${TERT}/index.htm`,

  // Others with full text sources
  'Remigius of Auxerre':        `${TERT}/index.htm`,
  'Remigius of Rheims':         `${TERT}/index.htm`,
  'Didymus the Blind':          `${TERT}/index.htm`,
  'Cassiodorus Senator':        `${CCEL}/schaff/npnf111`,
  'Severian of Gabala':         `${TERT}/index.htm`,
  'Alcuin of York':             `${TERT}/index.htm`,
  'Caesarius of Arles':         `${CCEL}/schaff/npnf111`,
  'Gaius Marius Victorinus':    `${CCEL}/schaff/npnf108`,
  'Rabanus Maurus':             `${TERT}/index.htm`,
  'Pseudo-Chrys':               `${NA}/2001.htm`,
  'Theophylact of Ohrid':       `${CCEL}/theophylact`,
  'Theophylact of Ochrid':      `${CCEL}/theophylact`,
  'Venerable Bede':             `${NA}/3508.htm`,
  'Bede':                       `${NA}/3508.htm`,
  'Oecumenius':                 `${TERT}/index.htm`,
  'Pseudo-Jerome':              `${NA}/3009.htm`,
  'Glossa Ordinaria':           'https://www.medievalacademy.org/',
  'Interlinear Gloss':          'https://www.medievalacademy.org/',
  'Gloss':                      'https://www.medievalacademy.org/',
}

function toCatenabibleSlug(book: string): string {
  return book.replace(/ /g, '-')
}

function buildSearchUrl(quoteText: string, authorUrl: string | undefined): string {
  // Take first 8 words, strip punctuation, wrap in quotes for exact phrase search
  const phrase = quoteText.trim().split(/\s+/).slice(0, 8).join(' ').replace(/["""'']/g, '')
  const site = authorUrl?.includes('newadvent.org') ? 'newadvent.org/fathers'
             : authorUrl?.includes('ccel.org')      ? 'ccel.org'
             : 'newadvent.org/fathers'
  return `https://www.google.com/search?btnI=1&q=site:${site}+"${encodeURIComponent(phrase)}"`
}

/**
 * Returns the best available "Read full text" URL for a commentary entry.
 * Priority:
 *   1. Known book-specific work (e.g. Chrysostom on Matthew → exact homily page)
 *   2. Google site-search using the quote text (finds exact passage on New Advent/CCEL)
 *   3. Author-level fallback (index page)
 *   4. Existing proper source URL
 */
export function getSourceUrl(
  fatherName: string,
  book: string,
  chapter: number,
  existingUrl: string,
  quoteText?: string,
): string | null {
  const name = fatherName.split(',')[0].trim()

  // 1. Book-specific work — we know exactly which commentary to link to
  const byFather = WORK_MAP[fatherName] ?? WORK_MAP[name]
  if (byFather?.[book]) return byFather[book]

  // 2. Quote-text search — use first 8 words to find exact passage via Google
  const authorUrl = AUTHOR_MAP[fatherName] ?? AUTHOR_MAP[name]
  if (quoteText?.trim()) return buildSearchUrl(quoteText, authorUrl)

  // 3. Author-level fallback
  if (authorUrl) return authorUrl

  // 4. Existing URL that's already a proper work link
  if (existingUrl &&
      (existingUrl.includes('newadvent.org/fathers') || existingUrl.includes('ccel.org')) &&
      !existingUrl.includes('newadvent.org/cathen')
  ) return existingUrl

  return null
}
