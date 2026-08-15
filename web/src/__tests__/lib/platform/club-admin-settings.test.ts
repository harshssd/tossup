import { updateClubSettings } from '@/lib/platform/club-admin'

// New in the 2026-08 audit fix PR 2 (U3): club settings edit with a whitelist
// and best-effort re-geocoding when the location changes.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()
const geocodeMock = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['update', 'eq', 'select', 'maybeSingle', 'insert']) {
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
jest.mock('@/lib/platform/geocode-client', () => ({
  geocode: (...a: unknown[]) => geocodeMock(...a),
}))

beforeEach(() => {
  calls = []
  result = { data: null, error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
  geocodeMock.mockReset().mockResolvedValue(null)
})

const updatePayload = () => calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>

describe('updateClubSettings', () => {
  it('updates only whitelisted fields (trust/ownership columns dropped)', async () => {
    await updateClubSettings('club1', {
      name: 'New Name',
      is_recruiting: true,
      roles_needed: ['BATSMAN'],
      // @ts-expect-error — deliberately hostile extra keys must be stripped
      recognition_tier: 'OFFICIAL',
      reputation_score: 9999,
      owner_id: 'attacker',
      slug: 'stolen',
    })
    const p = updatePayload()
    expect(p.name).toBe('New Name')
    expect(p.is_recruiting).toBe(true)
    expect(p).not.toHaveProperty('recognition_tier')
    expect(p).not.toHaveProperty('reputation_score')
    expect(p).not.toHaveProperty('owner_id')
    expect(p).not.toHaveProperty('slug')
  })

  it('re-geocodes when the location changes and stores the coords', async () => {
    geocodeMock.mockResolvedValue({ lat: 12.97, lng: 77.59 })
    await updateClubSettings('club1', { city: 'Bengaluru', region: 'Karnataka', country: 'IN' })
    expect(geocodeMock).toHaveBeenCalledTimes(1)
    const p = updatePayload()
    expect(p.latitude).toBe(12.97)
    expect(p.longitude).toBe(77.59)
  })

  it('saves without coords when the geocode fails (best-effort)', async () => {
    geocodeMock.mockResolvedValue(null)
    await updateClubSettings('club1', { city: 'Nowhere' })
    const p = updatePayload()
    expect(p.city).toBe('Nowhere')
    expect(p).not.toHaveProperty('latitude')
  })

  it('does not geocode when only non-location fields change', async () => {
    await updateClubSettings('club1', { description: 'hi' })
    expect(geocodeMock).not.toHaveBeenCalled()
  })

  it('no-ops on an empty patch', async () => {
    await updateClubSettings('club1', {})
    expect(from).not.toHaveBeenCalled()
  })
})
