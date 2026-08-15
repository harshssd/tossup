import { updateTournamentSettings, hostDeleteFixture, hostDeleteTeam, hostUpdateTeam } from '@/lib/platform/tournament-host'

// New in the 2026-08 audit fix PR 2 (U4): tournament settings edit (incl. the
// registration open/close toggle) + team/fixture corrections.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()
const rpc = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['update', 'delete', 'eq', 'select', 'insert', 'maybeSingle', 'order', 'limit']) {
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
  createPlatformBrowserClient: () => ({ auth: { getUser }, from, rpc }),
}))

beforeEach(() => {
  calls = []
  result = { data: null, error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
  rpc.mockReset().mockResolvedValue({ data: null, error: null })
})

const call = (method: string) => calls.find((c) => c.method === method)

describe('updateTournamentSettings', () => {
  it('whitelists editable fields and drops trust/ownership columns', async () => {
    await updateTournamentSettings('l1', {
      name: 'Summer Bash',
      registration_status: 'OPEN',
      // @ts-expect-error — hostile extras must be stripped
      recognition_tier: 'OFFICIAL',
      owner_id: 'attacker',
      visibility: 'PUBLIC',
    })
    const p = call('update')?.args[0] as Record<string, unknown>
    expect(p.name).toBe('Summer Bash')
    expect(p.registration_status).toBe('OPEN')
    expect(p).not.toHaveProperty('recognition_tier')
    expect(p).not.toHaveProperty('owner_id')
    expect(p).not.toHaveProperty('visibility')
    expect(call('eq')?.args).toEqual(['id', 'l1'])
  })

  it('no-ops on an empty patch', async () => {
    await updateTournamentSettings('l1', {})
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces RLS denial', async () => {
    result = { error: { message: 'row-level security' } }
    await expect(updateTournamentSettings('l1', { name: 'X' })).rejects.toThrow('row-level security')
  })
})

describe('team/fixture corrections', () => {
  it('deletes a fixture by id', async () => {
    await hostDeleteFixture('f9')
    expect(calls[0].table).toBe('fixtures')
    expect(call('delete')).toBeTruthy()
    expect(call('eq')?.args).toEqual(['id', 'f9'])
  })

  it('renames a team', async () => {
    await hostUpdateTeam('t3', { name: 'Renamed CC' })
    expect(calls[0].table).toBe('tournament_teams')
    expect(call('update')?.args[0]).toEqual({ name: 'Renamed CC' })
  })

  it('deletes a team by id', async () => {
    await hostDeleteTeam('t3')
    expect(calls[0].table).toBe('tournament_teams')
    expect(call('delete')).toBeTruthy()
  })
})
