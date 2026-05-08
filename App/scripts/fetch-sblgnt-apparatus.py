"""
Download and parse the SBLGNT textual apparatus for NT variant readings.
Outputs nt-variants.json: one entry per variant per verse.

Source: Society of Biblical Literature Greek New Testament (SBLGNT)
  https://github.com/LogosBible/SBLGNT
  License: CC BY 4.0

Format of each book's apparatus text file:
  Book header:  "Matthew 1:5"  sets current book+chapter:verse
  Variant line: "1:5 SBLGNT_text WH NA28 ] variant_text RP"
     SBLGNT + agreeing editions before ]; differing edition(s) after ]
  Bullet entry: "• ..."  — additional variant in the same verse
  "–" means "omits this word"
  "+ word" means "adds this word"
  ";" separates multiple variant groups after ]

Editions tracked:
  WH   = Westcott & Hort (1881)
  Treg = Tregelles (1857–72)
  NIV  = NA26 text (underlying the NIV)
  NA28 = Nestle-Aland 28th edition
  RP   = Robinson-Pierpont Byzantine Majority Text
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

BASE_RAW = "https://raw.githubusercontent.com/LogosBible/SBLGNT/master/data/sblgntapp/text/"
BASE_API = "https://api.github.com/repos/LogosBible/SBLGNT/contents/data/sblgntapp/text"

BOOK_MAP = {
    "Matthew": "Matthew", "Mark": "Mark", "Luke": "Luke", "John": "John",
    "Acts": "Acts", "Romans": "Romans",
    "1 Corinthians": "1 Corinthians", "2 Corinthians": "2 Corinthians",
    "Galatians": "Galatians", "Ephesians": "Ephesians",
    "Philippians": "Philippians", "Colossians": "Colossians",
    "1 Thessalonians": "1 Thessalonians", "2 Thessalonians": "2 Thessalonians",
    "1 Timothy": "1 Timothy", "2 Timothy": "2 Timothy",
    "Titus": "Titus", "Philemon": "Philemon", "Hebrews": "Hebrews",
    "James": "James",
    "1 Peter": "1 Peter", "2 Peter": "2 Peter",
    "1 John": "1 John", "2 John": "2 John", "3 John": "3 John",
    "Jude": "Jude", "Revelation": "Revelation",
}

# File name → book name mapping for files like "1Cor.txt"
FILENAME_TO_BOOK = {
    "Matt": "Matthew", "Mark": "Mark", "Luke": "Luke", "John": "John",
    "Acts": "Acts", "Rom": "Romans",
    "1Cor": "1 Corinthians", "2Cor": "2 Corinthians",
    "Gal": "Galatians", "Eph": "Ephesians",
    "Phil": "Philippians", "Col": "Colossians",
    "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians",
    "1Tim": "1 Timothy", "2Tim": "2 Timothy",
    "Titus": "Titus", "Phlm": "Philemon", "Heb": "Hebrews",
    "Jas": "James",
    "1Pet": "1 Peter", "2Pet": "2 Peter",
    "1John": "1 John", "2John": "2 John", "3John": "3 John",
    "Jude": "Jude", "Rev": "Revelation",
}

EDITION_LABELS = {
    'WH':   'Westcott & Hort (1881)',
    'Treg': 'Tregelles (1857–72)',
    'NIV':  'NIV Greek text (NA26)',
    'NA28': 'Nestle-Aland 28th edition',
    'RP':   'Robinson-Pierpont (Byzantine Majority Text)',
}
ALL_EDITIONS = {'WH', 'Treg', 'NIV', 'NA28', 'RP'}

script_dir = os.path.dirname(os.path.abspath(__file__))
raw_dir = os.path.join(script_dir, "..", "data", "raw")
cache_dir = os.path.join(raw_dir, "sblgnt_cache")
os.makedirs(cache_dir, exist_ok=True)
out_path = os.path.join(raw_dir, "nt-variants.json")


def fetch_book(filename: str) -> str:
    cache_path = os.path.join(cache_dir, filename)
    if os.path.exists(cache_path):
        with open(cache_path, encoding='utf-8', errors='replace') as f:
            return f.read()
    url = BASE_RAW + filename
    req = urllib.request.Request(url, headers={'User-Agent': 'BibleApp/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode('utf-8', errors='replace')
    except urllib.error.URLError as e:
        print(f"  ERROR fetching {filename}: {e}", file=sys.stderr)
        return ''
    with open(cache_path, 'w', encoding='utf-8') as f:
        f.write(text)
    return text


def get_book_files() -> list[str]:
    req = urllib.request.Request(BASE_API, headers={'User-Agent': 'BibleApp/1.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        items = json.loads(r.read())
    return [item['name'] for item in items if item['name'].endswith('.txt')]


def parse_apparatus_text(text: str, book_name: str) -> list[dict]:
    """
    Parse one book's apparatus text file into variant records.
    Returns list of variant dicts.
    """
    results = []
    current_chapter = 0
    current_verse = 0

    # Header pattern: "Matthew 1:5" or "Luke 22:44"  (full book name)
    header_re = re.compile(r'^[A-Z][a-z].+\s+(\d+):(\d+)\s*$')
    # Inline ref pattern at start of line: "1:5 ..." or "5 ..." or "5–8 ..."
    inline_ref_re = re.compile(r'^(\d+)(?:[:–\-]\d+)?\s+')

    lines = text.split('\n')
    for line in lines:
        line = line.rstrip('\r')
        stripped = line.strip()
        if not stripped:
            continue

        # Check for book-level header line like "Matthew 1:5"
        hm = header_re.match(stripped)
        if hm:
            current_chapter = int(hm.group(1))
            current_verse = int(hm.group(2))
            continue

        # Strip bullet prefix
        is_bullet = stripped.startswith('•')
        if is_bullet:
            stripped = stripped.lstrip('•').strip()

        # Check for inline chapter:verse reference like "1:5 text..."
        cv_m = re.match(r'^(\d+):(\d+)\s+', stripped)
        if cv_m:
            current_chapter = int(cv_m.group(1))
            current_verse = int(cv_m.group(2))
            stripped = stripped[cv_m.end():]
        elif not is_bullet:
            # Maybe just a verse number: "5 text..." or "5–8 text..."
            vm = inline_ref_re.match(stripped)
            if vm:
                current_verse = int(vm.group(1))
                stripped = stripped[vm.end():]

        if current_chapter == 0 or current_verse == 0:
            continue

        # Now parse the variant line: "SBLGNT_text editions ] variant_text edition(s)"
        if ']' not in stripped:
            continue

        bracket_pos = stripped.index(']')
        before_bracket = stripped[:bracket_pos].strip()
        after_bracket = stripped[bracket_pos + 1:].strip()

        if not after_bracket:
            continue

        # Extract which editions agree with SBLGNT (appear before ])
        sbl_editions = [e for e in ALL_EDITIONS if re.search(rf'\b{e}\b', before_bracket)]

        # The SBLGNT reading is the text before the edition names
        sbl_reading = before_bracket
        for ed in ALL_EDITIONS:
            sbl_reading = re.sub(rf'\b{ed}\b', '', sbl_reading)
        sbl_reading = sbl_reading.strip()

        # Parse variants after ] — may have multiple separated by ;
        # Each variant group: "text Edition; text2 Edition2"
        variant_groups = re.split(r';\s*(?=[^\s])', after_bracket)

        for group in variant_groups:
            group = group.strip()
            if not group:
                continue

            # Find which editions are named in this group
            differ_editions = [e for e in ALL_EDITIONS if re.search(rf'\b{e}\b', group)]
            if not differ_editions:
                continue

            # The variant reading is the text without edition names
            variant_text = group
            for ed in ALL_EDITIONS:
                variant_text = re.sub(rf'\b{ed}\b', '', variant_text)
            variant_text = re.sub(r'\s+', ' ', variant_text).strip().rstrip(';, ')

            # Build human-readable description
            differ_labels = [EDITION_LABELS.get(e, e) for e in differ_editions]
            agree_labels = [e for e in sbl_editions] or ['SBLGNT']

            if variant_text == '–' or variant_text == '-':
                description = f"{', '.join(differ_editions)} omits this word"
                variant_text = '(omitted)'
            elif variant_text.startswith('+'):
                added = variant_text[1:].strip()
                description = f"{', '.join(differ_editions)} adds: {added}"
                variant_text = f"+ {added}"
            else:
                agree_str = ', '.join(agree_labels) if agree_labels else 'SBLGNT'
                description = f"SBLGNT/{agree_str} vs. {', '.join(differ_editions)}"

            source_key = '+'.join(differ_editions)
            source_label = '; '.join(differ_labels)

            results.append({
                "book": book_name,
                "chapter": current_chapter,
                "verse": current_verse,
                "testament": "nt",
                "word_ref": f"{book_name} {current_chapter}:{current_verse}",
                "main_type": "SBLGNT",
                "main_english": sbl_reading,
                "main_hebrew": "",
                "variant_source": source_key,
                "variant_source_label": source_label,
                "variant_english": variant_text,
                "variant_hebrew": "",
                "description": description,
            })

    return results


# Fetch list of files
print("Fetching book file list from GitHub...")
try:
    book_files = get_book_files()
    print(f"  Found {len(book_files)} book files")
except Exception as e:
    print(f"ERROR fetching file list: {e}", file=sys.stderr)
    sys.exit(1)

all_results: list[dict] = []
for filename in sorted(book_files):
    stem = filename.replace('.txt', '')
    book_name = FILENAME_TO_BOOK.get(stem)
    if not book_name:
        print(f"  Unknown book: {filename} — skipping")
        continue

    text = fetch_book(filename)
    if not text:
        continue

    entries = parse_apparatus_text(text, book_name)
    all_results.extend(entries)
    print(f"  {book_name}: {len(entries)} variants")

print(f"\nTotal: {len(all_results)} NT variant entries")

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_results, f, ensure_ascii=False, indent=None)

print(f"Written to {out_path}")

from collections import Counter
sources = Counter(r['variant_source'] for r in all_results)
print("\nTop variant sources (differ editions):")
for src, n in sources.most_common(8):
    print(f"  {src}: {n}")
