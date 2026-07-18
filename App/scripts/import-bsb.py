"""
Imports the Berean Standard Bible (BSB) into bible_translations from the
BibleAndroidApp per-verse tree at Patristica/data/online/bsb/<Book>/<ch>.json.

The source text marks translator-supplied words with [square brackets] (BSB's
convention) but also carries leftover scrape junk (HTML tags like <p class=|list2|>,
empty {} braces, and ". . ." runs standing in for untranslated original words).
We strip the junk and convert [..] -> {..} so the app renders those words italic
via renderWithItalics (the same convention KJV translator-added words use).

Usage:  python scripts/import-bsb.py
Re-runnable (replaces BSB rows). No full build-db needed.
"""

import sqlite3, json, glob, os, re

HERE = os.path.dirname(__file__)
TREE = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'BibleAndroidApp',
                                     'Patristica', 'data', 'online', 'bsb'))
DB   = os.path.normpath(os.path.join(HERE, '..', 'data', 'bible.db'))

# Tree uses "Psalm"; the app's canonical book name is "Psalms".
BOOK_FIX = {'Psalm': 'Psalms'}

_TAG      = re.compile(r'<[^>]*>')          # HTML tags: <p class=|list2|>, </span>, <b>…
_ELLIPSIS = re.compile(r'\.(?:\s+\.){1,}')  # ". . ." runs = omitted original words
_SP_PUNCT = re.compile(r'\s+([,;:.!?])')    # space before punctuation
_MULTISP  = re.compile(r'\s{2,}')


def clean(text: str) -> str:
    t = _TAG.sub('', text)
    t = t.replace('{', '').replace('}', '')   # drop pre-existing junk braces first
    t = _ELLIPSIS.sub('', t)
    t = t.replace('[', '{').replace(']', '}')  # translator additions -> italic markers
    t = _SP_PUNCT.sub(r'\1', t)
    return _MULTISP.sub(' ', t).strip()


def _selfcheck():
    assert clean('Enoch, Methuselah, Lamech, [Noah].') == 'Enoch, Methuselah, Lamech, {Noah}.'
    assert clean('These [are] the kings . . .: Bela son') == 'These {are} the kings: Bela son'
    assert clean('The sons of Shem: Aram. <p class=|list2|>[The sons of Aram:] Uz') \
        == 'The sons of Shem: Aram. {The sons of Aram:} Uz'
    assert clean('50,000 {} . . . camels, 250,000 sheep') == '50,000 camels, 250,000 sheep'
    assert clean('Then Hadad . . . died. Now the chiefs') == 'Then Hadad died. Now the chiefs'


if __name__ == '__main__':
    _selfcheck()
    assert os.path.isdir(TREE), f"BSB tree not found: {TREE}"

    rows = []
    for book_dir in sorted(glob.glob(os.path.join(TREE, '*'))):
        book = os.path.basename(book_dir)
        book = BOOK_FIX.get(book, book)
        for fp in glob.glob(os.path.join(book_dir, '*.json')):
            chapter = int(os.path.splitext(os.path.basename(fp))[0])
            for r in json.load(open(fp, encoding='utf-8')):
                rows.append(('BSB', book, chapter, r['verse'], clean(r['text'])))

    db = sqlite3.connect(DB)
    c = db.cursor()
    c.execute("DELETE FROM bible_translations WHERE translation = 'BSB'")
    c.executemany("INSERT INTO bible_translations (translation, book, chapter, verse, text) VALUES (?,?,?,?,?)", rows)
    db.commit()
    n = c.execute("SELECT COUNT(*) FROM bible_translations WHERE translation='BSB'").fetchone()[0]
    b = c.execute("SELECT COUNT(DISTINCT book) FROM bible_translations WHERE translation='BSB'").fetchone()[0]
    ital = c.execute("SELECT COUNT(*) FROM bible_translations WHERE translation='BSB' AND text LIKE '%{%'").fetchone()[0]
    print(f"BSB: {n} verses across {b} books; {ital} with translator-italic words")
    db.close()
