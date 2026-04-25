// Placeholder — run scripts/generate_naves_data.py to populate this file.
// Until then the Topics tab will show "No topics found" for every verse.

export const NAVES_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS naves_topics (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS naves_refs (
    id       INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL,
    book     TEXT NOT NULL,
    chapter  INTEGER NOT NULL,
    verse    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_naves_refs_bv
    ON naves_refs(book, chapter, verse);
`

export const NAVES_TOPICS: Array<[number, string]> = []
export const NAVES_REFS: Array<[number, string, number, number]> = []
