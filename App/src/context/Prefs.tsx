// All user preferences, persisted in user.db's `settings` table (same table and keys as the
// Android app). One store replaces Android's per-setting contexts.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { userDb } from '../db/sqlite'

type Value = string | number | boolean

/** Every pref the app reads, with its default. Keys match the Android settings keys. */
export const PREF_DEFAULTS = {
  theme: 'dark' as 'dark' | 'light' | 'highContrast',
  font_size: 17,
  line_spacing: 'normal' as 'compact' | 'normal' | 'relaxed' | 'spacious',
  font_family: 'serif' as 'default' | 'serif' | 'sans' | 'light' | 'condensed' | 'mono',
  font_scope: 'verse' as 'verse' | 'all',
  startup_mode: 'resume' as 'john1' | 'resume',
  startup_translation: 'last' as string,
  last_used_translation: 'KJV',
  last_passage: '',
  red_letter_on: true,
  reading_mode: false,
  focus_mode: false,
  ot_quote_caps: false,
  dss_all_readings: false,
  bsb_folded: true,
  crossref_biblical_order: false,
  search_biblical_order: false,
  strongs_in_search: true,
  search_mode: 'exact_words' as 'exact_words' | 'fuzzy' | 'exact_phrase' | 'exact_all_words',
  parallel_on: false,
  parallel_translation: 'ASV',
  split_on: false,
  split_passage: 'Romans 8',
  split_translation: 'KJV',
  greek_source_fav: 'tr',
  ot_source_fav: 'wlc',
  onboarding_done: false,
  whats_new_seen: '',
  panel_tab_order: '',
  commentary_source: 'fathers' as 'fathers' | 'legacy',
}
export type PrefKey = keyof typeof PREF_DEFAULTS
type Prefs = { -readonly [K in PrefKey]: (typeof PREF_DEFAULTS)[K] }

function parse(raw: string, def: Value): Value {
  if (typeof def === 'boolean') return raw === '1' || raw === 'true'
  if (typeof def === 'number') { const n = Number(raw); return Number.isFinite(n) ? n : def }
  return raw
}

const Ctx = createContext<{ prefs: Prefs; set: (k: PrefKey, v: Value) => void; reset: () => void } | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  useEffect(() => {
    userDb.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings').then(rows => {
      const p = { ...PREF_DEFAULTS } as Record<string, Value>
      for (const { key, value } of rows) if (key in p) p[key] = parse(value, p[key])
      setPrefs(p as Prefs)
    })
  }, [])

  const set = useCallback((k: PrefKey, v: Value) => {
    setPrefs(p => (p ? { ...p, [k]: v } : p))
    const raw = typeof v === 'boolean' ? (v ? '1' : '0') : String(v)
    userDb.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, raw])
  }, [])

  // "Reset All Settings": appearance/reading prefs only — never onboarding or history state.
  const reset = useCallback(() => {
    const keep = new Set<string>(['onboarding_done', 'whats_new_seen', 'last_passage', 'panel_tab_order'])
    for (const k of Object.keys(PREF_DEFAULTS) as PrefKey[]) if (!keep.has(k)) set(k, PREF_DEFAULTS[k])
  }, [set])

  if (!prefs) return null
  return <Ctx.Provider value={{ prefs, set, reset }}>{children}</Ctx.Provider>
}

export function usePrefs() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs outside PrefsProvider')
  return c
}

export function usePref<K extends PrefKey>(key: K): [Prefs[K], (v: Prefs[K]) => void] {
  const { prefs, set } = usePrefs()
  return [prefs[key], useCallback((v: Prefs[K]) => set(key, v as Value), [key, set])]
}
