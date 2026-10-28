// Data from the Android app (Patristica src/screens/CanonPanel.tsx), extracted verbatim.

export type BookStatus = 'Accepted' | 'Disputed' | 'Rejected'
export type Era = 'Pre-Nicene' | 'Nicene' | 'Post-Nicene'

export interface DisputedBook {
  name: string
  testament: 'NT' | 'OT'
  status: Record<Era, BookStatus>
  notes: string
}

export interface CanonMilestone {
  yearNum: number
  year: string
  event: string
  significance: string
}

export interface PrimarySource {
  title: string
  year: string
  text: string
}

// ── Data ─────────────────────────────────────────────────

export const DISPUTED_BOOKS: DisputedBook[] = [
  {
    name: 'Hebrews',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Authorship contested (Pauline? Apollos? Priscilla?). Accepted in the East before the West; doubted by Origen ("only God knows who wrote it"). Athanasius included it; Jerome resolved Western doubts.',
  },
  {
    name: 'James',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Eusebius listed it as disputed. Some questioned apostolic authorship. Luther famously called it "an epistle of straw" for its emphasis on works, but it was universally accepted by the 5th century.',
  },
  {
    name: '2 Peter',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Most disputed NT letter. Origen knew it was questioned. Eusebius listed it as disputed (antilegomena). Its vocabulary and style differ markedly from 1 Peter. Accepted by the late 4th century.',
  },
  {
    name: '2 John',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Questioned because of its brief length and the anonymous authorial title "the elder." Eusebius classified both 2 and 3 John as disputed. Universally accepted by Chalcedon.',
  },
  {
    name: '3 John',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Same questions as 2 John. The shortest NT book. Listed among the antilegomena by Eusebius. Accepted by the late 4th century.',
  },
  {
    name: 'Jude',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'Questioned because it quotes 1 Enoch (v. 14) and the Assumption of Moses (v. 9), non-canonical Jewish texts. Origen knew it was doubted. Accepted by Athanasius and the later councils.',
  },
  {
    name: 'Revelation',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Disputed', 'Nicene': 'Disputed', 'Post-Nicene': 'Accepted' },
    notes: 'The most contested book in church history. Rejected by Dionysius of Alexandria, Eusebius, and most Eastern churches well into the 4th century. Rejected as non-apostolic by some Eastern churches until the 9th century. Athanasius\'s 367 letter was decisive in the West. Still not read in the Eastern Orthodox lectionary.',
  },
  {
    name: 'Shepherd of Hermas',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Disputed', 'Post-Nicene': 'Rejected' },
    notes: 'Widely read and treated as Scripture by Irenaeus, Clement of Alexandria, and Origen. Included in the Codex Sinaiticus (4th century). Eusebius listed it as disputed. Athanasius\'s 367 letter excluded it. Gradually removed from the canon.',
  },
  {
    name: '1 Clement',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Disputed', 'Post-Nicene': 'Rejected' },
    notes: 'Treated as Scripture by some early fathers. Included in the Codex Alexandrinus (5th century). Eusebius listed it as disputed. Excluded by Athanasius\'s 367 letter. Valuable as the earliest post-apostolic Christian letter (c. 96 AD).',
  },
  {
    name: 'Didache',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Disputed', 'Post-Nicene': 'Rejected' },
    notes: 'Referred to as Scripture by Clement of Alexandria and Origen. Eusebius listed it as a rejected spurious book. Athanasius excluded it. Rediscovered in 1873 in Constantinople after being lost for centuries.',
  },
  {
    name: 'Epistle of Barnabas',
    testament: 'NT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Rejected', 'Post-Nicene': 'Rejected' },
    notes: 'Quoted as Scripture by Clement of Alexandria. Included in the Codex Sinaiticus after Revelation. Origen and Eusebius regarded it as spurious. Excluded by Athanasius.',
  },
  {
    name: 'Wisdom of Solomon',
    testament: 'OT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Disputed', 'Post-Nicene': 'Disputed' },
    notes: 'Part of the Greek LXX but absent from the Hebrew canon. Quoted as Scripture by Irenaeus. Jerome excluded it from his Hebrew-only Vulgate canon. Augustine and the Council of Carthage (397) included it. Remains in Catholic and Orthodox OT; excluded in Protestant.',
  },
  {
    name: 'Sirach (Ecclesiasticus)',
    testament: 'OT',
    status: { 'Pre-Nicene': 'Accepted', 'Nicene': 'Disputed', 'Post-Nicene': 'Disputed' },
    notes: 'Present in the LXX. Frequently quoted by early fathers. Jerome\'s Vulgate placed it among the "ecclesiastical books" (useful but not canonical). Status remains divided between Catholic/Orthodox (canonical) and Protestant (Apocrypha).',
  },
]

export const MILESTONES: CanonMilestone[] = [
  {
    yearNum: 170,
    year: 'c. 170 AD',
    event: 'Muratorian Fragment',
    significance:
      'Earliest surviving canon list, discovered by Ludovico Muratori in 1740. Lists the 4 Gospels, Acts, 13 Pauline epistles, Jude, 1-2 John, Revelation, and Wisdom of Solomon as accepted. Explicitly rejects the Shepherd of Hermas for public reading (but allows private reading) and rejects the Epistle to the Laodiceans. Excludes Hebrews, James, 1-2 Peter, 3 John.',
  },
  {
    yearNum: 250,
    year: 'c. 250 AD',
    event: "Origen's Canon Discussion",
    significance:
      'Origen (c. 184–253) was the first to distinguish clearly between "acknowledged" books and "disputed" books (antilegomena). He accepted as undisputed: the four Gospels, Acts, 13 Pauline epistles, 1 Peter, 1 John, Revelation. He noted Hebrews, 2 Peter, 2-3 John, Jude, James, Barnabas, Hermas, and Didache were disputed. His work Hexapla also established critical OT text scholarship.',
  },
  {
    yearNum: 325,
    year: 'c. 313–325 AD',
    event: "Eusebius's Three Categories",
    significance:
      "In his Ecclesiastical History (c. 313–325), Eusebius of Caesarea proposed a three-part classification: (1) Accepted (homologoumena): the four Gospels, Acts, Pauline epistles, 1 John, 1 Peter, possibly Revelation; (2) Disputed (antilegomena): James, Jude, 2 Peter, 2-3 John; (3) Rejected (notha): Acts of Paul, Shepherd of Hermas, Apocalypse of Peter, Epistle of Barnabas, Didache, possibly Revelation. Eusebius's framework became the standard reference for subsequent canon discussions.",
  },
  {
    yearNum: 367,
    year: '367 AD',
    event: "Athanasius's 39th Festal Letter",
    significance:
      "In his annual Easter letter to Egyptian churches, Athanasius of Alexandria listed exactly the 27 books now in the NT—the first document to do so. He explicitly named them as 'canonized' (kanonizomena) and distinguished them from 'apocryphal' writings. He included the 39 OT books of the Hebrew canon. His list is the first to match the modern Protestant Bible exactly. This letter was decisive for the Western churches.",
  },
  {
    yearNum: 397,
    year: '393–397 AD',
    event: 'North African Councils (Hippo & Carthage)',
    significance:
      "The Council of Hippo (393) and Council of Carthage (397), attended by Augustine of Hippo, ratified the 27-book NT canon and an OT canon including the deuterocanonical books (Tobit, Judith, 1-2 Maccabees, Wisdom, Sirach, Baruch). These councils gave formal regional authority to what Athanasius had established. Their canon became the standard for the Western Latin church and was confirmed at Trent (1546) for the Catholic Church.",
  },
]

export const PRIMARY_SOURCES: PrimarySource[] = [
  {
    title: "Athanasius's 39th Festal Letter (367 AD) — NT canon",
    year: '367 AD',
    text:
      'Again it is not tedious to speak of the [books] of the New Testament. These are, the four Gospels, according to Matthew, Mark, Luke, and John. Afterwards, the Acts of the Apostles and Epistles (called Catholic), seven, viz. of James, one; of Peter, two; of John, three; after these, one of Jude. In addition, there are fourteen Epistles of Paul, written in this order. The first, to the Romans; then two to the Corinthians; after these, to the Galatians; next, to the Ephesians; then to the Philippians; then to the Colossians; after these, two to the Thessalonians, and that to the Hebrews; and again, two to Timothy; one to Titus; and lastly, that to Philemon. And besides, the Revelation of John.\n\nThese are fountains of salvation, that they who thirst may be satisfied with the living words they contain. In these alone is proclaimed the doctrine of godliness. Let no man add to these, neither let him take ought from these.',
  },
  {
    title: 'Muratorian Fragment (c. 170 AD) — excerpt',
    year: 'c. 170 AD',
    text:
      '…at which nevertheless he was present, and so he placed [them in his narrative]. The third book of the Gospel is that according to Luke. Luke, the well-known physician, after the ascension of Christ, when Paul had taken with him as one zealous for the law, composed it in his own name, according to [the general] belief. Yet he himself had not seen the Lord in the flesh; and therefore, as he was able to ascertain events, so indeed he begins to tell the story from the birth of John.\n\nThe fourth of the Gospels is that of John, [one] of the disciples…\n\nThe Shepherd [of Hermas] he wrote quite lately, in our times, in the city of Rome, while bishop Pius, his brother, was occupying the [episcopal] chair of the church of the city of Rome. And therefore it ought indeed to be read; but it cannot be read publicly to the people in church either among the Prophets, whose number is complete, or among the Apostles, for it is after [their] time.',
  },
]

// ── Status chip colors ────────────────────────────────────

export const STATUS_COLOR: Record<BookStatus, { bg: string; text: string }> = {
  Accepted: { bg: 'rgba(90,168,120,0.20)', text: '#5aa878' },
  Disputed: { bg: 'rgba(196,164,90,0.20)', text: '#c4a45a' },
  Rejected: { bg: 'rgba(196,90,90,0.20)',  text: '#c45a5a' },
}

export const ERAS: Era[] = ['Pre-Nicene', 'Nicene', 'Post-Nicene']

// ── Sub-components ────────────────────────────────────────
