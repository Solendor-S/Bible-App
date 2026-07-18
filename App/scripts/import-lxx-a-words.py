"""
Populates the lxx_a_words table (LXX-A = Apostolic Bible, "LXXe") from the
BibleAndroidApp per-word tree at Patristica/data/online/words/lxx/<Book>/<ch>.json.

That tree is the STEPBible Apostolic ("A") line: fully tagged (p/t/tr/s/g/m with
Robinson-style morph) AND already versified to match the app (MT/KJV numbering),
unlike the raw Rahlfs/Swete lines which use LXX numbering. It's a distinct edition
from the untagged `lxx_words` table (which stays as the app's original "LXX").

Usage:  python scripts/import-lxx-a-words.py
Re-runnable (drops + reinserts). No full build-db needed.
"""

import sqlite3, json, glob, os, unicodedata

HERE = os.path.dirname(__file__)
TREE = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'BibleAndroidApp',
                                     'Patristica', 'data', 'online', 'words', 'lxx'))
DB   = os.path.normpath(os.path.join(HERE, '..', 'data', 'bible.db'))

assert os.path.isdir(TREE), f"Apostolic LXX tree not found: {TREE}"
assert os.path.exists(DB), f"bible.db not found: {DB}"


def norm(greek: str) -> str:
    d = unicodedata.normalize('NFD', greek.lower())
    return ''.join(c for c in d if unicodedata.category(c) != 'Mn' and c.isalpha())


# The tree's `tr` field is unaccented Greek, not Latin — generate a Latin transliteration
# so the pill matches the other sources (Hebrew "be.reshit", NT "Biblos").
GK2LAT = {
    'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'e', 'θ': 'th',
    'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
    'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
}


def translit(greek: str) -> str:
    dec = unicodedata.normalize('NFD', greek)
    rough = '̔' in dec  # rough breathing → leading h
    base = ''.join(c for c in dec if unicodedata.category(c) != 'Mn').lower()
    for di, rep in (('ου', 'ou'), ('αυ', 'au'), ('ευ', 'eu'), ('ηυ', 'eu')):
        base = base.replace(di, rep)  # diphthongs with upsilon → u, not y
    latin = ''.join(GK2LAT.get(c, c) for c in base if c.strip())
    if latin:
        if rough and latin[0] in 'aeiouy':
            latin = 'h' + latin
        elif base[:1] == 'ρ':
            latin = 'rh' + latin[1:]
    return latin


db = sqlite3.connect(DB)
c = db.cursor()
c.execute("""
    CREATE TABLE IF NOT EXISTS lxx_a_words (
      book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
      position INTEGER NOT NULL, greek TEXT NOT NULL,
      translit TEXT, strongs TEXT, gloss TEXT, morph TEXT, greek_norm TEXT,
      PRIMARY KEY (book, chapter, verse, position)
    )""")
c.execute("DELETE FROM lxx_a_words")

rows = []
for book_dir in sorted(glob.glob(os.path.join(TREE, '*'))):
    book = os.path.basename(book_dir)
    for fp in glob.glob(os.path.join(book_dir, '*.json')):
        chapter = int(os.path.splitext(os.path.basename(fp))[0])
        data = json.load(open(fp, encoding='utf-8'))
        for verse_str, words in data.items():
            verse = int(verse_str)
            for w in words:
                greek = w.get('t', '')
                rows.append((book, chapter, verse, w.get('p', 0), greek,
                             translit(greek), w.get('s'), w.get('g'), w.get('m'), norm(greek)))

c.executemany(
    "INSERT OR REPLACE INTO lxx_a_words "
    "(book, chapter, verse, position, greek, translit, strongs, gloss, morph, greek_norm) "
    "VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
c.execute("CREATE INDEX IF NOT EXISTS idx_lxx_a_words_greek_norm ON lxx_a_words(greek_norm)")
db.commit()

n = c.execute("SELECT COUNT(*) FROM lxx_a_words").fetchone()[0]
m = c.execute("SELECT COUNT(*) FROM lxx_a_words WHERE morph IS NOT NULL AND morph<>''").fetchone()[0]
b = c.execute("SELECT COUNT(DISTINCT book) FROM lxx_a_words").fetchone()[0]
print(f"lxx_a_words: {n} rows across {b} books; morph populated on {m}")
db.close()
