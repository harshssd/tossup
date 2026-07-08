import { readClubEvents, goingDelta } from '@/lib/platform/events'

// readClubEvents takes the Supabase client as an argument, so we feed it a fake
// that records method calls and resolves per-table data.

type Row = Record<string, unknown>
let calls: { table: string; method: string; args: unknown[] }[]

function builder(table: string, data: Row[]) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'in', 'or']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args })
      return b
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.then = (resolve: (v: any) => void) => resolve({ data, error: null })
  return b
}

function fakeDb(tables: Record<string, Row[]>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (t: string) => builder(t, tables[t] ?? []) } as any
}

const called = (table: string, method: string) => calls.some((c) => c.table === table && c.method === method)

beforeEach(() => {
  calls = []
})

describe('readClubEvents', () => {
  const events = [
    { id: 'e1', club_id: 'c1', title: 'Nets', event_type: 'PRACTICE', starts_at: '2026-08-01T10:00:00Z', ends_at: null },
    { id: 'e2', club_id: 'c1', title: 'Match', event_type: 'MATCH', starts_at: '2026-08-02T10:00:00Z', ends_at: null },
  ]

  it('attaches counts from the public view and defaults missing ones to 0', async () => {
    const db = fakeDb({ club_events: events, club_event_rsvp_counts: [{ event_id: 'e1', going: 4, maybe: 2 }] })
    const out = await readClubEvents(db, 'c1')
    expect(out.map((e) => [e.id, e.going, e.maybe])).toEqual([
      ['e1', 4, 2],
      ['e2', 0, 0],
    ])
    // Default = upcoming: applies the live-event filter, reads the public view.
    expect(called('club_events', 'or')).toBe(true)
    expect(called('club_event_rsvp_counts', 'in')).toBe(true)
    expect(called('event_rsvps', 'in')).toBe(false)
  })

  it('upcoming: false skips the live filter and shows all events', async () => {
    const db = fakeDb({ club_events: events, club_event_rsvp_counts: [] })
    await readClubEvents(db, 'c1', { upcoming: false })
    expect(called('club_events', 'or')).toBe(false)
  })

  it('countsFromRsvps aggregates the attendee rows instead of the view', async () => {
    const db = fakeDb({
      club_events: events,
      event_rsvps: [
        { event_id: 'e1', status: 'GOING' },
        { event_id: 'e1', status: 'GOING' },
        { event_id: 'e1', status: 'MAYBE' },
        { event_id: 'e2', status: 'MAYBE' },
      ],
    })
    const out = await readClubEvents(db, 'c1', { upcoming: false, countsFromRsvps: true })
    expect(out.map((e) => [e.id, e.going, e.maybe])).toEqual([
      ['e1', 2, 1],
      ['e2', 0, 1],
    ])
    expect(called('event_rsvps', 'in')).toBe(true)
    expect(called('club_event_rsvp_counts', 'in')).toBe(false)
  })

  it('returns [] with no events (and does not query counts)', async () => {
    const out = await readClubEvents(fakeDb({ club_events: [] }), 'c1')
    expect(out).toEqual([])
    expect(calls.every((c) => c.table === 'club_events')).toBe(true)
  })
})

describe('goingDelta', () => {
  it('covers every RSVP transition', () => {
    expect(goingDelta(undefined, 'GOING')).toBe(1) // new GOING
    expect(goingDelta(undefined, 'MAYBE')).toBe(0) // new MAYBE
    expect(goingDelta('GOING', 'MAYBE')).toBe(-1) // switch off GOING
    expect(goingDelta('MAYBE', 'GOING')).toBe(1) // switch onto GOING
    expect(goingDelta('GOING', undefined)).toBe(-1) // clear GOING
    expect(goingDelta('MAYBE', undefined)).toBe(0) // clear MAYBE
    expect(goingDelta('GOING', 'GOING')).toBe(0) // no-op
  })

  it('is antisymmetric so a revert undoes the forward delta', () => {
    const pairs: [undefined | 'GOING' | 'MAYBE', undefined | 'GOING' | 'MAYBE'][] = [
      [undefined, 'GOING'],
      ['GOING', 'MAYBE'],
      ['MAYBE', undefined],
    ]
    for (const [a, b] of pairs) {
      expect(goingDelta(a, b) + goingDelta(b, a)).toBe(0)
    }
  })
})
