"""
Fill missing OT Hebrew word data from STEPBible TAHOT.
Downloads only the TAHOT file(s) covering books with missing chapters,
cross-checks 20 random existing DB entries to confirm format compatibility,
then appends new entries to ot-words.json and ot-glosses.json.

Run:
  python scripts/fetch-hebrew-gaps.py             # full run
  python scripts/fetch-hebrew-gaps.py --dry-run   # check + report, no writes
"""

import sys
import os
import re
import json
import io
import sqlite3
import random
import urllib.request
import argparse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DB_PATH    = os.path.join(os.path.dirname(__file__), '..', 'data', 'bible.db')
WORDS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'ot-words.json')
GLOSS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'ot-glosses.json')

# STEPBible TAHOT files (4 parts covering the full OT)
BASE_URL = (
    'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/'
    'Translators%20Amalgamated%20OT%2BNT/'
)
TAHOT_FILES = {
    'Gen-Deu': BASE_URL + 'TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    'Jos-Est': BASE_URL + 'TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    'Job-Sng': BASE_URL + 'TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
    'Isa-Mal': BASE_URL + 'TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt',
}

# TAHOT book abbreviation → our DB book name
BOOK_MAP = {
    'Gen': 'Genesis',        'Exo': 'Exodus',         'Lev': 'Leviticus',
    'Num': 'Numbers',        'Deu': 'Deuteronomy',    'Jos': 'Joshua',
    'Jdg': 'Judges',         'Rut': 'Ruth',            '1Sa': '1 Samuel',
    '2Sa': '2 Samuel',       '1Ki': '1 Kings',         '2Ki': '2 Kings',
    '1Ch': '1 Chronicles',   '2Ch': '2 Chronicles',   'Ezr': 'Ezra',
    'Neh': 'Nehemiah',       'Est': 'Esther',          'Job': 'Job',
    'Psa': 'Psalms',         'Pro': 'Proverbs',        'Ecc': 'Ecclesiastes',
    'Sol': 'Song of Solomon','Sng': 'Song of Solomon', 'Son': 'Song of Solomon',
    'Isa': 'Isaiah',         'Jer': 'Jeremiah',        'Lam': 'Lamentations',
    'Eze': 'Ezekiel',        'Dan': 'Daniel',          'Hos': 'Hosea',
    'Jol': 'Joel',           'Joe': 'Joel',            'Amo': 'Amos',
    'Oba': 'Obadiah',        'Jon': 'Jonah',           'Mic': 'Micah',
    'Nah': 'Nahum',          'Hab': 'Habakkuk',        'Zep': 'Zephaniah',
    'Hag': 'Haggai',         'Zec': 'Zechariah',      'Mal': 'Malachi',
}

# Which TAHOT file covers each book
FILE_FOR_BOOK = {}
for abbr in ['Gen','Exo','Lev','Num','Deu']:
    FILE_FOR_BOOK[BOOK_MAP[abbr]] = 'Gen-Deu'
for abbr in ['Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est']:
    FILE_FOR_BOOK[BOOK_MAP[abbr]] = 'Jos-Est'
for abbr in ['Job','Psa','Pro','Ecc','Sol']:
    FILE_FOR_BOOK[BOOK_MAP[abbr]] = 'Job-Sng'
for abbr in ['Isa','Jer','Lam','Eze','Dan','Hos','Jol','Amo','Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zec','Mal']:
    FILE_FOR_BOOK[BOOK_MAP[abbr]] = 'Isa-Mal'

# Missing chapters (book, chapter) — from DB audit
MISSING_CHAPTERS = {
    ('1 Chronicles', 6), ('1 Kings', 5), ('1 Samuel', 21), ('1 Samuel', 24),
    ('2 Chronicles', 2), ('2 Chronicles', 14), ('2 Kings', 12), ('2 Samuel', 19),
    ('Daniel', 4), ('Daniel', 6), ('Deuteronomy', 13), ('Deuteronomy', 23),
    ('Deuteronomy', 29), ('Ecclesiastes', 5), ('Exodus', 8), ('Exodus', 22),
    ('Genesis', 32), ('Hosea', 2), ('Hosea', 12), ('Hosea', 14),
    ('Isaiah', 9), ('Isaiah', 64), ('Jeremiah', 9), ('Job', 41),
    ('Jonah', 2), ('Leviticus', 6), ('Malachi', 4), ('Micah', 5),
    ('Nehemiah', 4), ('Nehemiah', 10), ('Numbers', 17), ('Numbers', 30),
    ('Psalms', 3), ('Psalms', 4), ('Psalms', 5), ('Psalms', 6), ('Psalms', 7),
    ('Psalms', 8), ('Psalms', 9), ('Psalms', 12), ('Psalms', 18), ('Psalms', 19),
    ('Psalms', 20), ('Psalms', 21), ('Psalms', 22), ('Psalms', 30), ('Psalms', 31),
    ('Psalms', 34), ('Psalms', 36), ('Psalms', 38), ('Psalms', 39), ('Psalms', 40),
    ('Psalms', 41), ('Psalms', 42), ('Psalms', 44), ('Psalms', 45), ('Psalms', 46),
    ('Psalms', 47), ('Psalms', 48), ('Psalms', 49), ('Psalms', 51), ('Psalms', 52),
    ('Psalms', 53), ('Psalms', 54), ('Psalms', 55), ('Psalms', 56), ('Psalms', 57),
    ('Psalms', 58), ('Psalms', 59), ('Psalms', 60), ('Psalms', 61), ('Psalms', 62),
    ('Psalms', 63), ('Psalms', 64), ('Psalms', 65), ('Psalms', 67), ('Psalms', 68),
    ('Psalms', 69), ('Psalms', 70), ('Psalms', 75), ('Psalms', 76), ('Psalms', 77),
    ('Psalms', 80), ('Psalms', 81), ('Psalms', 83), ('Psalms', 84), ('Psalms', 85),
    ('Psalms', 88), ('Psalms', 89), ('Psalms', 92), ('Psalms', 102), ('Psalms', 108),
    ('Psalms', 140), ('Psalms', 142), ('Zechariah', 2),
}

# Which files we actually need to download
NEEDED_FILES = sorted({FILE_FOR_BOOK[book] for book, _ in MISSING_CHAPTERS})

# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def parse_ref(ref_str):
    """Parse 'Gen.1.1#01=L' → (book_name, chapter, verse, position, type) or None."""
    # Reference may have Hebrew verse in parens: Mic.5.1(4.14)#01=L
    m = re.match(r'^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\(\d+(?:\.\d+)?\))?#(\d+)=([A-Z])$', ref_str)
    if not m:
        return None
    abbr, ch, vs, pos, typ = m.groups()
    book = BOOK_MAP.get(abbr)
    if not book:
        return None
    return book, int(ch), int(vs), int(pos), typ


def clean_gloss(translation_col):
    """Extract root-word gloss from TAHOT Translation column.
    'in/ beginning' → 'beginning'
    'and/ it will be' → 'it will be'
    'he created' → 'he created'
    """
    # Remove implied-word markers
    text = re.sub(r'<[^>]*>', '', translation_col)
    text = re.sub(r'\[[^\]]*\]', '', text)
    text = text.strip()
    if not text:
        return None
    # If prefix/suffix separated by ' / ', take the last non-empty segment
    parts = [p.strip() for p in text.split('/') if p.strip()]
    return parts[-1] if parts else None


def parse_line(line):
    """Parse one TSV data line. Returns dict or None."""
    if not line or line.startswith('#'):
        return None
    cols = line.rstrip('\n').split('\t')
    if len(cols) < 9:
        return None
    ref_str = cols[0].strip()
    parsed = parse_ref(ref_str)
    if not parsed:
        return None
    book, chapter, verse, position, typ = parsed
    if typ != 'L':      # Only Leningrad text (skip Qere, Ketiv, Restored, LXX)
        return None
    hebrew  = cols[1].strip()
    translit = cols[2].strip()
    gloss_raw = cols[3].strip()
    morph   = cols[5].strip()
    strongs = cols[8].strip() if len(cols) > 8 else ''
    # Strip instance disambiguator suffix added in newer TAHOT versions (e.g. H2449_A → H2449)
    strongs = re.sub(r'_[A-Z]$', '', strongs)
    if not hebrew or not strongs:
        return None
    gloss = clean_gloss(gloss_raw)
    return {
        'book': book, 'chapter': chapter, 'verse': verse, 'position': position,
        'hebrew': hebrew, 'translit': translit, 'strongs': strongs,
        'morph': morph, 'gloss': gloss,
    }

# ---------------------------------------------------------------------------
# Download + stream parse
# ---------------------------------------------------------------------------

def download_file(file_key):
    """Download a TAHOT file and return its lines as a list."""
    url = TAHOT_FILES[file_key]
    print(f'Downloading {file_key}...', flush=True)
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; BibleApp/2.0)',
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
        print(f'  {len(raw):,} bytes', flush=True)
        return raw.decode('utf-8', errors='replace').splitlines()
    except Exception as e:
        print(f'  ERROR: {e}', file=sys.stderr)
        return None


def parse_all_words(lines, filter_chapters=None):
    """Parse all words from lines. If filter_chapters is a set of (book, chapter),
    only return those. Also returns a sample dict keyed by (book,ch,vs,pos)."""
    words = []
    for line in lines:
        w = parse_line(line)
        if w is None:
            continue
        key = (w['book'], w['chapter'])
        if filter_chapters is not None and key not in filter_chapters:
            continue
        words.append(w)
    return words

# ---------------------------------------------------------------------------
# Cross-check
# ---------------------------------------------------------------------------

def load_db_sample(n=20):
    """Load n random Hebrew word entries from the DB for cross-checking."""
    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()
    cur.execute('''
        SELECT book, chapter, verse, position, hebrew, translit, strongs, morph
        FROM hebrew_words
        ORDER BY RANDOM()
        LIMIT ?
    ''', (n,))
    rows = [{'book':r[0],'chapter':r[1],'verse':r[2],'position':r[3],
              'hebrew':r[4],'translit':r[5],'strongs':r[6],'morph':r[7]}
            for r in cur.fetchall()]
    db.close()
    return rows


def cross_check(db_sample, tahot_by_key):
    """Compare DB sample entries against TAHOT parsed data.
    Returns (matches, mismatches, not_found).
    """
    matches, mismatches, not_found = 0, 0, 0
    for row in db_sample:
        key = (row['book'], row['chapter'], row['verse'], row['position'])
        tahot = tahot_by_key.get(key)
        if tahot is None:
            not_found += 1
            continue
        fields = ['hebrew', 'translit', 'strongs', 'morph']
        if all(row[f] == tahot[f] for f in fields):
            matches += 1
        else:
            mismatches += 1
            print(f'  MISMATCH {row["book"]} {row["chapter"]}:{row["verse"]} pos={row["position"]}')
            for f in fields:
                if row[f] != tahot[f]:
                    print(f'    {f}: DB={row[f]!r}  TAHOT={tahot[f]!r}')
    return matches, mismatches, not_found

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Check only, no writes')
    args = parser.parse_args()

    print(f'Missing chapters: {len(MISSING_CHAPTERS)}')
    print(f'TAHOT files needed: {NEEDED_FILES}')

    # --- Step 1: Download all needed files and parse ---
    all_tahot_words = []       # words for missing chapters
    tahot_all_by_key = {}      # ALL parsed words keyed by (book,ch,vs,pos) for cross-check

    for file_key in NEEDED_FILES:
        lines = download_file(file_key)
        if lines is None:
            print(f'Failed to download {file_key}. Aborting.', file=sys.stderr)
            sys.exit(1)

        # Determine which missing chapters are in this file
        file_missing = {(b, c) for b, c in MISSING_CHAPTERS
                        if FILE_FOR_BOOK.get(b) == file_key}

        # Determine which present chapters in this file we need for cross-check
        # (any chapter NOT in MISSING_CHAPTERS belonging to this file's books)
        file_books = {BOOK_MAP[a] for a, fk in {
            ('Gen','Gen-Deu'),('Exo','Gen-Deu'),('Lev','Gen-Deu'),('Num','Gen-Deu'),('Deu','Gen-Deu'),
            ('Jos','Jos-Est'),('Jdg','Jos-Est'),('Rut','Jos-Est'),('1Sa','Jos-Est'),('2Sa','Jos-Est'),
            ('1Ki','Jos-Est'),('2Ki','Jos-Est'),('1Ch','Jos-Est'),('2Ch','Jos-Est'),('Ezr','Jos-Est'),
            ('Neh','Jos-Est'),('Est','Jos-Est'),
            ('Job','Job-Sng'),('Psa','Job-Sng'),('Pro','Job-Sng'),('Ecc','Job-Sng'),('Sol','Job-Sng'),
            ('Isa','Isa-Mal'),('Jer','Isa-Mal'),('Lam','Isa-Mal'),('Eze','Isa-Mal'),('Dan','Isa-Mal'),
            ('Hos','Isa-Mal'),('Jol','Isa-Mal'),('Amo','Isa-Mal'),('Oba','Isa-Mal'),('Jon','Isa-Mal'),
            ('Mic','Isa-Mal'),('Nah','Isa-Mal'),('Hab','Isa-Mal'),('Zep','Isa-Mal'),
            ('Hag','Isa-Mal'),('Zec','Isa-Mal'),('Mal','Isa-Mal'),
        } if fk == file_key}

        print(f'  Parsing {file_key}...', flush=True)
        for line in lines:
            w = parse_line(line)
            if w is None:
                continue
            if w['book'] not in file_books:
                continue
            key = (w['book'], w['chapter'], w['verse'], w['position'])
            tahot_all_by_key[key] = w
            if (w['book'], w['chapter']) in file_missing:
                all_tahot_words.append(w)

        print(f'  Gap words collected: {len(all_tahot_words)}', flush=True)

    # --- Step 2: Cross-check ---
    print(f'\nCross-checking against DB (20 random existing entries)...')
    db_sample = load_db_sample(20)
    # Filter to only entries that are in the downloaded files
    db_sample_filtered = [r for r in db_sample
                          if (r['book'], r['chapter'], r['verse'], r['position']) in tahot_all_by_key]
    if len(db_sample_filtered) < 10:
        print('  WARNING: few DB entries overlapped with downloaded files for cross-check.')
        print('  Fetching targeted Genesis 1 sample instead...')
        db2 = sqlite3.connect(DB_PATH)
        cur2 = db2.cursor()
        cur2.execute('''SELECT book, chapter, verse, position, hebrew, translit, strongs, morph
                        FROM hebrew_words WHERE book="Genesis" AND chapter=1 LIMIT 20''')
        db_sample_filtered = [{'book':r[0],'chapter':r[1],'verse':r[2],'position':r[3],
                                'hebrew':r[4],'translit':r[5],'strongs':r[6],'morph':r[7]}
                               for r in cur2.fetchall()]
        db2.close()

    matches, mismatches, not_found = cross_check(db_sample_filtered, tahot_all_by_key)
    total = len(db_sample_filtered)
    print(f'  Results: {matches}/{total} exact match, {mismatches} mismatch, {not_found} not in download')

    threshold = 0.85
    match_rate = matches / total if total > 0 else 0
    if match_rate < threshold:
        print(f'\nCross-check FAILED ({match_rate:.0%} < {threshold:.0%} threshold).')
        print('Format may differ from current data. Aborting — no files written.')
        print('Inspect mismatches above and re-run with --dry-run to investigate.')
        sys.exit(1)

    print(f'\nCross-check PASSED ({match_rate:.0%}). Format is compatible.')

    if not all_tahot_words:
        print('No new words to add. Done.')
        return

    print(f'\nNew words to add: {len(all_tahot_words)}')
    by_chapter = {}
    for w in all_tahot_words:
        k = (w['book'], w['chapter'])
        by_chapter[k] = by_chapter.get(k, 0) + 1
    for k in sorted(by_chapter):
        print(f'  {k[0]} {k[1]}: {by_chapter[k]} words')

    if args.dry_run:
        print('\n--dry-run: no files written.')
        return

    # --- Step 3: Append to ot-words.json ---
    print(f'\nLoading {WORDS_PATH}...', flush=True)
    with open(WORDS_PATH, encoding='utf-8') as f:
        existing_words = json.load(f)

    new_words = [
        {'book': w['book'], 'chapter': w['chapter'], 'verse': w['verse'],
         'position': w['position'], 'hebrew': w['hebrew'], 'translit': w['translit'],
         'strongs': w['strongs'], 'morph': w['morph']}
        for w in all_tahot_words
    ]
    existing_words.extend(new_words)
    print(f'Writing {WORDS_PATH} ({len(existing_words):,} total words)...', flush=True)
    with open(WORDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing_words, f, ensure_ascii=False)
    print('  Done.')

    # --- Step 4: Append to ot-glosses.json ---
    print(f'Loading {GLOSS_PATH}...', flush=True)
    with open(GLOSS_PATH, encoding='utf-8') as f:
        existing_glosses = json.load(f)

    new_glosses = [
        {'book': w['book'], 'chapter': w['chapter'], 'verse': w['verse'],
         'position': w['position'], 'gloss': w['gloss']}
        for w in all_tahot_words if w['gloss']
    ]
    existing_glosses.extend(new_glosses)
    print(f'Writing {GLOSS_PATH} ({len(existing_glosses):,} total glosses)...', flush=True)
    with open(GLOSS_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing_glosses, f, ensure_ascii=False)
    print('  Done.')

    print(f'\nAll done! Now run: npm run build-db')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
