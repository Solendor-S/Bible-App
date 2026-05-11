"""
Scrapes verse notes, chapter summaries, and pericope groupings from bibleref.com.
Outputs to data/raw/bibleref-verses.json and data/raw/bibleref-chapters.json.

Usage:
  python scrape-bibleref.py               # scrape all books
  python scrape-bibleref.py --book Genesis # single book for testing (~25 min)
  python scrape-bibleref.py --resume       # skip already-scraped verses

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

try:
    from scrapling import Fetcher
except ImportError:
    print(f"ERROR: scrapling not found. Run with: {PYTHON_EXE} scrape-bibleref.py")
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR.parent / "data" / "raw"
PROGRESS_FILE = RAW_DIR / "bibleref-progress.json"
VERSES_OUT = RAW_DIR / "bibleref-verses.json"
CHAPTERS_OUT = RAW_DIR / "bibleref-chapters.json"
KJV_JSON = RAW_DIR / "kjv.json"

BASE_URL = "https://www.bibleref.com"
SUMMARIES_URL = f"{BASE_URL}/summaries"
DELAY = 0.5  # seconds between requests


# ── Book name → URL slug ──────────────────────────────────────────────────────
def book_to_slug(book: str) -> str:
    return book.replace(' ', '-')


# ── HTML / JS extraction helpers ──────────────────────────────────────────────
def strip_tags(html: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_docwrite(js: str) -> tuple[str, str]:
    """Return (title, body_text) from a bibleref summary JS file.
    Tries document.write(), innerHTML=, and raw HTML content as fallbacks.
    """
    html = ''

    # Pattern 1: document.write('...')
    m = re.search(r"document\.write\('(.*?)'\s*\)", js, re.DOTALL)
    if m:
        html = m.group(1).replace("\\'", "'").replace('\\n', '\n')

    # Pattern 2: document.write("...")
    if not html:
        m = re.search(r'document\.write\("(.*?)"\s*\)', js, re.DOTALL)
        if m:
            html = m.group(1).replace('\\"', '"').replace('\\n', '\n')

    # Pattern 3: .innerHTML = '...' or .innerHTML = "..."
    if not html:
        m = re.search(r'\.innerHTML\s*=\s*["\'](.+?)["\'];', js, re.DOTALL)
        if m:
            raw = m.group(1)
            html = raw.replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n')

    # Pattern 4: any block of HTML inside the JS (contains <p> tags)
    if not html:
        m = re.search(r'(<(?:center|p|div)[^>]*>.*?</(?:center|p|div)>)', js, re.DOTALL | re.IGNORECASE)
        if m:
            html = m.group(1)

    if not html:
        return '', ''

    title_m = re.search(r'<b>(.*?)</b>', html, re.DOTALL | re.IGNORECASE)
    title = strip_tags(title_m.group(1)).strip() if title_m else ''

    # Strip only the heading tags, not the surrounding <center> (body lives inside it)
    body_html = re.sub(r'<b>.*?</b>', '', html, flags=re.DOTALL | re.IGNORECASE)
    body_html = re.sub(r'</?center>', '', body_html, flags=re.IGNORECASE)
    body_html = re.sub(r'^\s*<br\s*/?>\s*', '', body_html.strip(), flags=re.IGNORECASE)
    body = strip_tags(body_html).strip()

    return title, body


def fetch_raw(url: str) -> str:
    """Fetch raw text content via urllib (bypasses Scrapling HTML parsing for .js files)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  WARN {url}: {e}")
        return ''


def fetch_js(url: str) -> tuple[str, str]:
    """Fetch a bibleref summary .js file; return (title, body_text)."""
    raw = fetch_raw(url)
    if not raw:
        return '', ''
    title, body = parse_docwrite(raw)
    if 'coming soon' in body.lower() or 'coming soon' in title.lower():
        return '', ''
    return title, body


# ── Verse page parsing ────────────────────────────────────────────────────────
def parse_verse_page(page) -> dict:
    """Extract verse note and pericope JS URL from a verse HTML page."""
    note = ''
    pericope_js_url = None

    commentary_el = page.find('.content-commentary')
    if commentary_el:
        html = str(commentary_el.html_content)
        html = re.sub(r'<h1>.*?</h1>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<svg[^>]*>.*?</svg>', '', html, flags=re.DOTALL | re.IGNORECASE)
        note = strip_tags(html).strip()
        if 'coming soon' in note.lower():
            note = ''

    # Find pericope JS: bibleref uses absolute URLs in script src
    full_html = str(page.html_content)
    m = re.search(
        r'src=["\'](' + re.escape(BASE_URL) + r'/summaries/[A-Za-z0-9\-]+-\d+-\d+thru\d+-\d+-context\.js)["\']',
        full_html
    )
    if m:
        pericope_js_url = m.group(1)

    return {'note': note, 'pericope_js_url': pericope_js_url}


def parse_pericope_url_range(url: str) -> tuple[int, int] | None:
    """
    Extract (verse_start, verse_end) from URL like:
    .../Genesis-1-1thru1-13-context.js  → (1, 13)
    .../Genesis-49-28thru50-21-context.js → (28, 21)
    """
    m = re.search(r'-(\d+)-(\d+)thru\d+-(\d+)-context\.js$', url)
    if m:
        return int(m.group(2)), int(m.group(3))
    return None


# ── Progress tracking ─────────────────────────────────────────────────────────
def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding='utf-8'))
    return {'done': []}


def save_progress(p: dict):
    PROGRESS_FILE.write_text(json.dumps(p), encoding='utf-8')


def load_existing_verses() -> dict:
    if VERSES_OUT.exists():
        data = json.loads(VERSES_OUT.read_text(encoding='utf-8'))
        return {f"{e['book']}:{e['chapter']}:{e['verse']}": e for e in data}
    return {}


def load_existing_chapters() -> dict:
    if CHAPTERS_OUT.exists():
        data = json.loads(CHAPTERS_OUT.read_text(encoding='utf-8'))
        return {f"{e['book']}:{e['chapter']}": e for e in data}
    return {}


def save_verses(d: dict):
    VERSES_OUT.write_text(
        json.dumps(list(d.values()), indent=2, ensure_ascii=False), encoding='utf-8'
    )


def save_chapters(d: dict):
    CHAPTERS_OUT.write_text(
        json.dumps(list(d.values()), indent=2, ensure_ascii=False), encoding='utf-8'
    )


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', help='Scrape only this book (e.g. Genesis)')
    parser.add_argument('--resume', action='store_true', help='Skip already-scraped verses')
    args = parser.parse_args()

    if not KJV_JSON.exists():
        print(f"ERROR: {KJV_JSON} not found — run build-db first to generate it.")
        sys.exit(1)

    all_verses = json.loads(KJV_JSON.read_text(encoding='utf-8'))
    if args.book:
        all_verses = [v for v in all_verses if v['book'] == args.book]
        print(f"Filtered to {args.book}: {len(all_verses)} verses")

    progress = load_progress()
    done_set = set(progress.get('done', []))
    verse_entries = load_existing_verses() if args.resume else {}
    chapter_entries = load_existing_chapters() if args.resume else {}
    # Cache pericope JS fetches so each unique pericope is fetched only once
    pericope_cache: dict[str, dict] = {}

    fetcher = Fetcher()
    total = len(all_verses)

    print(f"\nTotal verses: {total} | Already done: {len(done_set)} | Resume: {args.resume}\n")

    for i, v in enumerate(all_verses, 1):
        book, chapter, verse = v['book'], v['chapter'], v['verse']
        verse_key = f"{book}:{chapter}:{verse}"
        chapter_key = f"{book}:{chapter}"

        if args.resume and verse_key in done_set:
            continue

        slug = book_to_slug(book)
        verse_url = f"{BASE_URL}/{slug}/{chapter}/{slug}-{chapter}-{verse}.html"

        print(f"  [{i}/{total}] {book} {chapter}:{verse}", end=' ', flush=True)

        try:
            page = fetcher.get(verse_url)
            parsed = parse_verse_page(page)
        except Exception as e:
            print(f"ERROR: {e}")
            done_set.add(verse_key)
            time.sleep(DELAY)
            continue

        note = parsed['note']
        pericope_js_url = parsed['pericope_js_url']
        entry = {
            'book': book, 'chapter': chapter, 'verse': verse,
            'note': note,
            'pericope_title': None,
            'pericope_verse_start': None,
            'pericope_verse_end': None,
            'pericope_desc': None,
        }

        if pericope_js_url:
            if pericope_js_url not in pericope_cache:
                p_title, p_desc = fetch_js(pericope_js_url)
                v_range = parse_pericope_url_range(pericope_js_url)
                pericope_cache[pericope_js_url] = {
                    'title': p_title,
                    'verse_start': v_range[0] if v_range else None,
                    'verse_end': v_range[1] if v_range else None,
                    'desc': p_desc,
                }
            p = pericope_cache[pericope_js_url]
            entry['pericope_title'] = p['title']
            entry['pericope_verse_start'] = p['verse_start']
            entry['pericope_verse_end'] = p['verse_end']
            entry['pericope_desc'] = p['desc']

        verse_entries[verse_key] = entry
        print(f"| note:{len(note)}ch pericope:{bool(pericope_js_url)}", end=' ', flush=True)

        if chapter_key not in chapter_entries:
            chapter_js_url = f"{SUMMARIES_URL}/{slug}-{chapter}-context.js"
            raw_js = fetch_raw(chapter_js_url)
            if raw_js and len(chapter_entries) == 0:
                print(f"\n  [DEBUG chapter JS sample] {repr(raw_js[:300])}\n")
            _, summary = parse_docwrite(raw_js) if raw_js else ('', '')
            chapter_entries[chapter_key] = {'book': book, 'chapter': chapter, 'summary': summary}
            print(f"| chap:{len(summary)}ch", end=' ', flush=True)

        print()
        done_set.add(verse_key)

        if i % 100 == 0:
            progress['done'] = list(done_set)
            save_progress(progress)
            save_verses(verse_entries)
            save_chapters(chapter_entries)
            print(f"\n  >> Checkpoint: {len(verse_entries)} verses, {len(chapter_entries)} chapters\n")

        time.sleep(DELAY)

    progress['done'] = list(done_set)
    save_progress(progress)
    save_verses(verse_entries)
    save_chapters(chapter_entries)
    print(f"\nDone! {len(verse_entries)} verse entries, {len(chapter_entries)} chapter entries")


if __name__ == '__main__':
    main()
