"""
Scrapes chapter summaries from biblehub.com.
Outputs to data/raw/biblehub-chapters.json.

Usage:
  python scrape-biblehub.py               # scrape all books
  python scrape-biblehub.py --book Genesis # single book for testing
  python scrape-biblehub.py --resume       # skip already-scraped chapters

Run from App/ or App/scripts/ directory.
"""

import sys
import json
import time
import re
import argparse
import urllib.request
from pathlib import Path

PYTHON_EXE = r"C:\Users\Sargo\AppData\Local\Python\pythoncore-3.14-64\python.exe"
SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR.parent / "data" / "raw"
PROGRESS_FILE = RAW_DIR / "biblehub-chapters-progress.json"
OUT_FILE = RAW_DIR / "biblehub-chapters.json"
KJV_JSON = RAW_DIR / "kjv.json"

BASE_URL = "https://biblehub.com"
DELAY = 1.0

# Books where slug differs from simple lowercasing
BIBLEHUB_SLUGS = {
    'Song of Solomon': 'songs',
    '1 Samuel': '1_samuel',
    '2 Samuel': '2_samuel',
    '1 Kings': '1_kings',
    '2 Kings': '2_kings',
    '1 Chronicles': '1_chronicles',
    '2 Chronicles': '2_chronicles',
    '1 Corinthians': '1_corinthians',
    '2 Corinthians': '2_corinthians',
    '1 Thessalonians': '1_thessalonians',
    '2 Thessalonians': '2_thessalonians',
    '1 Timothy': '1_timothy',
    '2 Timothy': '2_timothy',
    '1 Peter': '1_peter',
    '2 Peter': '2_peter',
    '1 John': '1_john',
    '2 John': '2_john',
    '3 John': '3_john',
}


def book_to_slug(book: str) -> str:
    return BIBLEHUB_SLUGS.get(book, book.lower().replace(' ', '_'))


def strip_tags(html: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
    text = re.sub(r'&[a-z]+;', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def fetch(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  WARN {url}: {e}")
        return ''


def extract_summary(html: str) -> str:
    # Find the summary section anchor
    start = html.find('name="summary"')
    if start == -1:
        return ''

    # End at the people/places/teaching section
    end = len(html)
    for marker in ['name="people"', 'name="teaching"', 'name="facts"']:
        pos = html.find(marker, start)
        if pos != -1 and pos < end:
            end = pos

    block = html[start:end]

    # Remove topical links
    block = re.sub(
        r'<a\s+href=["\'][^"\']*\/topical\/[^"\']*["\'][^>]*>.*?</a>',
        '', block, flags=re.DOTALL | re.IGNORECASE
    )
    # Promote hdglist headings with clear newline separation
    block = re.sub(
        r'<span[^>]*class="hdglist"[^>]*><b>(.*?)</b></span>',
        lambda m: '\n\n' + strip_tags(m.group(1)).strip() + '\n',
        block, flags=re.DOTALL | re.IGNORECASE
    )
    # Newline before essay subheadings marked with <b>
    block = re.sub(r'<b>', '\n', block, flags=re.IGNORECASE)
    block = re.sub(r'</b>', ' ', block, flags=re.IGNORECASE)

    # Convert to plain text
    text = strip_tags(block)

    # Cut before BSB verse text block
    m = re.search(r'Berean Standard Bible', text)
    if m:
        text = text[:m.start()]

    # Drop leading lines that are anchor remnants, navigation, or empty
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or 'Berean Standard Bible' in line or line.startswith('name=') or line.startswith('>'):
            i += 1
        else:
            break
    text = '\n'.join(lines[i:]).strip()

    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def load_progress() -> set:
    if PROGRESS_FILE.exists():
        return set(json.loads(PROGRESS_FILE.read_text(encoding='utf-8')).get('done', []))
    return set()


def save_progress(done: set):
    PROGRESS_FILE.write_text(json.dumps({'done': list(done)}), encoding='utf-8')


def load_existing() -> dict:
    if OUT_FILE.exists():
        data = json.loads(OUT_FILE.read_text(encoding='utf-8'))
        return {f"{e['book']}:{e['chapter']}": e for e in data}
    return {}


def save_output(entries: dict):
    OUT_FILE.write_text(
        json.dumps(list(entries.values()), indent=2, ensure_ascii=False),
        encoding='utf-8'
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', help='Scrape only this book')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()

    if not KJV_JSON.exists():
        print(f"ERROR: {KJV_JSON} not found — run build-db first.")
        sys.exit(1)

    all_verses = json.loads(KJV_JSON.read_text(encoding='utf-8'))

    # Deduplicate to unique chapters
    seen = set()
    chapters = []
    for v in all_verses:
        key = f"{v['book']}:{v['chapter']}"
        if key not in seen:
            seen.add(key)
            chapters.append({'book': v['book'], 'chapter': v['chapter']})

    if args.book:
        chapters = [c for c in chapters if c['book'] == args.book]
        print(f"Filtered to {args.book}: {len(chapters)} chapters")

    done = load_progress()
    entries = load_existing() if args.resume else {}
    total = len(chapters)

    print(f"\nTotal chapters: {total} | Already done: {len(done)} | Resume: {args.resume}\n")

    for i, c in enumerate(chapters, 1):
        book, chapter = c['book'], c['chapter']
        key = f"{book}:{chapter}"

        if args.resume and key in done:
            continue

        slug = book_to_slug(book)
        url = f"{BASE_URL}/{slug}/{chapter}.htm"

        print(f"  [{i}/{total}] {book} {chapter}", end=' ', flush=True)

        html = fetch(url)
        if not html:
            print("SKIP (fetch failed)")
            done.add(key)
            time.sleep(DELAY)
            continue

        summary = extract_summary(html)
        entries[key] = {'book': book, 'chapter': chapter, 'summary': summary}
        print(f"| {len(summary)}ch")

        done.add(key)

        if i % 50 == 0:
            save_progress(done)
            save_output(entries)
            print(f"  [checkpoint {i}/{total}]")

        time.sleep(DELAY)

    save_progress(done)
    save_output(entries)
    print(f"\nDone! {len(entries)} chapters saved to {OUT_FILE}")


if __name__ == '__main__':
    main()
