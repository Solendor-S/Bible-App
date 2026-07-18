"""
Import TAGNT-extracted Greek word data into bible.db.

Adds two new tables (same schema as greek_words):
  greek_words_tagnt  -- NA28 critical text words
  greek_words_tr     -- Textus Receptus (Scrivener 1894 / KJV tradition) words

Source JSON files (produced by extract-tagnt.py):
  data/raw/tagnt-critical.json
  data/raw/tagnt-tr.json

Updates both:
  data/bible.db                           (BibleApp source DB)
  ../../BibleAndroidApp/assets/db/bible.db  (Android bundled DB)

Run from any directory:
  python scripts/import-tagnt-to-db.py
"""

import io
import json
import os
import shutil
import sqlite3
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(SCRIPT_DIR, "..", "data")
RAW_DIR      = os.path.join(DATA_DIR, "raw")
SOURCE_DB    = os.path.join(DATA_DIR, "bible.db")
ANDROID_DB   = os.path.join(SCRIPT_DIR, "..", "..", "..", "BibleAndroidApp", "assets", "db", "bible.db")

CRITICAL_JSON = os.path.join(RAW_DIR, "tagnt-critical.json")
TR_JSON       = os.path.join(RAW_DIR, "tagnt-tr.json")

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS {table} (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    book     TEXT,
    chapter  INTEGER,
    verse    INTEGER,
    position INTEGER,
    greek    TEXT,
    translit TEXT,
    strongs  TEXT,
    gloss    TEXT,
    morph    TEXT
)
"""

CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_{table}_bcv ON {table} (book, chapter, verse)
"""

INSERT = """
INSERT INTO {table} (book, chapter, verse, position, greek, translit, strongs, gloss, morph)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def load_json(path: str, label: str) -> list:
    print(f"Loading {label}...")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    print(f"  {len(data):,} words")
    return data


def import_table(cur: sqlite3.Cursor, table: str, words: list):
    print(f"\nImporting {table}...")
    cur.execute(f"DROP TABLE IF EXISTS {table}")
    cur.execute(CREATE_TABLE.format(table=table))
    cur.execute(CREATE_INDEX.format(table=table))

    rows = [
        (w["book"], w["chapter"], w["verse"], w["position"],
         w["greek"], w["translit"], w["strongs"], w["gloss"], w["morph"])
        for w in words
    ]
    cur.executemany(INSERT.format(table=table), rows)
    print(f"  {len(rows):,} rows inserted")

    # Sanity check: John 1:1
    cur.execute(
        f"SELECT position, greek, translit, strongs, morph, gloss "
        f"FROM {table} WHERE book='John' AND chapter=1 AND verse=1 ORDER BY position"
    )
    sample = cur.fetchall()
    print(f"  John 1:1 ({len(sample)} words):")
    for r in sample[:5]:
        print(f"    {r[0]}. {r[1]} ({r[2]}) [{r[3]} {r[4]}] = {r[5]}")
    if len(sample) > 5:
        print(f"    ... +{len(sample)-5} more")


def main():
    # Validate inputs
    for path, label in [(CRITICAL_JSON, "tagnt-critical.json"), (TR_JSON, "tagnt-tr.json")]:
        if not os.path.exists(path):
            print(f"[error] Missing {label} — run extract-tagnt.py first", file=sys.stderr)
            sys.exit(1)

    if not os.path.exists(SOURCE_DB):
        print(f"[error] Source DB not found: {SOURCE_DB}", file=sys.stderr)
        sys.exit(1)

    critical = load_json(CRITICAL_JSON, "tagnt-critical.json")
    tr       = load_json(TR_JSON,       "tagnt-tr.json")

    print(f"\nOpening {SOURCE_DB}...")
    con = sqlite3.connect(SOURCE_DB)
    cur = con.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")

    t0 = time.time()
    import_table(cur, "greek_words_tagnt", critical)
    import_table(cur, "greek_words_tr",    tr)
    con.commit()
    con.close()

    elapsed = time.time() - t0
    print(f"\nCommitted in {elapsed:.1f}s")

    # Copy to Android assets
    android_db = os.path.normpath(ANDROID_DB)
    if os.path.exists(android_db):
        print(f"\nCopying to Android assets DB...")
        shutil.copy2(SOURCE_DB, android_db)
        size_mb = os.path.getsize(android_db) / 1_048_576
        print(f"  {android_db}")
        print(f"  {size_mb:.1f} MB")
    else:
        print(f"\n[warn] Android DB not found at expected path, skipping copy:")
        print(f"  {android_db}")
        print(f"  Copy manually: {SOURCE_DB}")

    print("\nDone.")


if __name__ == "__main__":
    main()
