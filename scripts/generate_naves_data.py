"""
Generates electron/navesData.ts from Nave's Topical Bible (public domain).

Primary source: CCEL ThML XML (https://ccel.org/ccel/n/nave/bible.xml).
Fallback: Project Gutenberg plain text + legacy GitHub search.

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

# ── OSIS book abbreviations (from CCEL ThML parsed= attribute) ───────────────
PARSED_BOOK_MAP: dict[str, str] = {
    "Gen": "Genesis",       "Exod": "Exodus",         "Lev": "Leviticus",
    "Num": "Numbers",       "Deut": "Deuteronomy",    "Josh": "Joshua",
    "Judg": "Judges",       "Ruth": "Ruth",
    "1Sam": "1 Samuel",     "2Sam": "2 Samuel",
    "1Kgs": "1 Kings",      "2Kgs": "2 Kings",
    "1Chr": "1 Chronicles", "2Chr": "2 Chronicles",
    "Ezra": "Ezra",         "Neh": "Nehemiah",        "Esth": "Esther",
    "Job": "Job",           "Ps": "Psalms",           "Prov": "Proverbs",
    "Eccl": "Ecclesiastes", "Song": "Song of Solomon",
    "Isa": "Isaiah",        "Jer": "Jeremiah",        "Lam": "Lamentations",
    "Ezek": "Ezekiel",      "Dan": "Daniel",          "Hos": "Hosea",
    "Joel": "Joel",         "Amos": "Amos",           "Obad": "Obadiah",
    "Jonah": "Jonah",       "Mic": "Micah",           "Nah": "Nahum",
    "Hab": "Habakkuk",      "Zeph": "Zephaniah",      "Hag": "Haggai",
    "Zech": "Zechariah",    "Mal": "Malachi",
    "Matt": "Matthew",      "Mark": "Mark",           "Luke": "Luke",
    "John": "John",         "Acts": "Acts",           "Rom": "Romans",
    "1Cor": "1 Corinthians","2Cor": "2 Corinthians",
    "Gal": "Galatians",     "Eph": "Ephesians",       "Phil": "Philippians",
    "Col": "Colossians",
    "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians",
    "1Tim": "1 Timothy",    "2Tim": "2 Timothy",
    "Titus": "Titus",       "Phlm": "Philemon",       "Heb": "Hebrews",
    "Jas": "James",
    "1Pet": "1 Peter",      "2Pet": "2 Peter",
    "1John": "1 John",      "2John": "2 John",        "3John": "3 John",
    "Jude": "Jude",         "Rev": "Revelation",
    # Apocrypha — intentionally omitted so they're silently skipped
}

# ── Nave's legacy book abbreviations (used by Gutenberg/GitHub fallback) ─────
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


# ── HTTP helper ───────────────────────────────────────────────────────────────

def _fetch(url: str, headers: dict | None = None) -> bytes:
    h = {"User-Agent": "BibleApp/1.0", "Accept": "application/vnd.github+json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


# ── CCEL ThML parser (primary) ────────────────────────────────────────────────

CCEL_URL = "https://ccel.org/ccel/n/nave/bible.xml"

def parse_parsed_attr(parsed: str) -> list[tuple[str, int, int]]:
    """
    Parse a CCEL ThML 'parsed' attribute into (book, chapter, verse) tuples.

    Format: |BookAbbr|StartCh|StartV|EndCh|EndV
    - EndCh=0, EndV=0 → single verse
    - EndCh==StartCh → verse range within one chapter
    - EndCh>StartCh → cross-chapter range (expand with max 176 verses/chapter)
    - StartV=0 → whole-chapter reference, skipped
    """
    results: list[tuple[str, int, int]] = []
    parts = parsed.split("|")
    if len(parts) < 6:
        return results

    abbr, sc, sv, ec, ev = parts[1], parts[2], parts[3], parts[4], parts[5]
    book = PARSED_BOOK_MAP.get(abbr)
    if not book:
        return results  # apocrypha or unknown — skip silently

    try:
        sc, sv, ec, ev = int(sc), int(sv), int(ec), int(ev)
    except ValueError:
        return results

    if sv == 0:
        return results  # whole-chapter ref — skip

    if ec == 0 or ec == sc:
        # Single verse or same-chapter range
        end_v = ev if ev > 0 else sv
        for v in range(sv, end_v + 1):
            results.append((book, sc, v))
    else:
        # Cross-chapter range
        for c in range(sc, ec + 1):
            v_start = sv if c == sc else 1
            v_end   = ev if c == ec else 176
            for v in range(v_start, v_end + 1):
                results.append((book, c, v))

    return results


def parse_thml_naves(data: bytes) -> list[dict]:
    """
    Parse CCEL ThML XML for Nave's Topical Bible.

    Returns list of {topic: str, _direct_refs: [(book, ch, v), ...]}.
    """
    text = data.decode("utf-8", errors="replace")
    # Strip DOCTYPE declaration so ElementTree doesn't try to fetch the DTD
    text = re.sub(r"<!DOCTYPE[^>]*>", "", text, count=1)

    root = ET.fromstring(text)
    records: list[dict] = []

    for glossary in root.iter("glossary"):
        children = list(glossary)
        current_term: str | None = None
        for child in children:
            if child.tag == "term":
                current_term = (child.text or "").strip()
            elif child.tag == "def" and current_term:
                direct_refs: list[tuple[str, int, int]] = []
                for sr in child.iter("scripRef"):
                    parsed_attr = sr.get("parsed", "")
                    if parsed_attr:
                        direct_refs.extend(parse_parsed_attr(parsed_attr))
                if direct_refs:
                    records.append({
                        "topic": current_term,
                        "_direct_refs": direct_refs,
                    })
                current_term = None

    return records


# ── Legacy reference-string parser (fallback) ─────────────────────────────────

def parse_refs(raw: str) -> list[tuple[str, int, int]]:
    """
    Parse a Nave's legacy reference string into (book, chapter, verse) tuples.

    Reference strings look like:
        "Ge 1:1,3-5; Ex 4:14; 4:27-31; 1Co 13:1-3"
    """
    results: list[tuple[str, int, int]] = []
    current_book = ""
    segments = [s.strip() for s in raw.split(";") if s.strip()]

    for seg in segments:
        book_match = re.match(r"^([1-3]?[A-Z][a-z]{0,3})\s+(.+)$", seg)
        if book_match:
            abbr = book_match.group(1)
            if abbr in BOOK_MAP:
                current_book = BOOK_MAP[abbr]
                seg = book_match.group(2)

        if not current_book:
            continue

        parts = [p.strip() for p in seg.split(",") if p.strip()]
        current_chapter = None

        for part in parts:
            xchap = re.match(r"^(\d+):(\d+)-(\d+):(\d+)$", part)
            if xchap:
                c1, v1, c2, v2 = (int(xchap.group(1)), int(xchap.group(2)),
                                   int(xchap.group(3)), int(xchap.group(4)))
                for c in range(c1, c2 + 1):
                    vs = v1 if c == c1 else 1
                    ve = v2 if c == c2 else 50
                    for v in range(vs, ve + 1):
                        results.append((current_book, c, v))
                current_chapter = c2
                continue

            cv = re.match(r"^(\d+):(\d+)(?:-(\d+))?$", part)
            if cv:
                ch = int(cv.group(1))
                v1 = int(cv.group(2))
                v2 = int(cv.group(3)) if cv.group(3) else v1
                current_chapter = ch
                for v in range(v1, v2 + 1):
                    results.append((current_book, ch, v))
                continue

            bare = re.match(r"^(\d+)(?:-(\d+))?$", part)
            if bare and current_chapter is not None:
                v1 = int(bare.group(1))
                v2 = int(bare.group(2)) if bare.group(2) else v1
                for v in range(v1, v2 + 1):
                    results.append((current_book, current_chapter, v))

    return results


# ── Download orchestration ────────────────────────────────────────────────────

ALLOWED_EXTS = (".json", ".xml", ".csv", ".tsv", ".txt")

def _github_tree(owner: str, repo: str) -> list[str]:
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


PROBE_REPOS = [
    ("scrollmapper", "bible_databases"),
    ("scrollmapper", "Nave"),
    ("scrollmapper", "naves-topical-bible"),
    ("openbibleinfo", "Nave-Topical-Bible"),
    ("openbibleinfo", "nave"),
    ("seven1m", "open-bibles"),
]

FILENAME_KEYWORDS = ("nave", "topical", "topic")

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

_BOOK_PATTERN = "|".join(
    re.escape(k) for k in sorted(GUTENBERG_BOOK_MAP, key=len, reverse=True)
)
_REF_RE = re.compile(
    rf"(?<!\w)({_BOOK_PATTERN})\.?\s+(\d+):(\d+)(?:-(\d+))?",
    re.IGNORECASE,
)


def parse_xml_naves(data: bytes) -> list:
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


def download_naves() -> list:
    # ── Try CCEL ThML (primary source) ────────────────────────────────────────
    print(f"  Trying CCEL ThML source ({CCEL_URL}) …")
    try:
        raw = _fetch(CCEL_URL)
        records = parse_thml_naves(raw)
        print(f"  Parsed {len(records):,} records (CCEL ThML).")
        if records:
            return records
    except Exception as e:
        print(f"  CCEL failed: {e}")

    # ── Fallback: probe GitHub repos ───────────────────────────────────────────
    print("  Falling back to GitHub repo search …")
    for owner, repo in PROBE_REPOS:
        paths = _github_tree(owner, repo)
        for path in paths:
            low = path.lower()
            if not any(kw in low for kw in FILENAME_KEYWORDS):
                continue
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
            if ext not in ALLOWED_EXTS:
                continue
            for branch in ("master", "main"):
                raw_url = (f"https://raw.githubusercontent.com"
                           f"/{owner}/{repo}/{branch}/{path}")
                try:
                    raw = _fetch(raw_url)
                    if ext == ".json":
                        data = json.loads(raw.decode("utf-8"))
                        print(f"  Parsed {len(data):,} records (JSON from {raw_url}).")
                        return data
                    if ext == ".xml":
                        data = parse_xml_naves(raw)
                        if data:
                            print(f"  Parsed {len(data):,} records (XML from {raw_url}).")
                            return data
                    if ext in (".csv", ".tsv"):
                        data = parse_csv_naves(raw)
                        if data:
                            print(f"  Parsed {len(data):,} records (CSV from {raw_url}).")
                            return data
                except Exception:
                    pass

    print("  Could not locate Nave's data from any source.")
    return []


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Downloading Nave's Topical Bible …")
    raw = download_naves()

    if not raw:
        print("\nERROR: Could not download Nave's data.")
        print("Please check your internet connection and try again.")
        sys.exit(1)

    print("Building topics and verse references …")

    topics: list[tuple[int, str]] = []
    refs:   list[tuple[int, str, int, int]] = []
    seen_topic: dict[str, int] = {}

    for record in raw:
        name: str = record.get("topic", "").strip().title()
        if not name:
            continue

        if name not in seen_topic:
            tid = len(topics) + 1
            seen_topic[name] = tid
            topics.append((tid, name))
        else:
            tid = seen_topic[name]

        # CCEL ThML records carry pre-parsed refs; legacy records use strings
        if "_direct_refs" in record:
            for book, ch, v in record["_direct_refs"]:
                refs.append((tid, book, ch, v))
        else:
            ref_str: str = record.get("references", "") or ""
            if ref_str.strip():
                for book, ch, v in parse_refs(ref_str):
                    refs.append((tid, book, ch, v))

    print(f"  {len(topics):,} topics, {len(refs):,} verse references.")

    # ── Write TypeScript ──────────────────────────────────────────────────────
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

        f.write("export const NAVES_TOPICS: Array<[number, string]> = [\n")
        for tid, name in topics:
            escaped = name.replace("\\", "\\\\").replace("`", "\\`").replace("'", "\\'")
            f.write(f"  [{tid}, '{escaped}'],\n")
        f.write("]\n\n")

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
