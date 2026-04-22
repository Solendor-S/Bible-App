"""
Extract per-word context-sensitive English glosses from OpenGNT keyedFeatures.csv.
Outputs nt-glosses.json: [{book, chapter, verse, position, gloss}, ...]
where position is 1-based word index within the verse (matching greek_words.position).
"""
import csv
import json
import os
import sys

BOOK_MAP = {
    40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
    45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
    49: "Ephesians", 50: "Philippians", 51: "Colossians",
    52: "1 Thessalonians", 53: "2 Thessalonians",
    54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon",
    58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
    62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
}

FULLWIDTH_PIPE = "｜"  # ｜

def strip_brackets(s):
    return s.strip("〔〕【】「」『』〖〗［］").strip()

def parse_bracketed(s):
    """Remove 〔〕 brackets and split on fullwidth pipe."""
    inner = s.strip()
    if inner.startswith("〔") or inner.startswith("「"):
        inner = inner[1:]
    if inner.endswith("〕") or inner.endswith("」"):
        inner = inner[:-1]
    # Also handle 〔 〕 (U+3014 / U+3015) and 【 】
    inner = inner.strip("〔〕【】")
    return [p.strip() for p in inner.split(FULLWIDTH_PIPE)]

script_dir = os.path.dirname(os.path.abspath(__file__))
raw_dir = os.path.join(script_dir, "..", "data", "raw")

csv_path = os.path.join(raw_dir, "opengnt-extracted", "OpenGNT_keyedFeatures.csv")
out_path = os.path.join(raw_dir, "nt-glosses.json")

if not os.path.exists(csv_path):
    print(f"ERROR: {csv_path} not found", file=sys.stderr)
    sys.exit(1)

print(f"Parsing {csv_path} ...")

results = []
errors = 0
current_verse_key = None
verse_position = 0

with open(csv_path, encoding="utf-8") as f:
    reader = csv.reader(f, delimiter="\t")
    header = next(reader)  # skip header

    for i, row in enumerate(reader):
        if len(row) < 9:
            errors += 1
            continue

        try:
            # Col 4: 〔book｜chapter｜verse〕
            bcv = parse_bracketed(row[4])
            if len(bcv) < 3:
                errors += 1
                continue
            book_num = int(bcv[0])
            chapter = int(bcv[1])
            verse = int(bcv[2])

            # Col 8: 〔MounceGloss｜TyndaleHouseGloss｜OpenGNTGloss〕
            gloss_parts = parse_bracketed(row[8])
            if len(gloss_parts) < 3:
                errors += 1
                continue
            gloss = gloss_parts[2].strip()

            # Skip empty gloss
            if not gloss:
                errors += 1
                continue

            book_name = BOOK_MAP.get(book_num)
            if book_name is None:
                continue  # unknown book

            # Track 1-based position within verse
            verse_key = (book_num, chapter, verse)
            if verse_key != current_verse_key:
                current_verse_key = verse_key
                verse_position = 0
            verse_position += 1

            results.append({
                "book": book_name,
                "chapter": chapter,
                "verse": verse,
                "position": verse_position,
                "gloss": gloss,
            })

        except (ValueError, IndexError):
            errors += 1
            continue

print(f"Parsed {len(results)} word glosses ({errors} errors/skipped)")

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)

print(f"Written to {out_path}")

# Sanity check: first 5 entries
print("\nFirst 5 entries:")
for entry in results[:5]:
    print(f"  {entry}")
