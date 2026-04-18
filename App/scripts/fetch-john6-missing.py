"""
Fetches missing John 6 verses 20-71 from catenabible.com API
and appends them to commentary-catenabible.json
"""

import urllib.request
import json
import time

API_BASE = 'https://api.catenabible.com:8080'
OUT_PATH = 'C:/Projects/BibleApp/data/raw/commentary-catenabible.json'

ERA_MAP = {
    'EF': {'era': 'Early Church',  'order': 4},
    'CC': {'era': 'Medieval',      'order': 8},
    'EO': {'era': 'Byzantine',     'order': 9},
    'RC': {'era': 'Post-Medieval', 'order': 12},
}

def fetch_json(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'Origin': 'https://www.catenabible.com',
        'Referer': 'https://www.catenabible.com/'
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))

def normalize_entry(raw, chapter, verse):
    if not raw or not isinstance(raw, dict):
        return None
    father = raw.get('father', {})
    father_name = father.get('fullName') or (father.get('en') or {}).get('name', '')
    text = raw.get('commentary', '')
    import re
    text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
    text = ' '.join(text.split()).strip()
    if not father_name or not text or len(text) < 20:
        return None
    tag = father.get('tag', 'EF')
    era_info = ERA_MAP.get(tag, {'era': 'Early Church', 'order': 5})
    info_url = father.get('infoUrl') or (father.get('en') or {}).get('infoUrl', '')
    return {
        'book': 'John',
        'chapter': chapter,
        'verse': verse,
        'father_name': father_name,
        'father_era': era_info['era'],
        'father_era_order': era_info['order'],
        'excerpt': text[:217] + '…' if len(text) > 220 else text,
        'full_text': text,
        'source': f'Commentary on John {chapter}:{verse} (catenabible.com)',
        'source_url': info_url
    }

def fetch_verse(chapter, verse):
    url = f'{API_BASE}/anc_com/c/jn/{chapter}/{verse}?tags=["ALL"]&sort=era'
    try:
        data = fetch_json(url)
        if not data or not isinstance(data, list):
            return []
        return [e for e in (normalize_entry(r, chapter, verse) for r in data) if e]
    except Exception as ex:
        print(f'  Error fetching {chapter}:{verse}: {ex}')
        return []

def main():
    print('Loading existing commentary...')
    with open(OUT_PATH, encoding='utf-8') as f:
        all_entries = json.load(f)
    print(f'Existing entries: {len(all_entries)}')

    # Get index to know which verses have data
    print('Fetching John 6 index...')
    index_url = f'{API_BASE}/anc_com/i/jn/6?tags=["ALL"]'
    counts = fetch_json(index_url)
    print(f'Index length: {len(counts)}, Verse counts: {counts}')
    time.sleep(0.5)

    # Find which verses in 20-71 have commentaries
    missing_verses = []
    for v in range(20, 72):
        if v < len(counts) and counts[v] and counts[v] > 0:
            missing_verses.append(v)
    print(f'Missing verses with data: {missing_verses}')

    new_entries = []
    for v in missing_verses:
        print(f'  Fetching John 6:{v} (expected {counts[v]} entries)...', end=' ')
        entries = fetch_verse(6, v)
        print(f'got {len(entries)}')
        new_entries.extend(entries)
        time.sleep(0.3)

    print(f'\nFetched {len(new_entries)} new entries')
    all_entries.extend(new_entries)

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, indent=2, ensure_ascii=False)
    print(f'Saved {len(all_entries)} total entries to {OUT_PATH}')

if __name__ == '__main__':
    main()
