import { updateOwnedProfile } from '@/lib/platform/persons-client'

// updateOwnedProfile wraps the authed browser client (RLS pp_owner_update gates it).

type Call = { method: string; args: unknown[] }
let calls: Call[]
let result: { error?: unknown }
const getUser = jest.fn()
const from = jest.fn()

function makeBuilder() {
  const b: Record<string, unknown> = {}
  for (const m of ['update', 'eq']) {
    b[m] = (...args: unknown[]) => {
      calls.push({ method: m, args })
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
  result = { error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user1' } } })
  from.mockReset().mockImplementation(() => makeBuilder())
})

describe('updateOwnedProfile', () => {
  it('updates the given fields scoped to the person id', async () => {
    await updateOwnedProfile('person1', { looking_for_club: true, region: 'California' })
    expect(calls.find((c) => c.method === 'update')?.args[0]).toEqual({ looking_for_club: true, region: 'California' })
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'person1'])
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(updateOwnedProfile('person1', { looking_for_club: true })).rejects.toThrow('signed in')
  })

  it('surfaces the supabase error (e.g. RLS denial editing someone else)', async () => {
    result = { error: { message: 'new row violates row-level security policy' } }
    await expect(updateOwnedProfile('person1', { region: 'X' })).rejects.toThrow('row-level security')
  })
})
