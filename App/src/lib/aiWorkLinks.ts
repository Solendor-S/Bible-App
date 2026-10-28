// Work-title URLs for the AI Scholar's [FATHER: …] citations (desktop-only feature).
// Reader-side "Read full text" links live in data/sourceLinks.ts (from the Android app).

const NA   = 'https://www.newadvent.org/fathers'
const CCEL = 'https://www.ccel.org/ccel'
const TERT = 'https://www.tertullian.org/fathers'

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
