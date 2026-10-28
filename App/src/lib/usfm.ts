/**
 * USFM inline markers (\+w word\+w*, and the same shape for \+add, \+nd, \+it) leak
 * in from the source texts and sit in ~25% of the KJV rows in bible.db. They are
 * editorial marks, not Scripture, and nothing in the app reads them — word-level
 * Strong's data comes from the word tables.
 *
 * Stripped at render, not in the database: the stored text stays exactly as imported.
 */
const USFM_MARKER_RE = /\\\+[a-zA-Z]+\*?/g

export function stripUsfm(text: string): string {
  if (!text.includes('\\')) return text
  return text.replace(USFM_MARKER_RE, '').replace(/\s+/g, ' ').trim()
}
