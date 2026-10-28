import { APOCRYPHA_FETCHED_VERSES } from './apocryphaVerses'

export interface ApocryphaBookSeed {
  book: string
  book_order: number
  group_label: string
  chapter_count: number
}

export interface ApocryphaVerseSeed {
  book: string
  chapter: number
  verse: number
  text: string
}

export const APOCRYPHA_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS apocrypha_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT NOT NULL UNIQUE,
    book_order INTEGER NOT NULL,
    group_label TEXT NOT NULL,
    chapter_count INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS apocrypha_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT NOT NULL,
    book_order INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_apocrypha_loc ON apocrypha_verses(book, chapter, verse);
  CREATE INDEX IF NOT EXISTS idx_apocrypha_book ON apocrypha_verses(book);
`

export const APOCRYPHA_BOOKS: ApocryphaBookSeed[] = [
  // Deuterocanon — accepted by Catholic, Orthodox, and Ethiopian churches
  { book: 'Tobit', book_order: 67, group_label: 'Deuterocanon', chapter_count: 14 },
  { book: 'Judith', book_order: 68, group_label: 'Deuterocanon', chapter_count: 16 },
  { book: 'Wisdom of Solomon', book_order: 69, group_label: 'Deuterocanon', chapter_count: 19 },
  { book: 'Sirach', book_order: 70, group_label: 'Deuterocanon', chapter_count: 51 },
  { book: 'Baruch', book_order: 71, group_label: 'Deuterocanon', chapter_count: 6 },
  { book: '1 Maccabees', book_order: 72, group_label: 'Deuterocanon', chapter_count: 16 },
  { book: '2 Maccabees', book_order: 73, group_label: 'Deuterocanon', chapter_count: 15 },
  { book: '1 Esdras', book_order: 74, group_label: 'Deuterocanon', chapter_count: 9 },
  { book: '2 Esdras', book_order: 75, group_label: 'Deuterocanon', chapter_count: 16 },
  { book: 'Prayer of Manasseh', book_order: 76, group_label: 'Deuterocanon', chapter_count: 1 },
  { book: 'Psalm 151', book_order: 77, group_label: 'Deuterocanon', chapter_count: 1 },
  { book: 'Prayer of Azariah', book_order: 78, group_label: 'Deuterocanon', chapter_count: 1 },
  { book: 'Susanna', book_order: 79, group_label: 'Deuterocanon', chapter_count: 1 },
  { book: 'Bel and the Dragon', book_order: 80, group_label: 'Deuterocanon', chapter_count: 1 },
  // Broader canon — accepted by Orthodox and Ethiopian churches
  { book: '3 Maccabees', book_order: 81, group_label: 'Broader Canon', chapter_count: 7 },
  { book: '4 Maccabees', book_order: 82, group_label: 'Broader Canon', chapter_count: 18 },
  // Ethiopian Orthodox Tewahedo unique books
  { book: '1 Enoch', book_order: 83, group_label: 'Ethiopian Canon', chapter_count: 108 },
  { book: 'Jubilees', book_order: 84, group_label: 'Ethiopian Canon', chapter_count: 50 },
  { book: '1 Meqabyan', book_order: 85, group_label: 'Ethiopian Canon', chapter_count: 7 },
  { book: '2 Meqabyan', book_order: 86, group_label: 'Ethiopian Canon', chapter_count: 21 },
  { book: '3 Meqabyan', book_order: 87, group_label: 'Ethiopian Canon', chapter_count: 10 },
]

// Baseline short books + anything not covered by the fetch script
const APOCRYPHA_BASELINE: ApocryphaVerseSeed[] = [
  // ── Prayer of Manasseh ────────────────────────────────────────────────────
  // KJV Apocrypha (1611), public domain
  { book: 'Prayer of Manasseh', chapter: 1, verse: 1, text: 'O Lord, Almighty God of our fathers, Abraham, Isaac, and Jacob, and of their righteous seed;' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 2, text: 'Who hast made heaven and earth, with all the ornament thereof;' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 3, text: 'Who hast bound the sea by the word of thy commandment; who hast shut up the deep, and sealed it by thy terrible and glorious name;' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 4, text: 'Whom all men fear, and tremble before thy power; for the majesty of thy glory cannot be borne, and thine angry threatening toward sinners is importable:' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 5, text: 'But thy merciful promise is unmeasurable and unsearchable; for thou art the most high Lord, of great compassion, longsuffering, very merciful, and repentest of the evils of men.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 6, text: 'Thou, O Lord, according to thy great goodness hast promised repentance and forgiveness to them that have sinned against thee: and of thine infinite mercies hast appointed repentance unto sinners, that they may be saved.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 7, text: 'Thou therefore, O Lord, that art the God of the just, hast not appointed repentance to the just, as to Abraham, and Isaac, and Jacob, which have not sinned against thee; but thou hast appointed repentance unto me that am a sinner:' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 8, text: 'For I have sinned above the number of the sands of the sea. My transgressions, O Lord, are multiplied: my transgressions are multiplied, and I am not worthy to behold and see the height of heaven for the multitude of mine iniquities.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 9, text: 'I am bowed down with many iron bands, that I cannot lift up mine head, neither have any release: for I have provoked thy wrath, and done evil before thee: I did not thy will, neither kept I thy commandments: I have set up abominations, and have multiplied offences.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 10, text: 'Now therefore I bow the knee of mine heart, beseeching thee of grace.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 11, text: 'I have sinned, O Lord, I have sinned, and I acknowledge mine iniquities: wherefore, I humbly beseech thee, forgive me, O Lord, forgive me, and destroy me not with mine iniquities.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 12, text: 'Be not angry with me for ever, by reserving evil for me; neither condemn me into the lower parts of the earth. For thou art the God, even the God of them that repent;' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 13, text: 'And in me thou wilt shew all thy goodness: for thou wilt save me, that am unworthy, according to thy great mercy.' },
  { book: 'Prayer of Manasseh', chapter: 1, verse: 14, text: 'Therefore I will praise thee for ever all the days of my life: for all the powers of the heavens do praise thee, and thine is the glory for ever and ever. Amen.' },

  // ── Psalm 151 ─────────────────────────────────────────────────────────────
  // KJV Apocrypha (1611) / LXX, public domain
  { book: 'Psalm 151', chapter: 1, verse: 1, text: 'I was small among my brethren, and youngest in my father\'s house: I kept my father\'s sheep.' },
  { book: 'Psalm 151', chapter: 1, verse: 2, text: 'My hands made an instrument, and my fingers tuned a psaltery.' },
  { book: 'Psalm 151', chapter: 1, verse: 3, text: 'And who shall tell my Lord? The Lord himself, he heareth.' },
  { book: 'Psalm 151', chapter: 1, verse: 4, text: 'He sent his angel, and took me from my father\'s sheep, and anointed me with the oil of his anointing.' },
  { book: 'Psalm 151', chapter: 1, verse: 5, text: 'My brethren were tall of stature and comely; but the Lord did not take pleasure in them.' },
  { book: 'Psalm 151', chapter: 1, verse: 6, text: 'I went out to meet the Philistine; and he cursed me by his idols.' },
  { book: 'Psalm 151', chapter: 1, verse: 7, text: 'But I drew his own sword, and beheaded him, and removed the reproach from the children of Israel.' },
]

// Merge: fetched data takes priority; baseline fills gaps for books not fetched
const fetchedBooks = new Set(APOCRYPHA_FETCHED_VERSES.map(v => v.book))
export const APOCRYPHA_VERSES: ApocryphaVerseSeed[] = [
  ...APOCRYPHA_FETCHED_VERSES,
  ...APOCRYPHA_BASELINE.filter(v => !fetchedBooks.has(v.book)),
]
