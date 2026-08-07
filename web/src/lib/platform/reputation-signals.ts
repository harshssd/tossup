// Reputation v2 display helpers (pure, unit-tested). The score is a raw weighted
// sum computed server-side; here we normalise it into a friendly tier for display
// and turn the reputation_signals jsonb into an ordered, labelled breakdown.

export type ReputationSignals = Record<string, number | string | null>

/** Friendly labels for each signal key (computed_at is intentionally omitted). */
export const SIGNAL_LABELS: Record<string, string> = {
  honors: 'Trophies',
  members: 'Members',
  memberships: 'Memberships',
  events_held: 'Events held',
  recent_events: 'Recent events',
  fixtures_completed: 'Matches played',
  recent_fixtures: 'Recent matches',
  captaincies: 'Captaincies',
  recent_memberships: 'New members',
  completeness: 'Profile completeness',
}

// Display order — most meaningful signals first. `completeness` (a bare
// filled-fields count, 0–7) is deliberately excluded from the public breakdown:
// it still feeds the score, but as a number with no denominator it reads as
// opaque next to the genuine activity counts.
const SIGNAL_ORDER = [
  'honors',
  'members',
  'memberships',
  'events_held',
  'recent_events',
  'fixtures_completed',
  'recent_fixtures',
  'captaincies',
  'recent_memberships',
]

export interface SignalRow {
  key: string
  label: string
  value: number
}

/** Ordered, labelled, non-zero numeric signals for the breakdown UI. Drops
 *  `computed_at` (a string) and any zero/unknown keys. Pure. */
export function formatSignals(signals: ReputationSignals | null | undefined): SignalRow[] {
  if (!signals) return []
  const rows: SignalRow[] = []
  for (const key of SIGNAL_ORDER) {
    const v = signals[key]
    if (typeof v === 'number' && v > 0 && SIGNAL_LABELS[key]) {
      rows.push({ key, label: SIGNAL_LABELS[key], value: v })
    }
  }
  return rows
}

export interface ReputationTier {
  label: string
  /** Hue for the badge tint (used at ~10% alpha as the background). */
  tone: string
  /** Dark text colour that clears WCAG AA (4.5:1) on the light `tone` tint. */
  text: string
}

/** Normalise the raw score into a friendly, bounded tier for display (so a page
 *  shows "Established" rather than a bare, unbounded number). `text` is a darker
 *  shade than `tone` so small badge text stays legible on the pale tint. Pure. */
export function reputationTier(score: number): ReputationTier {
  if (score >= 60) return { label: 'Thriving', tone: '#0f5a30', text: '#0b3f22' }
  if (score >= 30) return { label: 'Established', tone: '#1f9d57', text: '#0f5a30' }
  if (score >= 10) return { label: 'Active', tone: '#2257b3', text: '#1a4487' }
  return { label: 'Emerging', tone: '#9a978d', text: '#57544c' }
}
