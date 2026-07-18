"""
Test script: splits biblehub-chapters.json into passage entries + chapter essay.
Reads: data/raw/biblehub-chapters.json
Writes: data/raw/biblehub-chapters-split-test.json  (does NOT touch the original)

Each output entry:
  { book, chapter, passages: [{verse_start, verse_end, heading, text}], essay: str }
"""

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR.parent / "data" / "raw"
IN_FILE = RAW_DIR / "biblehub-chapters.json"
OUT_FILE = RAW_DIR / "biblehub-chapters-split-test.json"


def parse_verse_range(line: str):
    """Extract (verse_start, verse_end) from a heading line like 'Verses 3–5 – Day One'."""
    # Match "Verses X–Y" with en-dash, em-dash, or hyphen; space between Verses and number is optional
    m = re.match(r'Verses?\s*(\d+)\s*[–—-]\s*(\d+)', line)
    if m:
        return int(m.group(1)), int(m.group(2))
    # Single verse
    m = re.match(r'Verses?\s*(\d+)', line)
    if m:
        return int(m.group(1)), int(m.group(1))
    return None, None


def parse_heading(line: str) -> str:
    """Extract the title portion after 'Verses X–Y –'."""
    m = re.match(r'Verses?\s*\d+\s*[–—-]\s*\d*\s*[–—]\s*(.+)', line)
    if m:
        return m.group(1).strip()
    m = re.match(r'Verses?\s*\d+\s*[–—-]?\s*\d*\s*[–—]?\s*(.*)', line)
    if m:
        return m.group(1).strip()
    return line.strip()


def split_summary(summary: str):
    paragraphs = [p.strip() for p in summary.split('\n\n') if p.strip()]
    passages = []
    essay_paras = []
    seen_verses = False
    i = 0

    while i < len(paragraphs):
        para = paragraphs[i]
        first_line = para.split('\n')[0].strip()
        is_verse = bool(re.match(r'Verses?\s*\d+', first_line))

        if is_verse:
            seen_verses = True
            vs, ve = parse_verse_range(first_line)
            heading = parse_heading(first_line)
            # Body may be inline (same block after first line) or the next paragraph
            inline_body = '\n'.join(para.split('\n')[1:]).strip()
            body = inline_body
            if not body and i + 1 < len(paragraphs):
                nxt = paragraphs[i + 1]
                if not re.match(r'Verses?\s+\d+', nxt.split('\n')[0].strip()):
                    body = nxt
                    i += 1  # consume the body paragraph
            passages.append({
                'verse_start': vs,
                'verse_end': ve if ve is not None else vs,
                'heading': heading,
                'text': body,
            })
        else:
            if seen_verses:
                # First non-verse paragraph after passage section = essay starts here
                essay_paras = paragraphs[i:]
                break
            else:
                essay_paras.append(para)

        i += 1

    # The thematic essay is concatenated directly onto the last passage body (no \n\n separator
    # because <p> tags get stripped without adding paragraph breaks). Detect the boundary:
    # a period immediately followed by a capital letter (no space) signals the join point.
    if passages:
        last_text = passages[-1]['text']
        # Only attempt split if the body is long enough to contain an embedded essay
        if len(last_text) > 300:
            m = re.search(r'(?<!["\'])\.[A-Z]', last_text)
            if m:
                split_pos = m.start() + 1  # include the period in the passage body
                passages[-1]['text'] = last_text[:split_pos].strip()
                essay_remainder = last_text[split_pos:].strip()
                if essay_remainder:
                    essay_paras = [essay_remainder]

    return passages, '\n\n'.join(essay_paras)


def main():
    if not IN_FILE.exists():
        print(f"ERROR: {IN_FILE} not found")
        return

    data = json.loads(IN_FILE.read_text(encoding='utf-8'))
    results = []

    for entry in data:
        passages, essay = split_summary(entry['summary'])
        results.append({
            'book': entry['book'],
            'chapter': entry['chapter'],
            'passages': passages,
            'essay': essay,
        })

    OUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')

    # Stats
    no_passages = [r for r in results if not r['passages']]
    no_essay = [r for r in results if not r['essay']]
    passage_counts = [len(r['passages']) for r in results]
    avg_passages = sum(passage_counts) / len(passage_counts)

    print(f"Total entries:    {len(results)}")
    print(f"No passages:      {len(no_passages)}")
    print(f"No essay:         {len(no_essay)}")
    print(f"Avg passages/ch:  {avg_passages:.1f}")

    if no_passages:
        print(f"\nEntries with no passages (first 10):")
        for r in no_passages[:10]:
            print(f"  {r['book']} {r['chapter']}")

    # Sample: Genesis 1
    g1 = next(r for r in results if r['book'] == 'Genesis' and r['chapter'] == 1)
    print(f"\n--- Genesis 1: {len(g1['passages'])} passages ---")
    for p in g1['passages']:
        print(f"  {p['verse_start']:2}-{p['verse_end']:2}  {p['heading'][:50]}")
    print(f"\nEssay preview (first 200 chars):\n{g1['essay'][:200]}")

    # Sample: a mid-book chapter
    rev22 = next((r for r in results if r['book'] == 'Revelation' and r['chapter'] == 22), None)
    if rev22:
        print(f"\n--- Revelation 22: {len(rev22['passages'])} passages ---")
        for p in rev22['passages']:
            print(f"  {p['verse_start']:2}-{p['verse_end']:2}  {p['heading'][:50]}")


if __name__ == '__main__':
    main()
