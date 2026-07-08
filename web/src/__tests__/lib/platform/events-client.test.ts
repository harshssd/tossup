import { createEvent, deleteEvent, setRsvp, clearRsvp, getMyRsvps } from '@/lib/platform/events-client'

// events-client wraps the authed browser client. Mock it so we can assert the
// column mapping + RSVP upsert without a network.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['insert', 'upsert', 'delete', 'select', 'eq', 'in']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args })
      return b
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.then = (resolve: (v: any) => void) => resolve(result)
  return b
}

jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({ auth: { getUser }, from }),
}))

beforeEach(() => {
  calls = []
  result = { data: [], error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
})

const args = (table: string, method: string) =>
  calls.find((c) => c.table === table && c.method === method)?.args

describe('createEvent', () => {
  it('maps camelCase input to snake_case columns + created_by', async () => {
    await createEvent({
      clubId: 'c1',
      title: 'Sunday nets',
      eventType: 'PRACTICE',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T12:00:00.000Z',
      location: 'Oval',
      description: 'bring pads',
    })
    expect(args('club_events', 'insert')?.[0]).toEqual({
      club_id: 'c1',
      title: 'Sunday nets',
      event_type: 'PRACTICE',
      starts_at: '2026-08-01T10:00:00.000Z',
      ends_at: '2026-08-01T12:00:00.000Z',
      location: 'Oval',
      description: 'bring pads',
      created_by: 'u1',
    })
  })

  it('throws when not signed in', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(
      createEvent({ clubId: 'c1', title: 'x', eventType: 'MATCH', startsAt: '2026-08-01T10:00:00.000Z' })
    ).rejects.toThrow('signed in')
  })

  it('throws the supabase error', async () => {
    result = { error: { message: 'only a club admin can add events' } }
    await expect(
      createEvent({ clubId: 'c1', title: 'x', eventType: 'MATCH', startsAt: '2026-08-01T10:00:00.000Z' })
    ).rejects.toThrow('only a club admin can add events')
  })
})

describe('setRsvp', () => {
  it('upserts the current user RSVP keyed on (event_id, user_id)', async () => {
    await setRsvp('e1', 'GOING')
    const upsertArgs = args('event_rsvps', 'upsert')
    expect(upsertArgs?.[0]).toMatchObject({ event_id: 'e1', user_id: 'u1', status: 'GOING' })
    expect(upsertArgs?.[0]).toHaveProperty('updated_at')
    expect(upsertArgs?.[1]).toEqual({ onConflict: 'event_id,user_id' })
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(setRsvp('e1', 'GOING')).rejects.toThrow('Sign in to RSVP')
  })
})

describe('clearRsvp', () => {
  it('deletes the current user RSVP for the event', async () => {
    await clearRsvp('e1')
    expect(args('event_rsvps', 'delete')).toBeTruthy()
    // scoped to this event + this user
    expect(calls.filter((c) => c.table === 'event_rsvps' && c.method === 'eq').map((c) => c.args)).toEqual([
      ['event_id', 'e1'],
      ['user_id', 'u1'],
    ])
  })

  it('no-ops when signed out (no delete issued)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await clearRsvp('e1')
    expect(calls.find((c) => c.method === 'delete')).toBeUndefined()
  })
})

describe('getMyRsvps', () => {
  it('returns a per-event status map', async () => {
    result = { data: [{ event_id: 'e1', status: 'GOING' }, { event_id: 'e2', status: 'MAYBE' }] }
    expect(await getMyRsvps(['e1', 'e2'])).toEqual({ e1: 'GOING', e2: 'MAYBE' })
  })

  it('returns {} for no ids without hitting the client', async () => {
    expect(await getMyRsvps([])).toEqual({})
    expect(from).not.toHaveBeenCalled()
  })

  it('returns {} when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await getMyRsvps(['e1'])).toEqual({})
  })
})

describe('deleteEvent', () => {
  it('deletes by id', async () => {
    await deleteEvent('e1')
    expect(args('club_events', 'eq')).toEqual(['id', 'e1'])
  })
})
