import { readClubEvents } from '@/lib/platform/events'

// readClubEvents takes the Supabase client as an argument, so we can feed it a
// tiny fake that resolves club_events then club_event_rsvp_counts.

type Row = Record<string, unknown>
function builder(data: Row[]) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'in']) {
    b[m] = () => b
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.then = (resolve: (v: any) => void) => resolve({ data, error: null })
  return b
}

function fakeDb(events: Row[], counts: Row[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (t: string) => (t === 'club_events' ? builder(events) : builder(counts)) } as any
}

describe('readClubEvents', () => {
  it('attaches GOING/MAYBE counts and defaults missing ones to 0', async () => {
    const events = [
      { id: 'e1', club_id: 'c1', title: 'Nets', event_type: 'PRACTICE', starts_at: '2026-08-01T10:00:00Z', ends_at: null },
      { id: 'e2', club_id: 'c1', title: 'Match', event_type: 'MATCH', starts_at: '2026-08-02T10:00:00Z', ends_at: null },
    ]
    const counts = [{ event_id: 'e1', going: 4, maybe: 2 }] // e2 has no RSVPs yet
    const out = await readClubEvents(fakeDb(events, counts), 'c1')
    expect(out.map((e) => [e.id, e.going, e.maybe])).toEqual([
      ['e1', 4, 2],
      ['e2', 0, 0],
    ])
  })

  it('returns [] with no events (and does not query counts)', async () => {
    const from = jest.fn(() => builder([]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readClubEvents({ from } as any, 'c1')
    expect(out).toEqual([])
    expect(from).toHaveBeenCalledTimes(1) // only club_events, counts skipped
  })
})
