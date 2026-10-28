// Translation catalogue — from the Android app (Patristica src/context/TranslationContext.tsx).

export type Translation = 'KJV' | 'ASV' | 'WEB' | 'BSB' | 'ESV' | 'SBLGNT' | 'TAGNT' | 'TR' | 'TR+' | 'KJV+' | 'I_KJV+' | 'TAHOT' | 'WLC' | 'WLC+' | 'DSS' | 'LXX' | 'LXX+' | 'E_LXX' | 'A_LXX'

// `apiOnly` marks a translation with no local text at all — fetched live from a
// third-party API, so it works only in the main reader. Parallel, split, and
// search all read straight from SQLite and must filter it out.
export const TRANSLATIONS: { key: Translation; label: string; full: string; greekOnly?: boolean; otOriginal?: boolean; otOnly?: boolean; apiOnly?: boolean }[] = [
  { key: 'KJV',    label: 'KJV',    full: 'King James Version' },
  { key: 'KJV+',   label: 'KJV+',   full: "King James Version with Strong's (English order)" },
  { key: 'I_KJV+', label: 'I_KJV+', full: 'Interlinear KJV+ (Greek/Hebrew word order)' },
  { key: 'ASV',    label: 'ASV',    full: 'American Standard Version' },
  { key: 'WEB',    label: 'WEB',    full: 'World English Bible' },
  { key: 'BSB',    label: 'BSB',    full: 'Berean Standard Bible' },
  { key: 'ESV',    label: 'ESV',    full: 'English Standard Version (needs a free API key)', apiOnly: true },
  { key: 'SBLGNT', label: 'SBLGNT', full: 'SBL Greek New Testament',              greekOnly: true },
  { key: 'TAGNT',  label: 'TAGNT',  full: 'Translators Amalgamated GNT (NA28)',   greekOnly: true },
  { key: 'TR',     label: 'TR',     full: 'Textus Receptus (Scrivener 1894)',      greekOnly: true },
  { key: 'TR+',    label: 'TR+',    full: "Textus Receptus with Strong's",         greekOnly: true },
  { key: 'TAHOT',  label: 'TAHOT',  full: 'Translators Amalgamated Hebrew OT',    otOriginal: true },
  { key: 'WLC',    label: 'WLC',    full: 'Westminster Leningrad Codex',           otOriginal: true },
  { key: 'WLC+',   label: 'WLC+',   full: "Westminster Leningrad Codex with Strong's", otOriginal: true },
  { key: 'DSS',    label: 'DSS',    full: 'Dead Sea Scrolls (Hebrew)',             otOriginal: true },
  { key: 'LXX',    label: 'LXX',    full: 'Septuagint (Greek)',                    otOriginal: true },
  { key: 'LXX+',   label: 'LXX+',   full: "Septuagint with Strong's (Greek)",       otOriginal: true },
  { key: 'E_LXX',  label: 'E_LXX',  full: "Brenton's Septuagint (English)",       otOnly: true },
  { key: 'A_LXX',  label: 'A-LXX',  full: 'Apostolic Bible LXX (English)',        otOnly: true },
]

export const TRANSLATION_GROUPS: { label: string; keys: Translation[] }[] = [
  { label: 'English',                keys: TRANSLATIONS.filter(t => !t.greekOnly && !t.otOriginal && !t.otOnly).map(t => t.key) },
  { label: 'Greek New Testament',    keys: TRANSLATIONS.filter(t => t.greekOnly).map(t => t.key) },
  { label: 'Old Testament Originals', keys: TRANSLATIONS.filter(t => t.otOriginal).map(t => t.key) },
  { label: 'English Old Testament',  keys: TRANSLATIONS.filter(t => t.otOnly).map(t => t.key) },
]

export const TRANSLATION_MAP = Object.fromEntries(TRANSLATIONS.map(t => [t.key, t])) as Record<Translation, typeof TRANSLATIONS[number]>

export const GREEK_TRANSLATIONS       = new Set<string>(['SBLGNT', 'TAGNT', 'TR', 'TR+'])
export const OT_ORIGINAL_TRANSLATIONS = new Set<string>(['TAHOT', 'WLC', 'WLC+', 'DSS', 'LXX', 'LXX+'])
export const OT_ONLY_TRANSLATIONS     = new Set<string>(['E_LXX', 'A_LXX'])
export const OT_TRANSLATIONS          = new Set<string>([...OT_ORIGINAL_TRANSLATIONS, ...OT_ONLY_TRANSLATIONS])
export const ANNOTATED_TRANSLATIONS   = new Set<string>(['KJV+', 'I_KJV+', 'TR+', 'WLC+', 'LXX+'])
export const HEBREW_TRANSLATIONS      = new Set<string>(['DSS', 'WLC', 'WLC+', 'TAHOT'])

export const INCOMPLETE_DATASET_NOTE: Record<string, string> = {
  LXX:    'Incomplete dataset — Psalms 10–147 and a few other chapters unavailable',
  'LXX+': 'Incomplete dataset — Psalms 10–147 and a few other chapters unavailable',
  A_LXX:  'Incomplete dataset — Psalms unavailable',
}

/** Search, concordance and cross-refs read SQLite, where the ESV has no rows — use KJV there. */
export function sqlTranslation(t: string): string {
  return TRANSLATION_MAP[t as Translation]?.apiOnly ? 'KJV' : t
}

export function isValidTranslation(t: string): t is Translation {
  return t in TRANSLATION_MAP
}
