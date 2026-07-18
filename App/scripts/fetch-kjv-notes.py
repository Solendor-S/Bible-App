"""
Download KJV USFM from eBible.org and extract marginal notes (alternate renderings).
Outputs data/raw/kjv-footnotes.json:
  [{ book, chapter, verse, marker, word_index, content }, ...]
word_index = number of words in the clean verse text BEFORE this footnote marker (1-based after).
Run: npm run fetch-kjv-notes
"""

import json
import os
import re
import sys
import urllib.request
import zipfile
import io

URLS = [
    'https://ebible.org/Scriptures/engkjv_usfm.zip',
    'https://ebible.org/Scriptures/eng-kjv_usfm.zip',
    'https://ebible.org/Scriptures/engkjv2016_usfm.zip',
    'https://ebible.org/Scriptures/engkjv2006_usfm.zip',
]
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'kjv-footnotes.json')

BOOK_MAP = {
    'GEN': 'Genesis',       'EXO': 'Exodus',        'LEV': 'Leviticus',
    'NUM': 'Numbers',       'DEU': 'Deuteronomy',   'JOS': 'Joshua',
    'JDG': 'Judges',        'RUT': 'Ruth',           '1SA': '1 Samuel',
    '2SA': '2 Samuel',      '1KI': '1 Kings',        '2KI': '2 Kings',
    '1CH': '1 Chronicles',  '2CH': '2 Chronicles',  'EZR': 'Ezra',
    'NEH': 'Nehemiah',      'EST': 'Esther',         'JOB': 'Job',
    'PSA': 'Psalms',        'PRO': 'Proverbs',       'ECC': 'Ecclesiastes',
    'SNG': 'Song of Solomon','SON': 'Song of Solomon','SOL': 'Song of Solomon',
    'ISA': 'Isaiah',        'JER': 'Jeremiah',       'LAM': 'Lamentations',
    'EZK': 'Ezekiel',       'EZE': 'Ezekiel',        'DAN': 'Daniel',
    'HOS': 'Hosea',         'JOL': 'Joel',           'AMO': 'Amos',
    'OBA': 'Obadiah',       'JON': 'Jonah',          'MIC': 'Micah',
    'NAM': 'Nahum',         'HAB': 'Habakkuk',       'ZEP': 'Zephaniah',
    'HAG': 'Haggai',        'ZEC': 'Zechariah',      'MAL': 'Malachi',
    'MAT': 'Matthew',       'MRK': 'Mark',           'LUK': 'Luke',
    'JHN': 'John',          'ACT': 'Acts',           'ROM': 'Romans',
    '1CO': '1 Corinthians', '2CO': '2 Corinthians',  'GAL': 'Galatians',
    'EPH': 'Ephesians',     'PHP': 'Philippians',    'COL': 'Colossians',
    '1TH': '1 Thessalonians','2TH': '2 Thessalonians','1TI': '1 Timothy',
    '2TI': '2 Timothy',     'TIT': 'Titus',          'PHM': 'Philemon',
    'HEB': 'Hebrews',       'JAS': 'James',          '1PE': '1 Peter',
    '2PE': '2 Peter',       '1JN': '1 John',         '2JN': '2 John',
    '3JN': '3 John',        'JUD': 'Jude',           'REV': 'Revelation',
}


def extract_footnote_content(fn_body: str) -> str:
    """Clean a USFM footnote body into readable text."""
    text = fn_body.strip()
    # Remove calibration char (+ or -)
    text = re.sub(r'^[+\-]\s*', '', text)
    # Remove \fr reference like "1:1 " or "1.1 "
    text = re.sub(r'\\fr\s+[\d:.]+\s*', '', text)
    # Remove \fk keyword marker AND its content (it's just a label, not part of the note)
    text = re.sub(r'\\fk\s+[^\\]+', '', text)
    # Remove \ft, \fq, \fqa, \fqa, \fqb markers (keep their text content)
    text = re.sub(r'\\f[tqa]+a?\s*', '', text)
    # Remove any remaining USFM backslash markers and their closing *
    text = re.sub(r'\\[a-z]+\*', '', text)
    text = re.sub(r'\\[a-z]+\s', ' ', text)
    # Normalise whitespace
    return ' '.join(text.split()).strip()


def count_words(s: str) -> int:
    """Count whitespace-separated tokens in a string."""
    return len(s.split()) if s.strip() else 0


def parse_verse_usfm(raw: str) -> tuple[list[dict], str]:
    """
    Parse a raw USFM verse string (everything after the verse number).
    Returns (footnotes, clean_text) where:
      footnotes = [{marker, word_index, content}, ...]
      clean_text = verse text with all USFM markers stripped
    word_index = number of words BEFORE the footnote in the clean text (0 = before first word).
    """
    footnotes = []
    marker_ord = ord('a')
    word_count = 0
    clean_parts = []
    pos = 0

    while pos < len(raw):
        bs = raw.find('\\', pos)
        if bs == -1:
            seg = raw[pos:]
            word_count += count_words(seg)
            clean_parts.append(seg)
            break

        # Text before the next backslash marker
        seg = raw[pos:bs]
        word_count += count_words(seg)
        clean_parts.append(seg)
        pos = bs

        # Footnote or cross-reference span
        m = re.match(r'\\([fx])[\s+\-]', raw[pos:pos + 4])
        if m:
            tag = m.group(1)
            closing = f'\\{tag}*'
            end = raw.find(closing, pos + 2)
            if end == -1:
                # Malformed — skip the tag character
                pos += 1
                continue
            if tag == 'f':
                fn_body = raw[pos + 2:end]
                content = extract_footnote_content(fn_body)
                if content:
                    footnotes.append({
                        'marker': chr(marker_ord),
                        'word_index': word_count,
                        'content': content,
                    })
                    marker_ord += 1
            pos = end + len(closing)
            continue

        # Other inline marker — strip it, keep its text content
        m2 = re.match(r'\\([a-z0-9]+)\*', raw[pos:])
        if m2:
            # Closing marker (e.g. \add*) — just skip it
            pos += len(m2.group(0))
            continue
        m3 = re.match(r'\\([a-z0-9]+)\s', raw[pos:])
        if m3:
            # Opening marker (e.g. \add ) — skip just the tag+space
            pos += len(m3.group(0))
            continue
        # Unknown/structural — skip one char
        pos += 1

    clean_text = ' '.join(''.join(clean_parts).split())
    return footnotes, clean_text


def parse_usfm_file(content: str, book_name: str) -> list[dict]:
    """Parse a full USFM book file and return all footnote records."""
    records = []
    chapter = 0
    verse = 0

    # Split into lines and rejoin — verses can span multiple lines in USFM
    # Strategy: build a list of (type, content) tokens by scanning the whole text
    # for \c and \v markers.
    text = content.replace('\r\n', '\n').replace('\r', '\n')

    # Extract chapter blocks
    chapter_splits = re.split(r'\\c\s+(\d+)', text)
    # chapter_splits = [preamble, '1', ch1_text, '2', ch2_text, ...]
    i = 1
    while i + 1 < len(chapter_splits):
        chapter = int(chapter_splits[i])
        ch_text = chapter_splits[i + 1]
        i += 2

        # Extract verse blocks within this chapter
        verse_splits = re.split(r'\\v\s+(\d+)\s', ch_text)
        # verse_splits = [preamble, '1', v1_text, '2', v2_text, ...]
        j = 1
        while j + 1 < len(verse_splits):
            verse = int(verse_splits[j])
            v_raw = verse_splits[j + 1]
            j += 2

            # The verse text ends at the next structural paragraph marker on its own
            # (e.g. \p, \q, \b at line start) — but since we've already split on \v,
            # v_raw is just the text until the next \v split.  Strip trailing newlines.
            v_raw = v_raw.strip()

            footnotes, _clean = parse_verse_usfm(v_raw)
            for fn in footnotes:
                records.append({
                    'book': book_name,
                    'chapter': chapter,
                    'verse': verse,
                    'marker': fn['marker'],
                    'word_index': fn['word_index'],
                    'content': fn['content'],
                })

    return records


def main():
    # Support --file path/to/local.zip to skip download
    local_file = None
    if '--file' in sys.argv:
        idx = sys.argv.index('--file')
        if idx + 1 < len(sys.argv):
            local_file = sys.argv[idx + 1]

    if local_file:
        print(f'Reading local file: {local_file}')
        with open(local_file, 'rb') as f:
            data = f.read()
    else:
        data = None
        for url in URLS:
            print(f'Trying {url}...')
            try:
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/zip,application/octet-stream,*/*',
                    'Referer': 'https://ebible.org/',
                })
                with urllib.request.urlopen(req, timeout=120) as resp:
                    data = resp.read()
                print(f'Downloaded {len(data):,} bytes.')
                break
            except Exception as e:
                print(f'  Failed: {e}')

        if data is None:
            print('\nAll URLs failed. Manual download steps:', file=sys.stderr)
            print('  1. Go to https://ebible.org/find/show.php?id=engkjv', file=sys.stderr)
            print('  2. Download the USFM zip', file=sys.stderr)
            print('  3. Run: npm run fetch-kjv-notes -- --file path\\to\\downloaded.zip', file=sys.stderr)
            sys.exit(1)

    print(f'Downloaded {len(data):,} bytes. Parsing...')

    all_records: list[dict] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = zf.namelist()
        usfm_files = [n for n in names if n.endswith('.usfm') or n.endswith('.SFM')]
        print(f'Found {len(usfm_files)} USFM files in archive.')

        for name in sorted(usfm_files):
            raw = zf.read(name).decode('utf-8', errors='replace')

            # Use \id tag inside the file — more reliable than filename matching
            id_match = re.search(r'\\id\s+([A-Z0-9]+)', raw)
            book_name = None
            if id_match:
                book_name = BOOK_MAP.get(id_match.group(1))
            if not book_name:
                # Fallback: scan filename for known codes (exact word match only)
                basename = os.path.basename(name).upper().replace('.USFM', '').replace('.SFM', '')
                for code in BOOK_MAP:
                    if re.search(rf'(^|[^A-Z]){re.escape(code)}($|[^A-Z])', basename):
                        book_name = BOOK_MAP[code]
                        break
            if not book_name:
                continue
            records = parse_usfm_file(raw, book_name)
            all_records.extend(records)
            if records:
                print(f'  {book_name}: {len(records)} footnotes')

    print(f'\nTotal footnotes: {len(all_records):,}')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    print(f'Written to {OUT_PATH}')


if __name__ == '__main__':
    main()
