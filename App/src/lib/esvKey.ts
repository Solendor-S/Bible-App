/**
 * Where the user's Crossway key lives on desktop.
 *
 * Patristica keeps it in its app-private settings DB; here it goes in localStorage
 * alongside the other panel prefs. It is the user's own key on their own machine,
 * and it must never reach bible.db.
 */
import { useSyncExternalStore } from 'react'
import { clearEsvCache } from './esv'

const STORAGE_KEY = 'esv-api-key'
const CHANGE_EVENT = 'esv-key-change'

/**
 * esv.org shows the key as "Authorization: Token abc123", so that whole line is what
 * most people paste. Strip the header wrapper rather than rejecting it.
 */
export function normalizeEsvKey(raw: string): string {
  return raw.trim().replace(/^Authorization:\s*/i, '').replace(/^Token\s+/i, '').trim()
}

export function getEsvKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

/** Empty string means "forget my key" — the ESV cleanly reverts to unconfigured. */
export function setEsvKey(raw: string) {
  const key = normalizeEsvKey(raw)
  if (key) localStorage.setItem(STORAGE_KEY, key)
  else localStorage.removeItem(STORAGE_KEY)
  clearEsvCache()  // a key change may mean a different account; don't serve its results
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb)
  return () => window.removeEventListener(CHANGE_EVENT, cb)
}

/** Re-renders the reader when the key is saved or removed. */
export function useEsvKey(): string {
  return useSyncExternalStore(subscribe, getEsvKey)
}
