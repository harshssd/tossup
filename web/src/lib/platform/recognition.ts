// Recognition model: tiered trust + reputation. Tier order is the credibility order.
export const TIERS = ['OFFICIAL', 'AFFILIATED', 'COMMUNITY', 'UNVERIFIED'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_META: Record<
  Tier,
  { label: string; color: string; blurb: string }
> = {
  OFFICIAL: { label: 'Official', color: '#f4c430', blurb: 'Verified by an official cricket body — a full cap' },
  AFFILIATED: { label: 'Affiliated', color: '#4aa3ff', blurb: 'Linked to a recognized source or partner' },
  COMMUNITY: { label: 'Community', color: '#1f9d57', blurb: 'Community-listed, playing on merit' },
  UNVERIFIED: { label: 'Unverified', color: '#8a97a8', blurb: 'No verification or corroboration yet' },
}

/** 0 = most credible. Use for sorting. */
export function tierRank(t: Tier): number {
  return TIERS.indexOf(t)
}

export const PLAYING_ROLES = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER'] as const
export type PlayingRole = (typeof PLAYING_ROLES)[number]

export function roleLabel(r?: string | null): string {
  if (!r) return '—'
  return r.replace('_', '-').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// Countries we anchor recognition + proximity around first (extensible).
export const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
] as const
