"""
Copies 5 Android-only tables from the Android bible.db into the desktop bible.db.

Tables migrated:
  - early_texts          (early Christian writings: Didache, etc.)
  - early_text_footnotes
  - lxx_words            (Septuagint Greek words)
  - wlc_words            (Westminster Leningrad Codex Hebrew words)
  - dss_words            (Dead Sea Scrolls Hebrew words)

Usage: python scripts/migrate-android-tables.py
"""

import sqlite3
import os

ANDROID_DB = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'BibleAndroidApp', 'assets', 'db', 'bible.db')
DESKTOP_DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'bible.db')

ANDROID_DB = os.path.normpath(ANDROID_DB)
DESKTOP_DB = os.path.normpath(DESKTOP_DB)

print(f"Android DB: {ANDROID_DB}")
print(f"Desktop DB: {DESKTOP_DB}")

assert os.path.exists(ANDROID_DB), f"Android DB not found: {ANDROID_DB}"
assert os.path.exists(DESKTOP_DB), f"Desktop DB not found: {DESKTOP_DB}"

src = sqlite3.connect(ANDROID_DB)
dst = sqlite3.connect(DESKTOP_DB)

src.row_factory = sqlite3.Row

TABLES = {
    'early_texts': """
        CREATE TABLE IF NOT EXISTS early_texts (
            book    TEXT    NOT NULL,
            chapter INTEGER NOT NULL,
            verse   INTEGER NOT NULL,
            text    TEXT    NOT NULL,
            PRIMARY KEY (book, chapter, verse)
        )
    """,
    'early_text_footnotes': """
        CREATE TABLE IF NOT EXISTS early_text_footnotes (
            book    TEXT    NOT NULL,
            chapter INTEGER NOT NULL,
            marker  INTEGER NOT NULL,
            note    TEXT    NOT NULL,
            PRIMARY KEY (book, chapter, marker)
        )
    """,
    'lxx_words': """
        CREATE TABLE IF NOT EXISTS lxx_words (
            book     TEXT    NOT NULL,
            chapter  INTEGER NOT NULL,
            verse    INTEGER NOT NULL,
            position INTEGER NOT NULL,
            greek    TEXT    NOT NULL,
            translit TEXT,
            strongs  TEXT,
            gloss    TEXT,
            morph    TEXT,
            greek_norm TEXT,
            PRIMARY KEY (book, chapter, verse, position)
        )
    """,
    'wlc_words': """
        CREATE TABLE IF NOT EXISTS wlc_words (
            book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
            position INTEGER NOT NULL, hebrew TEXT NOT NULL,
            translit TEXT, strongs TEXT, gloss TEXT, morph TEXT,
            PRIMARY KEY (book, chapter, verse, position)
        )
    """,
    'dss_words': """
        CREATE TABLE IF NOT EXISTS dss_words (
            book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
            position INTEGER NOT NULL, hebrew TEXT NOT NULL,
            translit TEXT, strongs TEXT, gloss TEXT, morph TEXT,
            PRIMARY KEY (book, chapter, verse, position)
        )
    """,
}

INDEXES = {
    'lxx_words': 'CREATE INDEX IF NOT EXISTS idx_lxx_words_greek_norm ON lxx_words(greek_norm)',
}

for table, create_sql in TABLES.items():
    print(f"\nMigrating {table}...")
    dst.execute(create_sql)
    dst.commit()

    existing = dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    if existing > 0:
        print(f"  Already has {existing} rows — skipping")
        continue

    rows = src.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        print(f"  No rows in source — skipping")
        continue

    cols = [d[0] for d in src.execute(f"SELECT * FROM {table} LIMIT 1").description]
    placeholders = ', '.join(['?'] * len(cols))
    col_list = ', '.join(cols)

    dst.executemany(
        f"INSERT OR IGNORE INTO {table} ({col_list}) VALUES ({placeholders})",
        [tuple(r) for r in rows]
    )
    dst.commit()
    inserted = dst.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  Inserted {inserted} rows")

    if table in INDEXES:
        dst.execute(INDEXES[table])
        dst.commit()
        print(f"  Index created")

src.close()
dst.close()
print("\nDone.")
