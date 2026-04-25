"""
Generates electron/navesData.ts from Nave's Topical Bible (public domain).

Downloads the structured JSON from scrollmapper/bible_databases on GitHub,
parses every topic and verse reference, expands verse ranges, maps book
abbreviations to the canonical names used in bible.db, and writes a
TypeScript module that main.ts imports for one-time DB seeding.

Usage (run from the BibleApp root):
    python scripts/generate_naves_data.py

Output:
    App/electron/navesData.ts
"""

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# ── Nave's book abbreviation → canonical bible.db name ──────────────────────
BOOK_MAP: dict[str, str] = {
    "Ge": "Genesis",    "Ex": "Exodus",       "Le": "Leviticus",
    "Nu": "Numbers",    "De": "Deuteronomy",  "Jos": "Joshua",
    "Jud": "Judges",    "Ru": "Ruth",
    "1Sa": "1 Samuel",  "2Sa": "2 Samuel",
    "1Ki": "1 Kings",   "2Ki": "2 Kings",
    "1Ch": "1 Chronicles", "2Ch": "2 Chronicles",
    "Ezr": "Ezra",      "Ne": "Nehemiah",     "Es": "Esther",
    "Job": "Job",       "Ps": "Psalms",       "Pr": "Proverbs",
    "Ec": "Ecclesiastes", "So": "Song of Solomon",
    "Is": "Isaiah",     "Jer": "Jeremiah",    "La": "Lamentations",
    "Eze": "Ezekiel",   "Da": "Daniel",       "Ho": "Hosea",
    "Joe": "Joel",      "Am": "Amos",         "Ob": "Obadiah",
    "Jon": "Jonah",     "Mic": "Micah",       "Na": "Nahum",
    "Hab": "Habakkuk",  "Zep": "Zephaniah",   "Hag": "Haggai",
    "Zec": "Zechariah", "Mal": "Malachi",
    "Mt": "Matthew",    "Mr": "Mark",         "Lu": "Luke",
    "Joh": "John",      "Ac": "Acts",         "Ro": "Romans",
    "1Co": "1 Corinthians", "2Co": "2 Corinthians",
    "Ga": "Galatians",  "Eph": "Ephesians",   "Php": "Philippians",
    "Col": "Colossians",
    "1Th": "1 Thessalonians", "2Th": "2 Thessalonians",
    "1Ti": "1 Timothy", "2Ti": "2 Timothy",
    "Tit": "Titus",     "Phm": "Philemon",    "Heb": "Hebrews",
    "Jas": "James",
    "1Pe": "1 Peter",   "2Pe": "2 Peter",
    "1Jo": "1 John",    "2Jo": "2 John",      "3Jo": "3 John",
    "Jude": "Jude",     "Re": "Revelation",
}

# ── Reference parsing ────────────────────────────────────────────────────────

def parse_refs(raw: str) -> list[tuple[str, int, int]]:
    """
    Parse a Nave's reference string into a flat list of (book, chapter, verse).

    Reference strings look like:
        "Ge 1:1,3-5; Ex 4:14; 4:27-31; 1Co 13:1-3"

    Rules:
    - Semicolons separate independent references (possibly new book).
    - A segment without a book name inherits the last seen book.
    - "chapter:verse" or "chapter:verse-verse" or "chapter:verse,verse,...".
    - Cross-chapter refs like "1:1-2:3" are expanded verse-by-verse using
      hardcoded max-verse fallback of 50 (overestimates are harmless; the DB
      query only matches exact verses that exist in bible_verses).
    """
    results: list[tuple[str, int, int]] = []
    current_book = ""
    segments = [s.strip() for s in raw.split(";") if s.strip()]

    for seg in segments:
        # Try to peel off a leading book abbreviation
        book_match = re.match(r"^([1-3]?[A-Z][a-z]{0,3})\s+(.+)$", seg)
        if book_match:
            abbr = book_match.group(1)
            if abbr in BOOK_MAP:
                current_book = BOOK_MAP[abbr]
                seg = book_match.group(2)
            # else: unrecognised prefix — treat whole string as ref with current book

        if not current_book:
            continue

        # Now parse "chapter:verse_spec[,verse_spec]..." parts separated by commas
        # First split on commas that are NOT inside a cross-chapter range
        parts = [p.strip() for p in seg.split(",") if p.strip()]
        current_chapter = None

        for part in parts:
            # Cross-chapter range: "ch1:v1-ch2:v2"
            xchap = re.match(r"^(\d+):(\d+)-(\d+):(\d+)$", part)
            if xchap:
                c1, v1, c2, v2 = int(xchap.group(1)), int(xchap.group(2)), \
                                  int(xchap.group(3)), int(xchap.group(4))
                for c in range(c1, c2 + 1):
                    vs = v1 if c == c1 else 1
                    ve = v2 if c == c2 else 50
                    for v in range(vs, ve + 1):
                        results.append((current_book, c, v))
                current_chapter = c2
                continue

            # Standard "chapter:verse" or "chapter:verse-verse"
            cv = re.match(r"^(\d+):(\d+)(?:-(\d+))?$", part)
            if cv:
                ch = int(cv.group(1))
                v1 = int(cv.group(2))
                v2 = int(cv.group(3)) if cv.group(3) else v1
                current_chapter = ch
                for v in range(v1, v2 + 1):
                    results.append((current_book, ch, v))
                continue

            # Bare verse number (continues from current chapter)
            bare = re.match(r"^(\d+)(?:-(\d+))?$", part)
            if bare and current_chapter is not None:
                v1 = int(bare.group(1))
                v2 = int(bare.group(2)) if bare.group(2) else v1
                for v in range(v1, v2 + 1):
                    results.append((current_book, current_chapter, v))
                continue

    return results


# ── Download ─────────────────────────────────────────────────────────────────

def _fetch(url: str, headers: dict | None = None) -> bytes:
    h = {"User-Agent": "BibleApp/1.0", "Accept": "application/vnd.github+json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

# Known repos to probe for Nave's data (in priority order)
PROBE_REPOS = [
    ("scrollmapper", "bible_databases"),
    ("scrollmapper", "Nave"),
    ("scrollmapper", "naves-topical-bible"),
    ("openbibleinfo", "Nave-Topical-Bible"),
    ("openbibleinfo", "nave"),
    ("seven1m", "open-bibles"),
]

FILENAME_KEYWORDS = ("nave", "topical", "topic")
ALLOWED_EXTS = (".json", ".xml", ".csv", ".tsv", ".txt")

def _github_tree(owner: str, repo: str) -> list[str]:
    """Return list of file paths in the repo (handles truncation via branches API)."""
    for branch in ("master", "main"):
        url = (f"https://api.github.com/repos/{owner}/{repo}"
               f"/git/trees/{branch}?recursive=1")
        try:
            data = json.loads(_fetch(url).decode("utf-8"))
            paths = [item["path"] for item in data.get("tree", [])
                     if item.get("type") == "blob"]
            if paths:
                return paths
        except Exception:
            pass
    return []

GUTENBERG_URL = "https://www.gutenberg.org/files/47701/47701-0.txt"

# Nave's Topical Bible book abbreviations (Gutenberg edition)
GUTENBERG_BOOK_MAP: dict[str, str] = {
    "Gen": "Genesis", "Ex": "Exodus", "Lev": "Leviticus", "Num": "Numbers",
    "Deut": "Deuteronomy", "Josh": "Joshua", "Judg": "Judges", "Ruth": "Ruth",
    "1 Sam": "1 Samuel", "2 Sam": "2 Samuel", "1 Kin": "1 Kings", "2 Kin": "2 Kings",
    "1 Chr": "1 Chronicles", "2 Chr": "2 Chronicles", "Ezra": "Ezra",
    "Neh": "Nehemiah", "Est": "Esther", "Job": "Job", "Ps": "Psalms",
    "Prov": "Proverbs", "Eccl": "Ecclesiastes", "Song": "Song of Solomon",
    "Is": "Isaiah", "Jer": "Jeremiah", "Lam": "Lamentations", "Ezek": "Ezekiel",
    "Dan": "Daniel", "Hos": "Hosea", "Joel": "Joel", "Amos": "Amos",
    "Obad": "Obadiah", "Jonah": "Jonah", "Mic": "Micah", "Nah": "Nahum",
    "Hab": "Habakkuk", "Zeph": "Zephaniah", "Hag": "Haggai",
    "Zech": "Zechariah", "Mal": "Malachi",
    "Matt": "Matthew", "Mark": "Mark", "Luke": "Luke", "John": "John",
    "Acts": "Acts", "Rom": "Romans", "1 Cor": "1 Corinthians",
    "2 Cor": "2 Corinthians", "Gal": "Galatians", "Eph": "Ephesians",
    "Phil": "Philippians", "Col": "Colossians", "1 Thess": "1 Thessalonians",
    "2 Thess": "2 Thessalonians", "1 Tim": "1 Timothy", "2 Tim": "2 Timothy",
    "Tit": "Titus", "Philemon": "Philemon", "Heb": "Hebrews", "James": "James",
    "1 Pet": "1 Peter", "2 Pet": "2 Peter", "1 John": "1 John",
    "2 John": "2 John", "3 John": "3 John", "Jude": "Jude", "Rev": "Revelation",
}

# Pattern matching numbered-book abbreviations first, then named
_BOOK_PATTERN = "|".join(
    re.escape(k)
    for k in sorted(GUTENBERG_BOOK_MAP, key=len, reverse=True)
)
_REF_RE = re.compile(
    rf"(?<!\w)({_BOOK_PATTERN})\.?\s+(\d+):(\d+)(?:-(\d+))?",
    re.IGNORECASE,
)

def parse_gutenberg_naves(data: bytes) -> list:
    """
    Parse Project Gutenberg edition of Nave's Topical Bible (file #47701).
    Topics are ALL-CAPS lines; scripture refs are extracted by regex from
    the following paragraph block.
    """
    text = data.decode("utf-8", errors="replace")

    # Strip the Gutenberg header/footer
    start = text.find("ABASE") if "ABASE" in text else 0
    end_marker = "*** END OF THE PROJECT GUTENBERG"
    end = text.find(end_marker)
    if end > 0:
        text = text[start:end]

    records: list[dict] = []
    # Split into blocks on lines that look like topic headings:
    # all-caps, possibly with spaces/hyphens, 2–60 chars, alone on the line
    heading_re = re.compile(r"^([A-Z][A-Z\s,\-'']{1,58}[A-Z])$", re.MULTILINE)
    positions = [(m.start(), m.group(1).strip()) for m in heading_re.finditer(text)]

    for i, (pos, heading) in enumerate(positions):
        end_pos = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        block = text[pos:end_pos]
        # Collect all scripture references in the block
        refs_found = []
        for m in _REF_RE.finditer(block):
            abbr = m.group(1)
            # Case-insensitive lookup
            book = None
            for k, v in GUTENBERG_BOOK_MAP.items():
                if k.lower() == abbr.lower():
                    book = v
                    break
            if not book:
                continue
            ch = int(m.group(2))
            v1 = int(m.group(3))
            v2 = int(m.group(4)) if m.group(4) else v1
            for v in range(v1, v2 + 1):
                refs_found.append(f"{abbr} {ch}:{v}")
        if refs_found:
            records.append({
                "topic": heading.title(),
                "references": "; ".join(refs_found),
            })
    return records

def _github_code_search(query: str) -> list[tuple[str, str, str]]:
    """Return list of (owner, repo, path) from GitHub code search."""
    url = (f"https://api.github.com/search/code"
           f"?q={urllib.request.quote(query)}&per_page=10")
    try:
        data = json.loads(_fetch(url).decode("utf-8"))
        return [
            (item["repository"]["owner"]["login"],
             item["repository"]["name"],
             item["path"])
            for item in data.get("items", [])
        ]
    except Exception as e:
        print(f"    code search failed: {e}")
        return []

def find_naves_url() -> tuple[str, str]:
    """
    Try GitHub code search then Project Gutenberg.
    Returns (raw_url, fmt) or ("", "").
    """
    print("  Searching GitHub code for Nave's data files …")
    for query in (
        "filename:naves_topics extension:json",
        "filename:naves extension:json",
        "nave topical bible extension:json",
    ):
        results = _github_code_search(query)
        for owner, repo, path in results:
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
            if ext not in ALLOWED_EXTS:
                continue
            for branch in ("master", "main"):
                raw_url = (f"https://raw.githubusercontent.com"
                           f"/{owner}/{repo}/{branch}/{path}")
                print(f"  Found via code search: {raw_url}")
                return raw_url, ext.lstrip(".")

    # Fall back to Project Gutenberg plain text
    print(f"  Falling back to Project Gutenberg ({GUTENBERG_URL}) …")
    return GUTENBERG_URL, "gutenberg"

def parse_xml_naves(data: bytes) -> list:
    """Parse scrollmapper XML: <item name="TOPIC"><references>...</references></item>"""
    root = ET.fromstring(data.decode("utf-8"))
    records = []
    for item in root.iter("item"):
        name = item.get("name", "").strip()
        refs_el = item.find("references")
        refs = refs_el.text.strip() if refs_el is not None and refs_el.text else ""
        if name and refs:
            records.append({"topic": name, "references": refs})
    return records

def parse_csv_naves(data: bytes) -> list:
    """
    Try common CSV/TSV layouts:
      - topic, references
      - id, topic, references
    """
    import csv, io
    text = data.decode("utf-8")
    dialect = "excel-tab" if "\t" in text[:500] else "excel"
    reader = csv.reader(io.StringIO(text), dialect=dialect)
    rows_list = list(reader)
    if not rows_list:
        return []
    header = [h.lower().strip() for h in rows_list[0]]
    records = []
    for row in rows_list[1:]:
        if len(row) < 2:
            continue
        try:
            if "topic" in header and "references" in header:
                t_idx = header.index("topic")
                r_idx = header.index("references")
            else:
                t_idx, r_idx = (1, 2) if len(row) >= 3 else (0, 1)
            records.append({"topic": row[t_idx].strip(), "references": row[r_idx].strip()})
        except IndexError:
            continue
    return records

def parse_txt_naves(data: bytes) -> list:
    """
    Parse a plain-text Nave's format where each topic block looks like:
        TOPIC NAME
        References: Ge 1:1; Ex 4:14
    or tab-separated: topic\treferences
    """
    text = data.decode("utf-8", errors="replace")
    # Try tab-separated first
    if "\t" in text[:500]:
        return parse_csv_naves(data)
    records = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if re.match(r"^[A-Z][A-Z, ]{2,}$", line):
            name = line.title()
            refs = ""
            i += 1
            while i < len(lines) and not re.match(r"^[A-Z][A-Z, ]{2,}$", lines[i].strip()):
                refs += " " + lines[i].strip()
                i += 1
            refs = refs.strip()
            if refs:
                records.append({"topic": name, "references": refs})
        else:
            i += 1
    return records

def download_naves() -> list:
    url, fmt = find_naves_url()
    if not url:
        print("  Could not locate Nave's data from any source.")
        return []
    print(f"  Downloading {url} …")
    try:
        raw = _fetch(url)
        if fmt == "json":
            data = json.loads(raw.decode("utf-8"))
            print(f"  Downloaded {len(data):,} records (JSON).")
            return data
        if fmt == "xml":
            data = parse_xml_naves(raw)
            print(f"  Parsed {len(data):,} records (XML).")
            return data
        if fmt in ("csv", "tsv"):
            data = parse_csv_naves(raw)
            print(f"  Parsed {len(data):,} records (CSV/TSV).")
            return data
        if fmt == "txt":
            data = parse_txt_naves(raw)
            print(f"  Parsed {len(data):,} records (TXT).")
            return data
        if fmt == "gutenberg":
            data = parse_gutenberg_naves(raw)
            print(f"  Parsed {len(data):,} records (Gutenberg plain text).")
            return data
    except Exception as e:
        print(f"  Failed: {e}")
    return []


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Downloading Nave's Topical Bible …")
    raw = download_naves()

    if not raw:
        print("\nERROR: Could not download Nave's data.")
        print("Please check your internet connection and try again.")
        sys.exit(1)

    print("Parsing topics and references …")

    topics: list[tuple[int, str]] = []      # (id, name)
    refs:   list[tuple[int, str, int, int]] = []  # (topic_id, book, ch, v)

    # Deduplicate topics by name so sub-topics merge under the parent
    seen_topic: dict[str, int] = {}

    for record in raw:
        # Support both {topic, references} and {topic, subtopic, references}
        name: str = record.get("topic", "").strip().title()
        ref_str: str = record.get("references", "") or ""

        if not name or not ref_str.strip():
            continue

        if name not in seen_topic:
            tid = len(topics) + 1
            seen_topic[name] = tid
            topics.append((tid, name))
        else:
            tid = seen_topic[name]

        for book, ch, v in parse_refs(ref_str):
            refs.append((tid, book, ch, v))

    print(f"  {len(topics):,} topics, {len(refs):,} verse references.")

    # ── Write TypeScript ────────────────────────────────────────────────────
    out_path = Path(__file__).parent.parent / "App" / "electron" / "navesData.ts"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing {out_path} …")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/generate_naves_data.py — do not edit.\n")
        f.write("// Nave's Topical Bible (public domain).\n\n")

        f.write("export const NAVES_CREATE_SQL = `\n")
        f.write("  CREATE TABLE IF NOT EXISTS naves_topics (\n")
        f.write("    id   INTEGER PRIMARY KEY,\n")
        f.write("    name TEXT NOT NULL\n")
        f.write("  );\n")
        f.write("  CREATE TABLE IF NOT EXISTS naves_refs (\n")
        f.write("    id       INTEGER PRIMARY KEY,\n")
        f.write("    topic_id INTEGER NOT NULL,\n")
        f.write("    book     TEXT NOT NULL,\n")
        f.write("    chapter  INTEGER NOT NULL,\n")
        f.write("    verse    INTEGER NOT NULL\n")
        f.write("  );\n")
        f.write("  CREATE INDEX IF NOT EXISTS idx_naves_refs_bv\n")
        f.write("    ON naves_refs(book, chapter, verse);\n")
        f.write("`\n\n")

        # Topics array
        f.write("export const NAVES_TOPICS: Array<[number, string]> = [\n")
        for tid, name in topics:
            escaped = name.replace("\\", "\\\\").replace("`", "\\`").replace("'", "\\'")
            f.write(f"  [{tid}, '{escaped}'],\n")
        f.write("]\n\n")

        # Refs array — written in chunks to avoid very long lines
        f.write("export const NAVES_REFS: Array<[number, string, number, number]> = [\n")
        for topic_id, book, ch, v in refs:
            f.write(f"  [{topic_id}, '{book}', {ch}, {v}],\n")
        f.write("]\n")

    print(f"Done. {out_path}")
    print()
    print("Next step: rebuild the app so the new data seeds into bible.db on first launch.")
    print("  cd App && npm run build   (or restart the dev server)")


if __name__ == "__main__":
    main()
