import { formatSignals, reputationTier, SIGNAL_LABELS } from '@/lib/platform/reputation-signals'

describe('formatSignals', () => {
  it('returns ordered, labelled, non-zero numeric signals (drops zeros, computed_at, completeness)', () => {
    const rows = formatSignals({
      members: 12,
      events_held: 0,
      honors: 2,
      recent_events: 3,
      completeness: 5, // deliberately excluded from the public breakdown
      computed_at: '2026-07-12T00:00:00Z',
    })
    // honors first (order), then members, recent_events; events_held (0) + completeness dropped.
    expect(rows.map((r) => r.key)).toEqual(['honors', 'members', 'recent_events'])
    expect(rows.map((r) => r.label)).toEqual(['Trophies', 'Members', 'Recent events'])
    expect(rows.find((r) => r.key === 'members')?.value).toBe(12)
  })

  it('returns [] for null/empty/all-zero signals', () => {
    expect(formatSignals(null)).toEqual([])
    expect(formatSignals({})).toEqual([])
    expect(formatSignals({ members: 0, honors: 0 })).toEqual([])
  })

  it('ignores unknown keys and non-numeric values', () => {
    expect(formatSignals({ mystery: 9, members: 'x' as unknown as number })).toEqual([])
  })
})

describe('reputationTier', () => {
  it('buckets the raw score into a friendly tier', () => {
    expect(reputationTier(0).label).toBe('Emerging')
    expect(reputationTier(9).label).toBe('Emerging')
    expect(reputationTier(10).label).toBe('Active')
    expect(reputationTier(29).label).toBe('Active')
    expect(reputationTier(30).label).toBe('Established')
    expect(reputationTier(59).label).toBe('Established')
    expect(reputationTier(60).label).toBe('Thriving')
    expect(reputationTier(500).label).toBe('Thriving')
  })

  it('every tier carries a hex tone and a dark text colour (contrast)', () => {
    for (const s of [0, 10, 30, 60]) {
      expect(reputationTier(s).tone).toMatch(/^#[0-9a-f]{6}$/i)
      expect(reputationTier(s).text).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('SIGNAL_LABELS', () => {
  it('has no label for computed_at (never displayed)', () => {
    expect(SIGNAL_LABELS.computed_at).toBeUndefined()
  })
})
