"""
Download Greek NT source datasets for multi-text interlinear support.

Source:
  STEPBible TAGNT  -- Translators Amalgamated Greek NT (CC BY 4.0)
  Encodes ALL major traditions (NA28 critical, TR/Scrivener 1894, others)
  in a single file using per-word N/K/O flags. One download gives us both
  the critical text and Textus Receptus word lists.
  https://github.com/STEPBible/STEPBible-Data

Run from any directory:
  python scripts/download-greek-sources.py

Output:
  BibleApp/App/data/raw/tagnt/   -- 2 large TSV files (Mat-Jhn, Act-Rev)

After downloading, run extract-tagnt.py to produce tagnt-critical.json and tagnt-tr.json.
"""

import io
import os
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR    = os.path.join(SCRIPT_DIR, "..", "data", "raw")
TAGNT_DIR  = os.path.join(RAW_DIR, "tagnt")

TAGNT_BASE = (
    "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/"
    "Translators%20Amalgamated%20OT%2BNT/"
)

TAGNT_FILES = [
    "TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
    "TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
]


def download_file(url: str, dest: str, label: str) -> bool:
    if os.path.exists(dest):
        print(f"  [skip] {label}  ({os.path.getsize(dest):,} bytes already on disk)")
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bible-app-downloader/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(dest, "wb") as f:
            f.write(data)
        print(f"  [ok]   {label}  ({len(data):,} bytes)")
        return True
    except Exception as e:
        print(f"  [fail] {label}  -- {e}", file=sys.stderr)
        return False


def main():
    os.makedirs(TAGNT_DIR, exist_ok=True)
    print("Downloading STEPBible TAGNT...")

    ok = sum(
        download_file(TAGNT_BASE + urllib.request.quote(f), os.path.join(TAGNT_DIR, f), f[:55])
        for f in TAGNT_FILES
    )

    print(f"\n{ok}/{len(TAGNT_FILES)} files downloaded -> {TAGNT_DIR}")
    if ok < len(TAGNT_FILES):
        sys.exit(1)
    else:
        print("Done. Run extract-tagnt.py to extract critical + TR word lists.")


if __name__ == "__main__":
    main()
