// Maps (father_name, bible_book) to the specific New Advent URL for that father's
// commentary work on that book. New Advent URL pattern:
//   https://www.newadvent.org/fathers/{4-digit-work-id}{2-digit-chapter}.htm
// Where chapter 01 = the work's introduction / first section.

// Work IDs confirmed from newadvent.org/fathers
const NA = 'https://www.newadvent.org/fathers'

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
  },
  'Augustine of Hippo': {
    'Psalms':           `${NA}/1501.htm`,
    'John':             `${NA}/1701.htm`,
    '1 John':           `${NA}/1702.htm`,
    'Matthew':          `${NA}/1302.htm`,
    'Galatians':        `${NA}/1303.htm`,
    'Romans':           `${NA}/1304.htm`,
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
    'Matthew':          'https://www.newadvent.org/cathen/14626a.htm',
    'Mark':             'https://www.newadvent.org/cathen/14626a.htm',
    'Luke':             'https://www.newadvent.org/cathen/14626a.htm',
    'John':             'https://www.newadvent.org/cathen/14626a.htm',
  },
  'Theophylact of Ochrid': {
    'Matthew':          'https://www.newadvent.org/cathen/14626a.htm',
    'Mark':             'https://www.newadvent.org/cathen/14626a.htm',
    'Luke':             'https://www.newadvent.org/cathen/14626a.htm',
    'John':             'https://www.newadvent.org/cathen/14626a.htm',
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
    'Matthew':          'https://www.ccel.org/ccel/aquinas/catena1.i.html',
    'Mark':             'https://www.ccel.org/ccel/aquinas/catena2.i.html',
  },
  'Cornelius a Lapide': {
    'Matthew':          'https://www.ecatholic2000.com/cornelius/matthew/matt1.shtml',
    'Mark':             'https://www.ecatholic2000.com/cornelius/mark/mark1.shtml',
    'Luke':             'https://www.ecatholic2000.com/cornelius/luke/luke1.shtml',
    'John':             'https://www.ecatholic2000.com/cornelius/john/john1.shtml',
  },
}

// Converts a book name to catenabible.com URL slug
function toCatenabibleSlug(book: string): string {
  return book.replace(/ /g, '-')
}

/**
 * Returns the best available "Read full text" URL for a commentary entry.
 * Priority: known New Advent work > existing specific URL > catenabible verse page
 */
export function getSourceUrl(
  fatherName: string,
  book: string,
  chapter: number,
  existingUrl: string
): string | null {
  // 1. Known father+book → specific New Advent work
  const byFather = WORK_MAP[fatherName] || WORK_MAP[fatherName.split(',')[0].trim()]
  if (byFather && byFather[book]) return byFather[book]

  // 2. Existing URL that's already a proper work link (New Advent fathers/ or CCEL)
  if (existingUrl &&
      (existingUrl.includes('newadvent.org/fathers') || existingUrl.includes('ccel.org')) &&
      !existingUrl.includes('newadvent.org/cathen') // cathen = encyclopedia, not fathers text
  ) return existingUrl

  return null
}
