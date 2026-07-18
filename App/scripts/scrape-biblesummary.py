"""
Scrapes short chapter summaries (~140 chars) from biblesummary.info.
Outputs to data/raw/biblesummary-chapters.json.

Usage:
  python scrape-biblesummary.py               # scrape all books
  python scrape-biblesummary.py --book Genesis # single book for testing
  python scrape-biblesummary.py --resume       # skip already-scraped chapters

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
PROGRESS_FILE = RAW_DIR / "biblesummary-progress.json"
OUT_FILE = RAW_DIR / "biblesummary-chapters.json"
KJV_JSON = RAW_DIR / "kjv.json"

BASE_URL = "https://biblesummary.info"
DELAY = 0.5


def book_to_slug(book: str) -> str:
    return book.lower().replace(' ', '-')


def fetch(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  WARN {url}: {e}")
        return ''


def extract_summary(html: str) -> str:
    # Find the "summarised in 140 characters" heading
    marker = re.search(r'summarised in 140 characters', html, re.IGNORECASE)
    if not marker:
        # Fallback: try first <p> in main content
        m = re.search(r'<main[^>]*>.*?<p[^>]*>(.*?)</p>', html, re.DOTALL | re.IGNORECASE)
        if m:
            return re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return ''

    # Get the first <p> after that heading
    after = html[marker.end():]
    m = re.search(r'<p[^>]*>(.*?)</p>', after, re.DOTALL | re.IGNORECASE)
    if not m:
        return ''

    text = re.sub(r'<[^>]+>', '', m.group(1))
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#(\d+);', lambda x: chr(int(x.group(1))), text)
    return text.strip()


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
        url = f"{BASE_URL}/{slug}/{chapter}"

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

        if i % 100 == 0:
            save_progress(done)
            save_output(entries)
            print(f"  [checkpoint {i}/{total}]")

        time.sleep(DELAY)

    save_progress(done)
    save_output(entries)
    print(f"\nDone! {len(entries)} chapters saved to {OUT_FILE}")


if __name__ == '__main__':
    main()
