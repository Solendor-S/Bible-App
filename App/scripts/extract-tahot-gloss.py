"""
Extract per-word context-sensitive English glosses from STEP Bible TAHOT data.
Outputs ot-glosses.json: [{book, chapter, verse, position, gloss}, ...]
where position is 1-based word index within the verse (matching hebrew_words.position).

Source: STEP Bible TAHOT (Translators Amalgamated Hebrew OT)
  https://github.com/STEPBible/STEPBible-Data
  License: CC BY 4.0

Column format (TSV):
  0: Ref  e.g. Gen.1.1#01=L  (book.chapter.verse#wordnum=texttype)
  1: Hebrew text
  2: Transliteration
  3: English gloss  e.g. "in/ beginning", "he created", "God"
  4+: Strong's, grammar, etc.

Gloss notes:
  - "/" separates prefix/root/suffix glosses → take the LAST non-trivial part (root)
  - "<...>" marks grammatical/implicit words → skip
  - "[...]" marks implied additions → skip for highlighting
"""
import json
import os
import re
import sys
import urllib.request

TAHOT_FILES = [
    "TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
    "TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
]
BASE_URL = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/"

BOOK_MAP = {
    # TAHOT exact abbreviations (from file inspection)
    "Gen": "Genesis", "Exo": "Exodus", "Lev": "Leviticus",
    "Num": "Numbers", "Deu": "Deuteronomy", "Jos": "Joshua",
    "Jdg": "Judges", "Rut": "Ruth", "1Sa": "1 Samuel",
    "2Sa": "2 Samuel", "1Ki": "1 Kings", "2Ki": "2 Kings",
    "1Ch": "1 Chronicles", "2Ch": "2 Chronicles", "Ezr": "Ezra",
    "Neh": "Nehemiah", "Est": "Esther", "Job": "Job",
    "Psa": "Psalms", "Pro": "Proverbs", "Ecc": "Ecclesiastes",
    "Sng": "Song of Solomon", "Isa": "Isaiah", "Jer": "Jeremiah",
    "Lam": "Lamentations", "Ezk": "Ezekiel", "Dan": "Daniel",
    "Hos": "Hosea", "Jol": "Joel", "Amo": "Amos",
    "Oba": "Obadiah", "Jon": "Jonah", "Mic": "Micah",
    "Nam": "Nahum", "Hab": "Habakkuk", "Zep": "Zephaniah",
    "Hag": "Haggai", "Zec": "Zechariah", "Mal": "Malachi",
}

# Ref pattern: Gen.1.1#01=L  or  Gen.1.1#01
REF_RE = re.compile(r'^([A-Za-z0-9]+)\.(\d+)\.(\d+)#(\d+)')

script_dir = os.path.dirname(os.path.abspath(__file__))
raw_dir = os.path.join(script_dir, "..", "data", "raw")
out_path = os.path.join(raw_dir, "ot-glosses.json")


def fetch_file(filename: str) -> bytes:
    encoded = urllib.parse.quote(filename, safe='')
    url = BASE_URL + encoded
    cache_path = os.path.join(raw_dir, "tahot_cache_" + filename[:12].replace(' ', '_') + ".txt")
    if os.path.exists(cache_path):
        print(f"  Using cache: {os.path.basename(cache_path)}")
        with open(cache_path, 'rb') as f:
            return f.read()
    print(f"  Downloading: {filename}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as r:
        data = r.read()
    with open(cache_path, 'wb') as f:
        f.write(data)
    return data


def clean_gloss(raw: str) -> str:
    """
    Extract the meaningful English root from a TAHOT gloss.
    "in/ beginning"  → "beginning"
    "the/ heavens"   → "heavens"
    "he created"     → "he created"
    "<obj.>"         → ""   (skip grammatical markers)
    "[and]"          → ""   (skip implied additions)
    """
    s = raw.strip()
    if not s:
        return ""
    # Skip purely grammatical markers
    if s.startswith('<') and s.endswith('>'):
        return ""
    # Strip implied-word brackets
    s = re.sub(r'\[.*?\]', '', s).strip()
    # Strip angle-bracket sections
    s = re.sub(r'<.*?>', '', s).strip()
    # If slash-delimited (prefix/root/suffix), take the last non-trivial part
    if '/' in s:
        parts = [p.strip() for p in s.split('/') if p.strip()]
        # Find longest meaningful part (likely the root)
        parts = [p for p in parts if len(p) >= 2 and not re.match(r'^[a-z]{1,2}$', p)]
        s = parts[-1] if parts else s.split('/')[-1].strip()
    # Lowercase, strip punctuation
    s = s.lower().strip('.,;:!?"\' ')
    return s


import urllib.parse

all_results: list[dict] = []
total_errors = 0

for filename in TAHOT_FILES:
    print(f"\nProcessing {filename[:30]}...")
    try:
        raw = fetch_file(filename)
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        continue

    lines = raw.decode('utf-8', errors='replace').split('\n')
    file_count = 0
    file_errors = 0

    # Track last seen (book, chapter, verse) and its word count to assign positions
    # TAHOT word numbers (#01, #02...) are Ketiv-based; we want sequential position
    # matching hebrew_words.position (which counts all words in verse order)
    prev_bcv = None
    pos = 0

    for line in lines:
        line = line.rstrip('\r')
        if not line or line.startswith('\t') or line[0] == ' ':
            continue

        parts = line.split('\t')
        if len(parts) < 4:
            continue

        m = REF_RE.match(parts[0])
        if not m:
            continue

        abbr = m.group(1)
        chapter = int(m.group(2))
        verse = int(m.group(3))
        # word_num = int(m.group(4))  # not used directly

        # Skip Ketiv variants (text type = K) — these are replaced by the Qere
        text_type = parts[0][m.end():].lstrip('=')
        if text_type.startswith('K'):
            continue

        book = BOOK_MAP.get(abbr)
        if book is None:
            file_errors += 1
            continue

        raw_gloss = parts[3].strip() if len(parts) > 3 else ''
        gloss = clean_gloss(raw_gloss)

        bcv = (book, chapter, verse)
        if bcv != prev_bcv:
            prev_bcv = bcv
            pos = 0
        pos += 1

        if not gloss:
            # Use a placeholder so position count stays correct;
            # we won't emit an entry, position slot is consumed
            file_errors += 1
            continue

        all_results.append({
            "book": book,
            "chapter": chapter,
            "verse": verse,
            "position": pos,
            "gloss": gloss,
        })
        file_count += 1

    print(f"  {file_count} glosses extracted ({file_errors} skipped)")
    total_errors += file_errors

print(f"\nTotal: {len(all_results)} glosses ({total_errors} skipped/empty)")

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_results, f, ensure_ascii=False)

print(f"Written to {out_path}")

# Sanity check
print("\nFirst 8 entries (Genesis 1:1):")
for e in all_results[:8]:
    print(f"  {e}")
