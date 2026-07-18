"""
Extract Greek NT word data from STEPBible TAGNT files.

TAGNT encodes ALL major text traditions in one file using word-type flags:
  N / n  = Nestle-Aland 27/28 (critical text, used by most modern Bibles)
  K / k  = Textus Receptus (Scrivener 1894, KJV tradition)
  O / o  = Other editions (WH, Tregelles, SBL, Byz, etc.)

Uppercase = translation-significant difference; lowercase = minor (spelling/order).
Both cases are treated as "present in that tradition" for our purposes.

Outputs two JSON files:
  data/raw/tagnt-critical.json  -- NA28 text (N words only)
  data/raw/tagnt-tr.json        -- TR text (K words only)

Each entry:
  {book, chapter, verse, position, greek, translit, strongs, morph, gloss}

Position is 1-based within the verse for each tradition independently,
since TR and critical text sometimes differ in word count per verse.

Source: STEPBible TAGNT CC BY 4.0
  https://github.com/STEPBible/STEPBible-Data
"""

import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR    = os.path.join(SCRIPT_DIR, "..", "data", "raw")
TAGNT_DIR  = os.path.join(RAW_DIR, "tagnt")

TAGNT_FILES = [
    "TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
    "TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
]

OUT_CRITICAL = os.path.join(RAW_DIR, "tagnt-critical.json")
OUT_TR       = os.path.join(RAW_DIR, "tagnt-tr.json")

# Ref pattern: Mat.1.1#01=NKO  (type may be N, K, NK, NKO, K(O), n, k etc.)
REF_RE = re.compile(r'^([A-Za-z0-9]+)\.(\d+)\.(\d+)#(\d+)=([A-Za-z()]+)')

BOOK_MAP = {
    "Mat": "Matthew",   "Mrk": "Mark",      "Luk": "Luke",
    "Jhn": "John",      "Act": "Acts",      "Rom": "Romans",
    "1Co": "1 Corinthians", "2Co": "2 Corinthians",
    "Gal": "Galatians", "Eph": "Ephesians", "Php": "Philippians",
    "Col": "Colossians","1Th": "1 Thessalonians","2Th": "2 Thessalonians",
    "1Ti": "1 Timothy", "2Ti": "2 Timothy", "Tit": "Titus",
    "Phm": "Philemon",  "Heb": "Hebrews",   "Jas": "James",
    "1Pe": "1 Peter",   "2Pe": "2 Peter",
    "1Jn": "1 John",    "2Jn": "2 John",    "3Jn": "3 John",
    "Jud": "Jude",      "Rev": "Revelation",
}


def has_n(word_type: str) -> bool:
    """Word present in NA/critical text (N or n in type flags)."""
    return bool(re.search(r'[Nn]', word_type))


def has_k_plain(word_type: str) -> bool:
    """K present and NOT in parentheses — TR uses the main word."""
    return bool(re.search(r'(?<!\()[Kk]', word_type))


def has_k_variant(word_type: str) -> bool:
    """(K) in type — TR has a different word at this position."""
    return bool(re.search(r'\([Kk]', word_type))


def parse_tr_variant(variants_col: str, clean_gloss_fn):
    """
    Parse the meaning variants column for the TR-specific word form.
    e.g. 'πίστεως (T=pisteōs) of faith - G4102=N-GSF in: TR+Byz'
    Returns (greek, translit, gloss, strongs, morph) or None.
    """
    pattern = re.compile(
        r'(\S+)\s+\(T=([^)]+)\)\s+(.+?)\s+-\s+(G\d+[A-Za-z]*)=(\S+)\s+in:\s*([^\t\n;v]+)',
        re.IGNORECASE,
    )
    for m in pattern.finditer(variants_col):
        greek_v, translit_v, gloss_v, strongs_raw, morph_v, editions = m.groups()
        if 'TR' in editions.upper():
            strongs_v = re.sub(r'^([GH]\d+)[A-Za-z]$', r'\1', strongs_raw.strip())
            sm = re.match(r'^([GH])(\d+)$', strongs_v)
            if sm:
                strongs_v = f"{sm.group(1)}{int(sm.group(2)):04d}"
            return greek_v.strip(), translit_v.strip(), clean_gloss_fn(gloss_v), strongs_v, morph_v.strip()
    return None


def parse_greek_col(raw: str):
    """
    'Βίβλος (Biblos)'  ->  greek='Βίβλος', translit='Biblos'
    'ἦν'               ->  greek='ἦν',     translit=''
    """
    raw = raw.strip()
    m = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw, ""


def parse_strongs_morph(raw: str):
    """
    'G0976=N-NSF'   ->  strongs='G0976', morph='N-NSF'
    'G2424G=N-GSM-P' ->  strongs='G2424', morph='N-GSM-P'
    """
    raw = raw.strip()
    if "=" not in raw:
        return raw, ""
    strongs_raw, morph = raw.split("=", 1)
    # Normalise strongs: strip suffix letter after digits (G2424G -> G2424)
    strongs = re.sub(r'^([GH]\d+)[A-Za-z]$', r'\1', strongs_raw.strip())
    # Pad to standard 4-digit form (G976 -> G0976)
    m = re.match(r'^([GH])(\d+)$', strongs)
    if m:
        strongs = f"{m.group(1)}{int(m.group(2)):04d}"
    return strongs, morph.strip()


def clean_gloss(raw: str) -> str:
    """
    '[The] book'  -> 'book'
    '<obj.>'      -> ''
    'of [the] genealogy' -> 'of genealogy'
    """
    s = raw.strip()
    if not s:
        return ""
    # Strip purely grammatical angle-bracket markers
    if s.startswith('<') and s.endswith('>'):
        return ""
    s = re.sub(r'<[^>]*>', '', s)
    # Remove square-bracket optional words
    s = re.sub(r'\[([^\]]*)\]', r'\1', s)
    s = s.strip().strip('.,;:!?"\'')
    return s.lower() if s else ""


# ── Main parse loop ───────────────────────────────────────────────────────────

critical: list[dict] = []
tr:       list[dict] = []

# Per-tradition position counters reset per verse
n_pos: dict[tuple, int] = {}
k_pos: dict[tuple, int] = {}

total_words = 0
skipped     = 0

for fname in TAGNT_FILES:
    fpath = os.path.join(TAGNT_DIR, fname)
    if not os.path.exists(fpath):
        print(f"[missing] {fname}", file=sys.stderr)
        continue

    print(f"\nParsing {fname[:55]}...")
    with open(fpath, "rb") as f:
        raw = f.read()

    lines = raw.decode("utf-8", errors="replace").splitlines()
    file_words = 0

    for line in lines:
        # Skip blank lines and lines that don't start with a book abbreviation
        stripped = line.strip()
        if not stripped:
            continue
        # Data lines: start with BookAbbr.chapter.verse (e.g. Mat.1.1)
        m = REF_RE.match(stripped)
        if not m:
            continue

        abbr     = m.group(1)
        chapter  = int(m.group(2))
        verse    = int(m.group(3))
        # word_num = int(m.group(4))  -- TAGNT word num; we track position ourselves
        wtype    = m.group(5)

        book = BOOK_MAP.get(abbr)
        if book is None:
            skipped += 1
            continue

        cols = stripped.split("\t")
        if len(cols) < 4:
            skipped += 1
            continue

        greek_raw   = cols[1] if len(cols) > 1 else ""
        gloss_raw   = cols[2] if len(cols) > 2 else ""
        sg_raw      = cols[3] if len(cols) > 3 else ""

        greek, translit = parse_greek_col(greek_raw)
        strongs, morph  = parse_strongs_morph(sg_raw)
        gloss           = clean_gloss(gloss_raw)

        if not greek or not strongs:
            skipped += 1
            continue

        bcv = (book, chapter, verse)

        # ── Critical (N) text ─────────────────────────────────────────────────
        if has_n(wtype):
            n_pos[bcv] = n_pos.get(bcv, 0) + 1
            critical.append({
                "book":     book,
                "chapter":  chapter,
                "verse":    verse,
                "position": n_pos[bcv],
                "greek":    greek,
                "translit": translit,
                "strongs":  strongs,
                "morph":    morph,
                "gloss":    gloss,
            })

        # ── TR (K) text ───────────────────────────────────────────────────────
        if has_k_plain(wtype):
            k_pos[bcv] = k_pos.get(bcv, 0) + 1
            tr.append({
                "book": book, "chapter": chapter, "verse": verse,
                "position": k_pos[bcv],
                "greek": greek, "translit": translit,
                "strongs": strongs, "morph": morph, "gloss": gloss,
            })
        elif has_k_variant(wtype):
            # TR uses a different word — parse it from the variants column
            variants_col = cols[6] if len(cols) > 6 else ""
            variant = parse_tr_variant(variants_col, clean_gloss)
            if variant:
                gv, tv, glossv, sv, mv = variant
                k_pos[bcv] = k_pos.get(bcv, 0) + 1
                tr.append({
                    "book": book, "chapter": chapter, "verse": verse,
                    "position": k_pos[bcv],
                    "greek": gv, "translit": tv,
                    "strongs": sv, "morph": mv, "gloss": glossv,
                })
            else:
                # Fallback: variant column unparseable, use main word
                k_pos[bcv] = k_pos.get(bcv, 0) + 1
                tr.append({
                    "book": book, "chapter": chapter, "verse": verse,
                    "position": k_pos[bcv],
                    "greek": greek, "translit": translit,
                    "strongs": strongs, "morph": morph, "gloss": gloss,
                })

        file_words += 1

    total_words += file_words
    print(f"  {file_words:,} words processed")

print(f"\nTotal words processed: {total_words:,} ({skipped} skipped)")
print(f"  Critical (NA): {len(critical):,} words")
print(f"  TR (K):        {len(tr):,} words")

# ── Write output ──────────────────────────────────────────────────────────────

with open(OUT_CRITICAL, "w", encoding="utf-8") as f:
    json.dump(critical, f, ensure_ascii=False)
print(f"\nWritten: {OUT_CRITICAL}")

with open(OUT_TR, "w", encoding="utf-8") as f:
    json.dump(tr, f, ensure_ascii=False)
print(f"Written: {OUT_TR}")

# ── Sanity check: John 1:1 ────────────────────────────────────────────────────

print("\n--- John 1:1 Critical ---")
for w in [e for e in critical if e["book"] == "John" and e["chapter"] == 1 and e["verse"] == 1]:
    print(f"  {w['position']}. {w['greek']} ({w['translit']}) [{w['strongs']} {w['morph']}] = {w['gloss']}")

print("\n--- John 1:1 TR ---")
for w in [e for e in tr if e["book"] == "John" and e["chapter"] == 1 and e["verse"] == 1]:
    print(f"  {w['position']}. {w['greek']} ({w['translit']}) [{w['strongs']} {w['morph']}] = {w['gloss']}")
