import { followScope, unfollowScope, setFollow } from '@/lib/platform/follows-client'

// follows-client wraps the authed browser client; mock it to assert the
// follow/unfollow wiring without a network.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['insert', 'delete', 'eq']) {
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
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
})

const arg = (method: string) => calls.find((c) => c.method === method)?.args

describe('followScope', () => {
  it('inserts an own follow row for the scope', async () => {
    await followScope('club', 'club1')
    expect(calls[0].table).toBe('follows')
    expect(arg('insert')?.[0]).toEqual({ user_id: 'user1', scope: 'club', scope_id: 'club1' })
  })

  it('treats a duplicate (23505) as already-following, not an error', async () => {
    result = { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
    await expect(followScope('league', 'l1')).resolves.toBeUndefined()
  })

  it('surfaces a real RLS/insert error', async () => {
    result = { error: { code: '42501', message: 'new row violates row-level security policy' } }
    await expect(followScope('club', 'priv1')).rejects.toThrow('row-level security')
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(followScope('club', 'club1')).rejects.toThrow('signed in')
  })
})

describe('unfollowScope', () => {
  it('deletes the own follow row scoped by user, scope, and target', async () => {
    await unfollowScope('league', 'l1')
    expect(arg('delete')).toBeTruthy()
    const eqs = calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toEqual([
      ['user_id', 'user1'],
      ['scope', 'league'],
      ['scope_id', 'l1'],
    ])
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(unfollowScope('club', 'club1')).rejects.toThrow('signed in')
  })
})

describe('setFollow', () => {
  it('follows when true and returns the new state', async () => {
    const state = await setFollow('club', 'club1', true)
    expect(state).toBe(true)
    expect(arg('insert')).toBeTruthy()
  })

  it('unfollows when false', async () => {
    const state = await setFollow('club', 'club1', false)
    expect(state).toBe(false)
    expect(arg('delete')).toBeTruthy()
  })
})
