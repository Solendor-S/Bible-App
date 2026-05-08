"""
Extract textual variants from STEP Bible TAHOT data.
Outputs ot-variants.json: one entry per word that has a significant meaning variant.

Focuses on MEANING variants (column 6) only — spelling-only differences are skipped
as they don't affect translation.

Source codes and their meanings:
  K = Ketiv  — original uncorrected consonantal text (replaced by scribal Qere)
  D = Dead Sea Scrolls / Judean Desert manuscripts
  A = Aleppo Codex (when it differs from Leningrad)
  B = BHS (Biblia Hebraica Stuttgartensia edition)
  C = Cairo Codex
  H = Ben Chaim / Second Rabbinic Bible
  S = Scribal tradition (Tiqqune Sopherim, Itture Sopherim)
  X = LXX extra text (back-translated from Septuagint, not in Leningrad)
  E = Scholarly emendation
  R = Restored from parallel passage (Jos.21.36-37 from 1Chr; Neh.7.67b from Ezra)
  L = Leningrad Codex (when recorded as a variant against another primary source)
"""
import json
import os
import re
import sys

TAHOT_CACHE_FILES = [
    "tahot_cache_TAHOT_Gen-De.txt",
    "tahot_cache_TAHOT_Jos-Es.txt",
    "tahot_cache_TAHOT_Job-Sn.txt",
    "tahot_cache_TAHOT_Isa-Ma.txt",
]

BOOK_MAP = {
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

SOURCE_LABELS = {
    'K': 'Ketiv (original unpointed text, before Qere correction)',
    'D': 'Dead Sea Scrolls',
    'A': 'Aleppo Codex',
    'B': 'BHS (Biblia Hebraica Stuttgartensia)',
    'C': 'Cairo Codex',
    'H': 'Ben Chaim / Second Rabbinic Bible',
    'S': 'Scribal tradition (Tiqqune Sopherim)',
    'X': 'Septuagint (LXX) — extra word not in Masoretic text',
    'E': 'Scholarly emendation',
    'R': 'Restored from parallel passage',
    'L': 'Leningrad Codex',
    'V': 'Various Hebrew manuscripts',
    'P': 'Alternate punctuation / accentuation',
    'F': 'Alternate word division',
}

# Refs like: Gen.1.1#01=L  or  Gen.9.21#07=Q(K)
# Some OT refs include Hebrew verse numbers in parens: Psa.22.16(22.17)#07=L(D)
REF_RE = re.compile(r'^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\([^)]+\))?#(\d+)=(.+)$')


def clean_english(raw: str) -> str:
    """Clean the English gloss from a variant field."""
    s = raw.strip()
    # Remove leading/trailing punctuation and brackets
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\[[^\]]+\]', '', s)
    # Handle prefix/root/suffix slash notation — keep all parts
    s = s.replace('/', ' / ').strip()
    s = re.sub(r'\s+', ' ', s).strip()
    # Strip trailing punctuation
    s = s.strip('.,;:')
    return s


def parse_variant_field(field: str) -> list[dict]:
    """
    Parse a TAHOT meaning-variant field into structured entries.

    Input examples:
      'K= \'o.ho.Lo/h (אָהֳלֹ/ה) "tent/ his" (H0168G=HNcbsc)'
      'D= ha.shi.Li.shu (הַ/שְּׁלִישִׁ֔י) "the/ third" (H9009/H7992=HTd/Aomsa)'
      'S= Yah.weh (יְ/הוָה) "and/ Yahweh" (H9002/H3068G=HC/Npt)'

    Returns list of dicts with: source, source_label, hebrew, english
    """
    results = []
    if not field.strip():
        return results

    # Split multiple variants (separated by ¦ ; or ; between entries)
    # Each entry starts with uppercase letter(s) followed by =
    entries = re.split(r'(?<=[)\"])\s*[¦;]+\s*(?=[A-Z]+=)', field)

    for entry in entries:
        entry = entry.strip().rstrip(';').strip()
        if not entry:
            continue

        m = re.match(r'^([A-Z]+)=\s*(.*)$', entry)
        if not m:
            continue

        source = m.group(1)
        rest = m.group(2).strip()

        # Extract Hebrew: first parenthesized group containing Hebrew chars
        heb_m = re.search(r'\(([^)]*[֐-׿][^)]*)\)', rest)
        hebrew = heb_m.group(1).strip() if heb_m else ''
        # Strip cantillation / punctuation marks from hebrew for display
        hebrew_clean = re.sub(r'[֑-ׇ׳״\\]', '', hebrew).strip()

        # Extract English: content in double quotes
        eng_m = re.search(r'"([^"]+)"', rest)
        english = clean_english(eng_m.group(1)) if eng_m else ''

        if not hebrew_clean and not english:
            continue

        results.append({
            'source': source,
            'source_label': SOURCE_LABELS.get(source, source),
            'hebrew': hebrew_clean,
            'english': english,
        })

    return results


def parse_text_type(type_str: str) -> tuple[str, list[str]]:
    """
    Parse a text type string like 'Q(K)', 'L(abh)', 'LAH(b)', 'Q(K+B)'.
    Returns (main_type, [variant_codes]).
    Main type is the first uppercase letter(s) before any parenthesis.
    """
    # Extract the main type (before any bracket or lowercase)
    main_m = re.match(r'^([A-Z]+)', type_str)
    main = main_m.group(1) if main_m else type_str[:1]

    # Extract variant codes from inside parentheses
    var_m = re.search(r'\(([^)]+)\)', type_str)
    variants = []
    if var_m:
        inner = var_m.group(1)
        # Split on + for multiple variants; uppercase = significant, lowercase = spelling
        for part in re.split(r'\+', inner):
            part = part.strip()
            if part and part[0].isupper():
                variants.append(part)

    return main, variants


script_dir = os.path.dirname(os.path.abspath(__file__))
raw_dir = os.path.join(script_dir, "..", "data", "raw")
out_path = os.path.join(raw_dir, "ot-variants.json")

all_results: list[dict] = []
total_count = 0

for cache_file in TAHOT_CACHE_FILES:
    fpath = os.path.join(raw_dir, cache_file)
    if not os.path.exists(fpath):
        print(f"  Missing: {cache_file} — skipping", file=sys.stderr)
        continue

    print(f"Processing {cache_file}...")
    with open(fpath, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    file_count = 0
    for line in lines:
        line = line.rstrip('\r\n')
        if not line or line.startswith('\t') or line.startswith(' ') or line.startswith('#') or line.startswith('='):
            continue

        parts = line.split('\t')
        if len(parts) < 7:
            continue

        m = REF_RE.match(parts[0])
        if not m:
            continue

        abbr = m.group(1)
        chapter = int(m.group(2))
        verse = int(m.group(3))
        word_num = int(m.group(4))
        type_str = m.group(5)

        book = BOOK_MAP.get(abbr)
        if book is None:
            continue

        # Skip pure Ketiv lines — the Q(K) line already captures the pair
        main_type, _ = parse_text_type(type_str)
        if main_type == 'K':
            continue

        meaning_var = parts[6].strip() if len(parts) > 6 else ''
        if not meaning_var:
            continue

        # Main word reading (English gloss in col 3, Hebrew in col 1)
        main_hebrew = parts[1].strip() if len(parts) > 1 else ''
        main_hebrew_clean = re.sub(r'[֑-ׇ׳״\\]', '', main_hebrew).strip()
        main_english = clean_english(parts[3]) if len(parts) > 3 else ''

        variants = parse_variant_field(meaning_var)
        if not variants:
            continue

        word_ref = f"{abbr}.{chapter}.{verse}#{word_num:02d}"

        for v in variants:
            all_results.append({
                "book": book,
                "chapter": chapter,
                "verse": verse,
                "word_ref": word_ref,
                "testament": "ot",
                "main_type": main_type,
                "main_hebrew": main_hebrew_clean,
                "main_english": main_english,
                "variant_source": v['source'],
                "variant_source_label": v['source_label'],
                "variant_hebrew": v['hebrew'],
                "variant_english": v['english'],
            })
            file_count += 1

    print(f"  {file_count} meaning variants extracted")
    total_count += file_count

print(f"\nTotal: {total_count} OT meaning variants")

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_results, f, ensure_ascii=False, indent=None)

print(f"Written to {out_path}")

# Quick stats
from collections import Counter
source_counts = Counter(r['variant_source'] for r in all_results)
print("\nVariant source breakdown:")
for src, count in source_counts.most_common():
    print(f"  {src} ({SOURCE_LABELS.get(src, '?')}): {count}")
