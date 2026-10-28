// Data from the Android app (Patristica src/screens/TimelinePanel.tsx), extracted verbatim.
import { COUNCILS } from './councils'
import { HERESIES } from './heresies'
import { PERSECUTIONS } from './persecutions'
import { FATHER_DATES } from './fatherDates'
export type StudyTab = 'councils' | 'heresies' | 'persecution' | 'fathers'

export type EventCategory = 'council' | 'heresy' | 'persecution' | 'father'

export interface TimelineEvent {
  id: string
  yearNum: number
  yearLabel: string
  category: EventCategory
  title: string
  subtitle: string
  targetTab?: StudyTab
}

// ── Category config ────────────────────────────────────────

export const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; icon: string }> = {
  council:     { label: 'Council',     color: '#c9a45a', icon: 'business-outline' },
  heresy:      { label: 'Heresy',      color: '#c45a5a', icon: 'warning-outline' },
  persecution: { label: 'Persecution', color: '#c47a40', icon: 'flame-outline' },
  father:      { label: 'Father',      color: '#7a9fd4', icon: 'person-outline' },
}

export const ALL_CATEGORIES: EventCategory[] = ['council', 'heresy', 'persecution', 'father']

// ── Build unified timeline ────────────────────────────────

function buildTimeline(): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Councils
  for (const c of COUNCILS) {
    events.push({
      id: `council-${c.yearNum}-${c.name}`,
      yearNum: c.yearNum,
      yearLabel: `${c.year} AD`,
      category: 'council',
      title: c.name,
      subtitle: c.decree.length > 90 ? c.decree.slice(0, 87) + '…' : c.decree,
      targetTab: 'councils',
    })
  }

  // Heresies
  for (const h of HERESIES) {
    events.push({
      id: `heresy-${h.yearNum}-${h.name}`,
      yearNum: h.yearNum,
      yearLabel: h.year,
      category: 'heresy',
      title: h.name,
      subtitle: h.taught.length > 90 ? h.taught.slice(0, 87) + '…' : h.taught,
      targetTab: 'heresies',
    })
  }

  // Persecutions
  for (const p of PERSECUTIONS) {
    events.push({
      id: `persecution-${p.yearNum}-${p.emperor}`,
      yearNum: p.yearNum,
      yearLabel: p.dateRange,
      category: 'persecution',
      title: `${p.emperor} Persecution`,
      subtitle: p.significance.length > 90 ? p.significance.slice(0, 87) + '…' : p.significance,
      targetTab: 'persecution',
    })
  }

  // Church Fathers (birth year, filtered to 30–500 AD; deduplicate by sort year + name)
  const seenFathers = new Set<string>()
  for (const [name, info] of Object.entries(FATHER_DATES)) {
    if (info.sort < 30 || info.sort > 500) continue
    // Skip alias/duplicate entries (same sort + very similar name)
    const key = `${info.sort}-${name.split(' ')[0]}`
    if (seenFathers.has(key)) continue
    seenFathers.add(key)
    events.push({
      id: `father-${info.sort}-${name}`,
      yearNum: info.sort,
      yearLabel: info.dates,
      category: 'father',
      title: name,
      subtitle: `Church Father · ${info.dates}`,
      targetTab: 'fathers',
    })
  }

  return events.sort((a, b) => a.yearNum - b.yearNum)
}

export const ALL_EVENTS = buildTimeline()

// ── Timeline row ──────────────────────────────────────────
