"""
Downloads WEB and ASV from seven1m/open-bibles and seeds them into App/data/bible.db.

Usage (run from the BibleApp root):
    python scripts/generate_translations.py

Adds a `bible_translations` table to the seed DB.  Re-running is safe — existing
WEB/ASV rows are deleted before re-inserting so duplicates never accumulate.
"""

import re
import sqlite3
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# ── OSIS / USFX book-code → canonical name ───────────────────────────────────
OSIS_MAP: dict[str, str] = {
    "GEN": "Genesis",       "EXO": "Exodus",        "LEV": "Leviticus",
    "NUM": "Numbers",       "DEU": "Deuteronomy",   "JOS": "Joshua",
    "JDG": "Judges",        "RUT": "Ruth",
    "1SA": "1 Samuel",      "2SA": "2 Samuel",
    "1KI": "1 Kings",       "2KI": "2 Kings",
    "1CH": "1 Chronicles",  "2CH": "2 Chronicles",
    "EZR": "Ezra",          "NEH": "Nehemiah",      "EST": "Esther",
    "JOB": "Job",           "PSA": "Psalms",         "PRO": "Proverbs",
    "ECC": "Ecclesiastes",  "SNG": "Song of Solomon",
    "ISA": "Isaiah",        "JER": "Jeremiah",      "LAM": "Lamentations",
    "EZK": "Ezekiel",       "EZE": "Ezekiel",       "DAN": "Daniel",
    "HOS": "Hosea",         "JOL": "Joel",          "AMO": "Amos",
    "OBA": "Obadiah",       "JON": "Jonah",         "MIC": "Micah",
    "NAM": "Nahum",         "HAB": "Habakkuk",      "ZEP": "Zephaniah",
    "HAG": "Haggai",        "ZEC": "Zechariah",     "MAL": "Malachi",
    "MAT": "Matthew",       "MRK": "Mark",          "LUK": "Luke",
    "JHN": "John",          "ACT": "Acts",          "ROM": "Romans",
    "1CO": "1 Corinthians", "2CO": "2 Corinthians", "GAL": "Galatians",
    "EPH": "Ephesians",     "PHP": "Philippians",   "COL": "Colossians",
    "1TH": "1 Thessalonians", "2TH": "2 Thessalonians",
    "1TI": "1 Timothy",    "2TI": "2 Timothy",     "TIT": "Titus",
    "PHM": "Philemon",      "HEB": "Hebrews",       "JAS": "James",
    "1PE": "1 Peter",       "2PE": "2 Peter",
    "1JN": "1 John",        "2JN": "2 John",        "3JN": "3 John",
    "JUD": "Jude",          "REV": "Revelation",
}

# Normalize Zefania bname values that differ from our canonical
BNAME_NORM: dict[str, str] = {
    "Song of Songs":          "Song of Solomon",
    "Canticles":              "Song of Solomon",
    "Revelation of John":     "Revelation",
    "Apocalypse":             "Revelation",
    "Psalm":                  "Psalms",
}

BASE_URL = "https://raw.githubusercontent.com/seven1m/open-bibles/master/"

TRANSLATIONS: list[tuple[str, str, str]] = [
    ("WEB", "eng-web.usfx.xml",     "usfx"),
    ("ASV", "eng-asv.zefania.xml",  "zefania"),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "BibleApp/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _elem_text(elem: ET.Element, skip_tags: set[str]) -> str:
    """Get all text inside elem, skipping content of certain child tags."""
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)
    for child in elem:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag not in skip_tags:
            parts.append(_elem_text(child, skip_tags))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


_FOOTNOTE_TAGS = {"f", "x", "note", "fe"}
_WS = re.compile(r"\s+")


def clean(text: str) -> str:
    return _WS.sub(" ", text).strip()


# ── USFX parser ───────────────────────────────────────────────────────────────
# In eBible USFX format <v> is a self-closing marker; verse text lives in
# elem.tail and the tails of subsequent inline sibling elements until the
# next <v>/<c>/<book> boundary.  Footnotes (<f>, <x>) are skipped.

_FN_TAGS = {"f", "x", "fe", "note"}
_SKIP_TAGS = {"id", "h", "toc"}

def parse_usfx(data: bytes) -> list[tuple[str, int, int, str]]:
    """Parse eBible/seven1m USFX XML → list of (book, chapter, verse, text)."""
    root = ET.fromstring(data.decode("utf-8"))
    rows: list[tuple[str, int, int, str]] = []

    cur_book: list[str] = [""]
    cur_chapter: list[int] = [0]
    cur_verse: list[int] = [0]
    parts: list[list[str]] = [[]]
    fn_depth: list[int] = [0]

    def flush() -> None:
        if cur_verse[0] and cur_book[0] and cur_chapter[0] and parts[0]:
            text = clean("".join(parts[0]))
            if text:
                rows.append((cur_book[0], cur_chapter[0], cur_verse[0], text))

    def visit(elem: ET.Element) -> None:
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

        if tag in _SKIP_TAGS:
            return

        if tag == "book":
            flush()
            cur_book[0] = OSIS_MAP.get((elem.get("id") or "").upper(), "")
            cur_chapter[0] = cur_verse[0] = 0
            parts[0] = []
            for child in elem:
                visit(child)
            return

        if tag == "c":
            flush()
            try:
                cur_chapter[0] = int(elem.get("id", "0"))
            except ValueError:
                pass
            cur_verse[0] = 0
            parts[0] = []
            # tail of <c> is irrelevant; process children (footnotes etc.)
            for child in elem:
                visit(child)
            return

        if tag == "v":
            if fn_depth[0] > 0:
                return  # skip verse markers inside footnotes
            flush()
            try:
                cur_verse[0] = int(elem.get("id", "0"))
            except ValueError:
                cur_verse[0] = 0
            parts[0] = []
            # <v> self-closes; its tail IS the start of verse text
            if elem.tail and cur_verse[0]:
                parts[0].append(elem.tail)
            return

        if tag in _FN_TAGS:
            fn_depth[0] += 1
            for child in elem:
                visit(child)
            fn_depth[0] -= 1
            # tail of footnote element continues the verse
            if elem.tail and fn_depth[0] == 0 and cur_verse[0]:
                parts[0].append(elem.tail)
            return

        # Generic inline/block element: collect text content if in a verse
        if elem.text and fn_depth[0] == 0 and cur_verse[0]:
            parts[0].append(elem.text)
        for child in elem:
            visit(child)
        if elem.tail and fn_depth[0] == 0 and cur_verse[0]:
            parts[0].append(elem.tail)

    visit(root)
    flush()
    return rows


# ── Zefania parser ────────────────────────────────────────────────────────────

def parse_zefania(data: bytes) -> list[tuple[str, int, int, str]]:
    """Parse Zefania XML → list of (book, chapter, verse, text)."""
    root = ET.fromstring(data.decode("utf-8"))
    rows: list[tuple[str, int, int, str]] = []

    for book_el in root.iter("BIBLEBOOK"):
        raw_name = book_el.get("bname") or book_el.get("bsname") or ""
        book = BNAME_NORM.get(raw_name, raw_name)
        if not book:
            continue
        for chap_el in book_el.iter("CHAPTER"):
            try:
                ch = int(chap_el.get("cnumber", "0"))
            except ValueError:
                continue
            for vers_el in chap_el.iter("VERS"):
                try:
                    v = int(vers_el.get("vnumber", "0"))
                except ValueError:
                    continue
                text = clean("".join(vers_el.itertext()))
                if text:
                    rows.append((book, ch, v, text))

    return rows


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    db_path = Path(__file__).parent.parent / "App" / "data" / "bible.db"
    if not db_path.exists():
        print(f"ERROR: seed DB not found at {db_path}")
        sys.exit(1)

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS bible_translations (
            translation TEXT NOT NULL,
            book        TEXT NOT NULL,
            chapter     INTEGER NOT NULL,
            verse       INTEGER NOT NULL,
            text        TEXT NOT NULL,
            PRIMARY KEY (translation, book, chapter, verse)
        );
        CREATE INDEX IF NOT EXISTS idx_btrans_bcv
            ON bible_translations(translation, book, chapter, verse);
    """)
    con.commit()

    for name, filename, fmt in TRANSLATIONS:
        url = BASE_URL + filename
        print(f"\n[{name}] Downloading {url} …")
        try:
            data = fetch(url)
        except Exception as e:
            print(f"  FAILED: {e}")
            continue

        print(f"  Parsing ({fmt}) …")
        if fmt == "usfx":
            rows = parse_usfx(data)
        else:
            rows = parse_zefania(data)

        print(f"  {len(rows):,} verses parsed.")
        if not rows:
            print("  Skipping — no verses extracted.")
            continue

        cur.execute("DELETE FROM bible_translations WHERE translation = ?", (name,))
        cur.executemany(
            "INSERT INTO bible_translations (translation, book, chapter, verse, text) VALUES (?,?,?,?,?)",
            [(name, b, c, v, t) for b, c, v, t in rows],
        )
        con.commit()
        print(f"  {cur.rowcount:,} rows inserted for {name}.")

    con.execute("VACUUM")
    con.close()
    print("\nDone. Rebuild the app (npm run build or restart dev) to bundle the updated DB.")
    print("Bump the version in App/package.json first so existing installs re-copy the seed DB.")


if __name__ == "__main__":
    main()
