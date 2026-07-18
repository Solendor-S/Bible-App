// Interlinear word-source registry (Words panel).
// The `id` strings are the contract with the backend whitelist in electron/main.ts
// (WORD_SOURCE_TABLES) — keep the two in sync.

export type WordScript = 'greek' | 'hebrew'
export type Testament = 'NT' | 'OT'

export interface WordSource {
  id: string
  label: string       // short chip label
  fullName: string    // tooltip / expanded name
  script: WordScript  // decides RTL rendering + Strong's/lexicon language
  testament: Testament
}

// Order = display order within each testament.
export const WORD_SOURCES: WordSource[] = [
  { id: 'tagnt',   label: 'TAGNT',   fullName: 'Translators Amalgamated Greek NT', script: 'greek',  testament: 'NT' },
  { id: 'tr',      label: 'TR',      fullName: 'Textus Receptus',                  script: 'greek',  testament: 'NT' },
  { id: 'opengnt', label: 'OpenGNT', fullName: 'Open Greek New Testament',         script: 'greek',  testament: 'NT' },
  { id: 'tahot',   label: 'TAHOT',   fullName: 'Translators Amalgamated Hebrew OT', script: 'hebrew', testament: 'OT' },
  { id: 'wlc',     label: 'WLC',     fullName: 'Westminster Leningrad Codex',       script: 'hebrew', testament: 'OT' },
  { id: 'dss',     label: 'DSS',     fullName: 'Dead Sea Scrolls',                  script: 'hebrew', testament: 'OT' },
  // LXX (untagged) is omitted here — it has no interlinear data, so it stays only as a
  // parallel translation (WORD_TABLE_TRANSLATIONS in main.ts). LXX-A carries the tags.
  { id: 'lxx_a',   label: 'LXX-A',   fullName: 'Apostolic Bible (tagged Septuagint)', script: 'greek', testament: 'OT' },
]

// Initial favourite (default) per testament, before the user stars another.
export const DEFAULT_FAVOURITE: Record<Testament, string> = { NT: 'tagnt', OT: 'tahot' }

export function sourcesFor(testament: Testament): WordSource[] {
  return WORD_SOURCES.filter(s => s.testament === testament)
}

export function getSource(id: string): WordSource | undefined {
  return WORD_SOURCES.find(s => s.id === id)
}
