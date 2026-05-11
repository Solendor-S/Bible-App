"""
Scrapes Thayer's Greek Lexicon (G1-G5624) and BDB Hebrew Lexicon (H1-H8674)
from Blue Letter Bible. Outputs to data/raw/thayers-greek.json and bdb-hebrew.json.

Usage:
  python scrape-blb-lexicons.py              # scrape both
  python scrape-blb-lexicons.py --greek      # Greek only
  python scrape-blb-lexicons.py --hebrew     # Hebrew only
  python scrape-blb-lexicons.py --resume     # skip already-scraped entries

Run from App/scripts/ or App/ directory.
"""

import sys
import json
import time
import re
import argparse
from pathlib import Path

PYTHON_EXE = r"C:\Users\Sargo\AppData\Local\Python\pythoncore-3.14-64\python.exe"

try:
    from scrapling import Fetcher
except ImportError:
    print(f"ERROR: scrapling not found. Run with: {PYTHON_EXE} scrape-blb-lexicons.py")
    sys.exit(1)

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR.parent / "data" / "raw"
PROGRESS_FILE = RAW_DIR / "blb-scrape-progress.json"
GREEK_OUT = RAW_DIR / "thayers-greek.json"
HEBREW_OUT = RAW_DIR / "bdb-hebrew.json"

DELAY = 0.8  # seconds between requests (polite rate)

GREEK_MAX = 5624
HEBREW_MAX = 8674


# ── HTML extraction helpers ───────────────────────────────────────────────────

def strip_tags(html: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_text(element) -> str:
    if element is None:
        return ''
    return strip_tags(str(element.html_content))


def extract_field(page, selector: str) -> str:
    el = page.find(selector)
    return extract_text(el) if el else ''


def extract_outline(page) -> str:
    el = page.find('#outlineBiblical')
    if not el:
        return ''
    # Preserve list structure as numbered text
    html = str(el.html_content)
    # Convert <li> to numbered items
    text = re.sub(r'<li[^>]*>', '\n• ', html, flags=re.IGNORECASE)
    return strip_tags(text).strip()


def extract_thayers(page) -> str:
    el = page.find('#lexyText')
    if not el:
        return ''
    html = str(el.html_content)
    # Remove the scripture index section (not part of definition text)
    html = re.sub(r'<h3>BLB Scripture Index.*', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove license block
    html = re.sub(r'<div class="thayer-license">.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
    return strip_tags(html).strip()


def extract_kjv_translations(page) -> str:
    el = page.find('#lexCount')
    if not el:
        # Try mobile version
        el = page.find('.lexicon-count')
    return extract_text(el) if el else ''


def extract_strongs_def(page) -> str:
    el = page.find('.lexStrongsDef')
    return extract_text(el) if el else ''


# ── Single entry scraper ──────────────────────────────────────────────────────

def scrape_entry(fetcher: Fetcher, lang: str, number: int) -> dict | None:
    code = f"{'G' if lang == 'greek' else 'H'}{number}"
    if lang == 'greek':
        url = f"https://www.blueletterbible.org/lexicon/g{number}/kjv/tr/0-1/"
    else:
        url = f"https://www.blueletterbible.org/lexicon/h{number}/kjv/wlc/0-1/"

    try:
        page = fetcher.get(url)
    except Exception as e:
        print(f"  ERROR fetching {code}: {e}")
        return None

    # Check for valid lexicon page (missing entries return page without #lexTitle)
    title_el = page.find('#lexTitle')
    if not title_el:
        return None  # Entry doesn't exist (gap in Strong's numbering)

    lemma_el = page.find('#lexTitle h6')
    lemma = extract_text(lemma_el) if lemma_el else ''

    # Skip empty / redirect pages
    if not lemma:
        return None

    return {
        'number': code,
        'lemma': lemma,
        'translit': extract_field(page, '#lexTrans em'),
        'pronunciation': extract_field(page, '#lexPro .lexicon-pronunc').split('\n')[0].strip(),
        'part_of_speech': extract_field(page, '#lexPart .small-text-right'),
        'strongs_def': extract_strongs_def(page),
        'outline': extract_outline(page),
        'thayers_text': extract_thayers(page),
        'kjv_translations': extract_kjv_translations(page),
    }


# ── Progress tracking ─────────────────────────────────────────────────────────

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding='utf-8'))
    return {'greek_done': [], 'hebrew_done': []}


def save_progress(progress: dict):
    PROGRESS_FILE.write_text(json.dumps(progress), encoding='utf-8')


def load_existing(path: Path) -> dict:
    if path.exists():
        data = json.loads(path.read_text(encoding='utf-8'))
        return {e['number']: e for e in data}
    return {}


def save_results(path: Path, entries: dict):
    path.write_text(
        json.dumps(list(entries.values()), indent=2, ensure_ascii=False),
        encoding='utf-8'
    )


# ── Main scrape loop ──────────────────────────────────────────────────────────

def scrape_language(lang: str, max_num: int, resume: bool):
    key = f"{lang}_done"
    progress = load_progress()
    done_set = set(progress.get(key, []))

    out_path = GREEK_OUT if lang == 'greek' else HEBREW_OUT
    entries = load_existing(out_path) if resume else {}

    prefix = 'G' if lang == 'greek' else 'H'
    label = "Thayer's Greek" if lang == 'greek' else 'BDB Hebrew'

    fetcher = Fetcher()

    print(f"\n{'='*60}")
    print(f"Scraping {label} Lexicon ({prefix}1 – {prefix}{max_num})")
    print(f"Already done: {len(done_set)} | Resuming: {resume}")
    print(f"Output: {out_path}")
    print(f"{'='*60}\n")

    for n in range(1, max_num + 1):
        code = f"{prefix}{n}"

        if resume and code in done_set:
            continue

        entry = scrape_entry(fetcher, lang, n)

        if entry:
            entries[code] = entry
            done_set.add(code)
            thayers_len = len(entry.get('thayers_text', ''))
            print(f"  [{n}/{max_num}] {code} {entry['lemma'][:20]:<20} Thayer's: {thayers_len} chars")
        else:
            done_set.add(code)  # Mark as done even if empty (gap in numbering)
            print(f"  [{n}/{max_num}] {code} — no entry (gap)")

        # Save progress every 50 entries
        if n % 50 == 0:
            progress[key] = list(done_set)
            save_progress(progress)
            save_results(out_path, entries)
            print(f"  >> Checkpoint saved ({len(entries)} entries)")

        time.sleep(DELAY)

    # Final save
    progress[key] = list(done_set)
    save_progress(progress)
    save_results(out_path, entries)
    print(f"\nDone! {len(entries)} entries saved to {out_path}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--greek', action='store_true')
    parser.add_argument('--hebrew', action='store_true')
    parser.add_argument('--resume', action='store_true', help='Skip already-scraped entries')
    args = parser.parse_args()

    do_greek = args.greek or (not args.greek and not args.hebrew)
    do_hebrew = args.hebrew or (not args.greek and not args.hebrew)

    if do_greek:
        scrape_language('greek', GREEK_MAX, args.resume)
    if do_hebrew:
        scrape_language('hebrew', HEBREW_MAX, args.resume)
