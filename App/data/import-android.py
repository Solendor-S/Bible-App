"""Build App/data/bible.db from the Android (Patristica) databases.

Android data wins outright: the desktop DB is rebuilt from the Android core DB
plus every pack, exactly as Android users get it, with everything bundled into
one file (desktop has no APK size limit, so no pack/online split).

The Android repo is READ-ONLY: every source is opened with ?mode=ro.

Desktop-only data kept: Nave's Topical Bible (parsed from data/navesData.ts).

Usage:  python data/import-android.py [--android C:/Projects/BibleAndroidApp/Patristica]
Writes data/bible.db.new, self-checks it, then swaps it over data/bible.db
(previous file kept as data/bible.db.bak).
"""
import argparse
import glob
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)


def ro(path):
    return 'file:' + path.replace('\\', '/') + '?mode=ro'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--android', default='C:/Projects/BibleAndroidApp/Patristica')
    args = ap.parse_args()
    root = args.android
    core = os.path.join(root, 'assets', 'db', 'bible.db')
    packs = os.path.join(root, 'temp', 'packs')
    full = os.path.join(root, 'temp', 'bible_full_backup.db')  # index DDL only

    out = os.path.join(HERE, 'bible.db.new')
    if os.path.exists(out):
        os.remove(out)
    db = sqlite3.connect('file:' + out.replace('\\', '/'), uri=True)  # uri: ATTACH ?mode=ro
    db.execute('PRAGMA journal_mode=OFF')
    db.execute('PRAGMA synchronous=OFF')

    expected = {}  # table -> expected row count (sum over sources)

    def copy(src_path, tables, rename=None, drop_id=False):
        """Copy tables from a read-only source. rename maps src->dest names.
        drop_id: insert without the integer id (tables split across packs)."""
        rename = rename or {}
        db.execute('ATTACH DATABASE ? AS src', (ro(src_path),))
        try:
            for t in tables:
                dest = rename.get(t, t)
                row = db.execute("SELECT sql FROM src.sqlite_master WHERE type='table' AND name=?", (t,)).fetchone()
                if not row:
                    sys.exit(f'missing table {t} in {src_path}')
                exists = db.execute("SELECT 1 FROM main.sqlite_master WHERE name=?", (dest,)).fetchone()
                if not exists:
                    ddl = re.sub(r'CREATE TABLE\s+"?' + re.escape(t) + r'"?', f'CREATE TABLE "{dest}"', row[0], count=1)
                    db.execute(ddl)
                cols = [r[1] for r in db.execute(f'PRAGMA src.table_info("{t}")')]
                if drop_id and cols[0] == 'id':
                    cols = cols[1:]
                cl = ', '.join(f'"{c}"' for c in cols)
                n = db.execute(f'SELECT COUNT(*) FROM src."{t}"').fetchone()[0]
                db.execute(f'INSERT INTO main."{dest}" ({cl}) SELECT {cl} FROM src."{t}"')
                expected[dest] = expected.get(dest, 0) + n
            db.commit()
        finally:
            db.execute('DETACH DATABASE src')

    # ── Core (everything Android bundles) ────────────────────────────────────
    c = sqlite3.connect(ro(core), uri=True)
    core_tables = [r[0] for r in c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    c.close()
    copy(core, core_tables)

    # ── Packs ────────────────────────────────────────────────────────────────
    p = lambda name: os.path.join(packs, name)
    copy(p('asv.db'), ['bible_translations'])
    copy(p('web.db'), ['bible_translations'])
    copy(p('bsb.db'), ['bible_translations', 'bsb_footnotes'])  # bsb_strongs_map already in core
    copy(p('elxx.db'), ['bible_translations', 'elxx_notes', 'lxx_words', 'lxx_apostolic_words'])
    copy(p('dss.db'), ['dss_words', 'textual_variants'], drop_id=True)
    copy(p('sblgnt.db'), ['greek_words'])
    copy(p('tagnt.db'), ['greek_words_tagnt'])
    copy(p('tahot.db'), ['hebrew_words'])
    for f in sorted(glob.glob(p('apoc-*.db'))):
        copy(f, ['apocrypha_books', 'apocrypha_verses'], drop_id=True)
    for f in sorted(glob.glob(p('early-*.db'))):
        copy(f, ['early_texts', 'early_text_footnotes'])
        copy(f, ['early_text_refs'], drop_id=True)
    copy(p('commentary-fathers.db'), ['commentary_texts', 'commentary_entries'])
    copy(p('commentary-legacy.db'), ['commentary_legacy'])
    copy(p('aquinas.db'), ['commentary_texts', 'commentary_entries', 'aquinas_topics'],
         rename={'commentary_texts': 'aquinas_texts', 'commentary_entries': 'aquinas_entries'})

    # early_text_refs: the core copy and the per-work pack copies overlap — dedupe by content.
    db.execute('''DELETE FROM early_text_refs WHERE id NOT IN (
        SELECT MIN(id) FROM early_text_refs
        GROUP BY book, chapter, verse, ref_book, ref_chapter, ref_verse, ref_type)''')
    expected['early_text_refs'] = db.execute('''SELECT COUNT(*) FROM (SELECT DISTINCT
        book, chapter, verse, ref_book, ref_chapter, ref_verse, ref_type FROM early_text_refs)''').fetchone()[0]

    # ── Views (legacy flat column set, so existing SQL keeps working) ───────
    view = '''CREATE VIEW {v} AS
        SELECT e.id, e.book, e.chapter, e.verse, e.father_name, e.father_era,
               e.father_era_order, e.excerpt, t.text AS full_text, e.source, e.source_url
        FROM {e} e JOIN {t} t ON t.id = e.text_id'''
    db.execute(view.format(v='commentary', e='commentary_entries', t='commentary_texts'))
    db.execute(view.format(v='aquinas_catena', e='aquinas_entries', t='aquinas_texts'))

    # ── Nave's Topical Bible (desktop-only) ─────────────────────────────────
    naves_ts = open(os.path.join(HERE, 'navesData.ts'), encoding='utf-8').read()
    unq = lambda s: s.replace("\\'", "'").replace('\\\\', '\\')
    topics = [(int(i), unq(n)) for i, n in re.findall(r"^\s*\[(\d+), '((?:[^'\\]|\\.)*)'\],?\s*$", naves_ts, re.M)]
    refs = [(int(t), unq(b), int(ch), int(v)) for t, b, ch, v in
            re.findall(r"^\s*\[(\d+), '((?:[^'\\]|\\.)*)', (\d+), (\d+)\],?\s*$", naves_ts, re.M)]
    db.executescript('''
        CREATE TABLE naves_topics (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE naves_refs (id INTEGER PRIMARY KEY, topic_id INTEGER NOT NULL,
            book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL);''')
    db.executemany('INSERT INTO naves_topics VALUES (?, ?)', topics)
    db.executemany('INSERT INTO naves_refs (topic_id, book, chapter, verse) VALUES (?, ?, ?, ?)', refs)
    expected['naves_topics'], expected['naves_refs'] = len(topics), len(refs)
    db.commit()

    # ── Indexes: Android source indexes + full-backup indexes + desktop extras
    idx = []
    for src in [core, full] + glob.glob(p('*.db')):
        s = sqlite3.connect(ro(src), uri=True)
        idx += [r[0] for r in s.execute("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")]
        s.close()
    idx += [
        'CREATE INDEX idx_commentary_father ON commentary_entries(father_name)',
        'CREATE INDEX idx_aquinas_loc ON aquinas_entries(book, chapter, verse)',
        'CREATE INDEX idx_naves_refs_bv ON naves_refs(book, chapter, verse)',
        'CREATE INDEX idx_naves_refs_topic_id ON naves_refs(topic_id)',
        'CREATE INDEX idx_wlc_bcv ON wlc_words(book, chapter, verse)',
        'CREATE INDEX idx_early_footnotes ON early_text_footnotes(book, chapter)',
    ]
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    seen = set()
    for sql in idx:
        m = re.match(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+"?(\w+)"?', sql.strip(), re.I)
        if not m or m.group(1) in seen:
            continue
        name, table = m.groups()
        if table == 'commentary':  # full backup's flat table is a VIEW here
            continue
        if table not in tables:
            continue
        seen.add(name)
        db.execute(re.sub(r'INDEX\s+' + name, 'INDEX IF NOT EXISTS ' + name, sql, count=1))
    db.commit()

    # ── Self-check ───────────────────────────────────────────────────────────
    bad = []
    for t, n in sorted(expected.items()):
        got = db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        print(f'  {t:28s} {got:>9,}' + ('' if got == n else f'   EXPECTED {n:,}'))
        if got != n:
            bad.append(t)
    for v, t in [('commentary', 'commentary_entries'), ('aquinas_catena', 'aquinas_entries')]:
        a = db.execute(f'SELECT COUNT(*) FROM {v}').fetchone()[0]
        b = db.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
        print(f'  {v:28s} {a:>9,} (view)')
        if a != b:
            bad.append(v)
    trans = dict(db.execute('SELECT translation, COUNT(*) FROM bible_translations GROUP BY 1'))
    print('  translations:', trans)
    for code in ['KJV+', 'I_KJV+', 'ASV', 'WEB', 'BSB', 'E_LXX', 'A_LXX']:
        if not trans.get(code):
            bad.append('translation ' + code)
    works = db.execute('SELECT COUNT(DISTINCT book) FROM early_texts').fetchone()[0]
    print('  early_texts works:', works)
    if works < 22:
        bad.append('early_texts works')
    if bad:
        db.close()
        sys.exit('SELF-CHECK FAILED: ' + ', '.join(bad))

    db.execute('ANALYZE')
    db.commit()
    db.execute('VACUUM')
    db.close()

    target = os.path.join(HERE, 'bible.db')
    if os.path.exists(target):
        bak = target + '.bak'
        if os.path.exists(bak):
            os.remove(bak)
        os.replace(target, bak)
    for side in ('-wal', '-shm'):
        if os.path.exists(target + side):
            os.remove(target + side)
    os.replace(out, target)
    print(f'OK  {target}  {os.path.getsize(target) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
