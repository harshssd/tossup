import {
  requestToJoin,
  withdrawJoinRequest,
  decideJoinRequest,
  loadJoinRequests,
} from '@/lib/platform/club-join-client'

// club-join-client wraps the authed browser client; mock it to assert the
// request/decide wiring without a network.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }
let rpcResult: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()
const rpc = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['insert', 'delete', 'select', 'eq']) {
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
  result = { data: [], error: null }
  rpcResult = { data: [], error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
  rpc.mockReset().mockImplementation(async () => rpcResult)
})

const arg = (method: string) => calls.find((c) => c.method === method)?.args

describe('requestToJoin', () => {
  it('inserts an own request with a trimmed message', async () => {
    await requestToJoin('club1', '  keen to play  ')
    expect(arg('insert')?.[0]).toEqual({ club_id: 'club1', user_id: 'user1', message: 'keen to play' })
  })

  it('sends null when the message is blank', async () => {
    await requestToJoin('club1', '   ')
    expect((arg('insert')?.[0] as Record<string, unknown>).message).toBeNull()
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(requestToJoin('club1')).rejects.toThrow('signed in')
  })

  it('surfaces the supabase error (e.g. RLS denial / dup pending)', async () => {
    result = { error: { message: 'duplicate key value violates unique constraint' } }
    await expect(requestToJoin('club1')).rejects.toThrow('duplicate key')
  })
})

describe('withdrawJoinRequest', () => {
  it('deletes own pending request scoped by club, user, and status', async () => {
    await withdrawJoinRequest('club1')
    expect(arg('delete')).toBeTruthy()
    const eqs = calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toEqual([
      ['club_id', 'club1'],
      ['user_id', 'user1'],
      ['status', 'PENDING'],
    ])
  })
})

describe('decideJoinRequest', () => {
  it('calls the decide RPC with the request id and approve flag', async () => {
    await decideJoinRequest('req1', true)
    expect(rpc).toHaveBeenCalledWith('decide_club_join_request', { p_request_id: 'req1', p_approve: true })
  })

  it('throws on RPC error (e.g. not authorized)', async () => {
    rpcResult = { error: { message: 'not authorized' } }
    await expect(decideJoinRequest('req1', false)).rejects.toThrow('not authorized')
  })
})

describe('loadJoinRequests', () => {
  it('returns the admin-gated pending list', async () => {
    rpcResult = { data: [{ id: 'r1', requester_name: 'Asha', message: null }], error: null }
    const rows = await loadJoinRequests('club1')
    expect(rpc).toHaveBeenCalledWith('list_club_join_requests', { p_club_id: 'club1' })
    expect(rows).toEqual([{ id: 'r1', requester_name: 'Asha', message: null }])
  })

  it('throws on RPC error', async () => {
    rpcResult = { error: { message: 'not authorized' } }
    await expect(loadJoinRequests('club1')).rejects.toThrow('not authorized')
  })
})
