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

// ── Work-title lookup ─────────────────────────────────────────────────────────
// Used when the AI cites a specific named work (not a Bible-book commentary).
// Keywords are lowercase substrings; first match wins.

interface WorkTitleEntry { keywords: string[]; url: string }

const WORK_TITLE_MAP: Record<string, WorkTitleEntry[]> = {
  'augustine of hippo': [
    { keywords: ['tractates on the gospel of john', 'tractates on john', 'homilies on john', 'on the gospel of john'], url: `${NA}/1701.htm` },
    { keywords: ['city of god'], url: `${NA}/1201.htm` },
    { keywords: ['confessions'], url: `${NA}/1101.htm` },
    { keywords: ['on the trinity', 'de trinitate'], url: `${NA}/1301.htm` },
    { keywords: ['enchiridion'], url: `${NA}/1302.htm` },
    { keywords: ['sermons', 'sermon'], url: `${NA}/1603.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/1102.htm` },
    { keywords: ['on christian doctrine', 'de doctrina christiana'], url: `${NA}/1202.htm` },
    { keywords: ['on the spirit and the letter', 'spirit and letter'], url: `${NA}/1505.htm` },
    { keywords: ['on grace and free will', 'grace and free will'], url: `${NA}/1505.htm` },
    { keywords: ['on nature and grace'], url: `${NA}/1505.htm` },
    { keywords: ['retractions', 'retractations'], url: `${NA}/1506.htm` },
  ],
  'john chrysostom': [
    { keywords: ['homilies on matthew', 'commentary on matthew'], url: `${NA}/2001.htm` },
    { keywords: ['homilies on john', 'commentary on john'], url: `${NA}/2401.htm` },
    { keywords: ['homilies on acts', 'commentary on acts'], url: `${NA}/2101.htm` },
    { keywords: ['homilies on romans', 'commentary on romans'], url: `${NA}/2102.htm` },
    { keywords: ['on the priesthood', 'de sacerdotio'], url: `${NA}/2101.htm` },
    { keywords: ['baptismal instructions', 'catecheses'], url: `${NA}/2101.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/2102.htm` },
    { keywords: ['on wealth and poverty', 'on lazarus'], url: `${NA}/2101.htm` },
  ],
  'jerome of stridon': [
    { keywords: ['letters', 'epistles'], url: `${NA}/3001.htm` },
    { keywords: ['against helvidius'], url: `${NA}/3015.htm` },
    { keywords: ['against jovinianus', 'against jovinian'], url: `${NA}/3013.htm` },
    { keywords: ['lives of illustrious men', 'de viris illustribus'], url: `${NA}/3005.htm` },
    { keywords: ['chronicle', 'chronicon'], url: `${NA}/3004.htm` },
    { keywords: ['against vigilantius'], url: `${NA}/3014.htm` },
  ],
  'origen of alexandria': [
    { keywords: ['de principiis', 'on first principles', 'peri archon'], url: `${NA}/1012.htm` },
    { keywords: ['against celsus', 'contra celsum'], url: `${NA}/1013.htm` },
    { keywords: ['exhortation to martyrdom'], url: `${NA}/1015.htm` },
    { keywords: ['on prayer', 'de oratione'], url: `${NA}/1014.htm` },
  ],
  'tertullian': [
    { keywords: ['apology', 'apologeticus'], url: `${NA}/0301.htm` },
    { keywords: ['against marcion', 'adversus marcionem'], url: `${NA}/0307.htm` },
    { keywords: ['on baptism', 'de baptismo'], url: `${NA}/0314.htm` },
    { keywords: ['on the flesh of christ', 'de carne christi'], url: `${NA}/0315.htm` },
    { keywords: ['on the resurrection', 'de resurrectione'], url: `${NA}/0316.htm` },
    { keywords: ['prescription against heretics', 'de praescriptione'], url: `${NA}/0305.htm` },
    { keywords: ['on prayer', 'de oratione'], url: `${NA}/0313.htm` },
    { keywords: ['against praxeas'], url: `${NA}/0317.htm` },
  ],
  'tertullian of carthage': [
    { keywords: ['apology', 'apologeticus'], url: `${NA}/0301.htm` },
    { keywords: ['against marcion'], url: `${NA}/0307.htm` },
    { keywords: ['on baptism'], url: `${NA}/0314.htm` },
    { keywords: ['prescription against heretics'], url: `${NA}/0305.htm` },
    { keywords: ['against praxeas'], url: `${NA}/0317.htm` },
  ],
  'irenaeus of lyons': [
    { keywords: ['against heresies', 'adversus haereses'], url: `${NA}/0103.htm` },
    { keywords: ['proof of the apostolic preaching', 'demonstration of the apostolic preaching'], url: `${CCEL}/schaff/anf01` },
  ],
  'clement of alexandria': [
    { keywords: ['stromateis', 'stromata', 'miscellanies'], url: `${NA}/0210.htm` },
    { keywords: ['exhortation to the greeks', 'protrepticus'], url: `${NA}/0209.htm` },
    { keywords: ['paedagogus', 'the instructor', 'the tutor', 'christ the educator'], url: `${NA}/0209.htm` },
    { keywords: ['who is the rich man', 'salvation of the rich'], url: `${NA}/0209.htm` },
  ],
  'basil of caesarea': [
    { keywords: ['hexaemeron', 'on the six days', 'on the creation'], url: `${NA}/3203.htm` },
    { keywords: ['on the holy spirit', 'de spiritu sancto'], url: `${NA}/3203.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/3204.htm` },
    { keywords: ['long rules', 'ascetic works', 'monastic rules'], url: `${NA}/3201.htm` },
  ],
  'basil the great': [
    { keywords: ['hexaemeron'], url: `${NA}/3203.htm` },
    { keywords: ['on the holy spirit'], url: `${NA}/3203.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/3204.htm` },
  ],
  'gregory of nazianzus': [
    { keywords: ['theological orations', 'five theological orations'], url: `${NA}/3801.htm` },
    { keywords: ['orations', 'oration'], url: `${NA}/3801.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/3801.htm` },
  ],
  'gregory of nyssa': [
    { keywords: ['on the soul and resurrection', 'de anima', 'macrina'], url: `${NA}/2908.htm` },
    { keywords: ['life of moses', 'the life of moses'], url: `${NA}/2908.htm` },
    { keywords: ['catechetical oration', 'great catechism', 'catechetical discourse'], url: `${NA}/2906.htm` },
    { keywords: ['against eunomius'], url: `${NA}/2902.htm` },
    { keywords: ['on virginity'], url: `${NA}/2907.htm` },
  ],
  'gregory the great': [
    { keywords: ['pastoral rule', 'regula pastoralis', 'book of pastoral rule'], url: `${NA}/3601.htm` },
    { keywords: ['morals on job', 'moralia in job', 'moralia'], url: `${NA}/3601.htm` },
    { keywords: ['dialogues'], url: `${NA}/3601.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/3601.htm` },
    { keywords: ['homilies on ezekiel'], url: `${NA}/3602.htm` },
    { keywords: ['homilies on the gospels'], url: `${NA}/3601.htm` },
  ],
  'cyprian of carthage': [
    { keywords: ['on the unity of the church', 'de ecclesiae unitate'], url: `${NA}/0507.htm` },
    { keywords: ['on the lapsed', 'de lapsis'], url: `${NA}/0507.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/0507.htm` },
    { keywords: ["on the lord's prayer", 'de dominica oratione'], url: `${NA}/0507.htm` },
    { keywords: ['on mortality', 'de mortalitate'], url: `${NA}/0507.htm` },
  ],
  'athanasius of alexandria': [
    { keywords: ['on the incarnation', 'de incarnatione'], url: `${NA}/2802.htm` },
    { keywords: ['orations against the arians', 'against the arians'], url: `${NA}/2803.htm` },
    { keywords: ['life of antony', 'life of anthony'], url: `${NA}/2811.htm` },
    { keywords: ['letters', 'epistles', 'festal letters'], url: `${NA}/2806.htm` },
    { keywords: ['on the council of nicaea', 'de decretis'], url: `${NA}/2802.htm` },
  ],
  'cyril of alexandria': [
    { keywords: ['letters', 'epistles', 'third letter to nestorius'], url: `${NA}/2092.htm` },
    { keywords: ['twelve anathemas'], url: `${NA}/2092.htm` },
    { keywords: ['on the unity of christ'], url: `${NA}/2092.htm` },
  ],
  'john of damascus': [
    { keywords: ['an exact exposition', 'orthodox faith', 'de fide orthodoxa'], url: `${CCEL}/schaff/npnf209` },
    { keywords: ['on holy images', 'against the iconoclasts', 'three treatises on divine images'], url: `${CCEL}/schaff/npnf209` },
  ],
  'leo the great': [
    { keywords: ['tome of leo', 'letter to flavian', 'tome'], url: `${NA}/3601.htm` },
    { keywords: ['sermons', 'sermon', 'homilies'], url: `${NA}/3601.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/3601.htm` },
  ],
  'ambrose of milan': [
    { keywords: ['on the mysteries', 'de mysteriis'], url: `${NA}/2104.htm` },
    { keywords: ['on the sacraments', 'de sacramentis'], url: `${NA}/2104.htm` },
    { keywords: ['on the duties of the clergy', 'de officiis ministrorum'], url: `${NA}/2104.htm` },
    { keywords: ['on the holy spirit', 'de spiritu sancto'], url: `${NA}/2104.htm` },
    { keywords: ['letters', 'epistles'], url: `${NA}/2104.htm` },
  ],
  'ignatius of antioch': [
    { keywords: ['epistle to the ephesians', 'letter to the ephesians'], url: `${CCEL}/schaff/anf01` },
    { keywords: ['epistle to the romans', 'letter to the romans'], url: `${CCEL}/schaff/anf01` },
    { keywords: ['epistle to the smyrnaeans', 'letter to smyrna'], url: `${CCEL}/schaff/anf01` },
    { keywords: ['letters', 'epistles'], url: `${CCEL}/schaff/anf01` },
  ],
  'thomas aquinas': [
    { keywords: ['summa theologica', 'summa theologiae'], url: `${CCEL}/aquinas/summa.i.html` },
    { keywords: ['catena aurea'], url: `${CCEL}/aquinas/catena1.i.html` },
    { keywords: ['summa contra gentiles'], url: `${CCEL}/aquinas/gentiles.i.html` },
  ],
  'hippolytus of rome': [
    { keywords: ['refutation of all heresies', 'philosophumena'], url: `${NA}/0503.htm` },
    { keywords: ['apostolic tradition', 'on the apostolic tradition'], url: `${NA}/0503.htm` },
    { keywords: ['on christ and antichrist'], url: `${NA}/0503.htm` },
  ],
  'eusebius of caesarea': [
    { keywords: ['ecclesiastical history', 'church history', 'historia ecclesiastica'], url: `${NA}/2901.htm` },
    { keywords: ['life of constantine', 'de vita constantini'], url: `${NA}/2902.htm` },
    { keywords: ['preparation for the gospel', 'praeparatio evangelica'], url: `${NA}/2903.htm` },
  ],
  'cyril of jerusalem': [
    { keywords: ['catechetical lectures', 'catecheses', 'mystagogical catecheses'], url: `${NA}/3101.htm` },
  ],
}

export function lookupWorkByTitle(fatherName: string, workTitle: string): string | null {
  const nl = fatherName.toLowerCase().replace(/^(saint|st\.?|blessed|venerable)\s+/i, '').trim()
  const wl = workTitle.toLowerCase()
  // Sort keys longest-first so more specific names win (e.g. 'john chrysostom' before 'john')
  const keys = Object.keys(WORK_TITLE_MAP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (!nl.includes(key) && !key.includes(nl)) continue
    for (const entry of WORK_TITLE_MAP[key]) {
      if (entry.keywords.some(kw => wl.includes(kw))) return entry.url
    }
  }
  return null
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
 *   1. Google site-search using the quote text (finds exact passage on New Advent/CCEL)
 *   2. Known book-specific work (e.g. Chrysostom on Matthew → commentary index)
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
  const authorUrl = AUTHOR_MAP[fatherName] ?? AUTHOR_MAP[name]

  // 1. Quote-text search — finds the exact passage via Google site search
  if (quoteText?.trim()) return buildSearchUrl(quoteText, authorUrl)

  // 2. Book-specific work — commentary index when no quote text available
  const byFather = WORK_MAP[fatherName] ?? WORK_MAP[name]
  if (byFather?.[book]) return byFather[book]

  // 3. Author-level fallback
  if (authorUrl) return authorUrl

  // 4. Existing URL that's already a proper work link
  if (existingUrl &&
      (existingUrl.includes('newadvent.org/fathers') || existingUrl.includes('ccel.org')) &&
      !existingUrl.includes('newadvent.org/cathen')
  ) return existingUrl

  return null
}
