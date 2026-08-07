import { loadNotifications, markRead, markAllRead } from '@/lib/platform/notifications-client'

// notifications-client wraps the authed browser client; mock it to assert wiring.
type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'update', 'eq', 'is', 'order', 'limit']) {
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

const argsOf = (method: string) => calls.filter((c) => c.method === method).map((c) => c.args)

describe('loadNotifications', () => {
  it('reads own notifications newest-first with a limit', async () => {
    result = { data: [{ id: 'n1', kind: 'GENERIC', title: 'Hi' }], error: null }
    const rows = await loadNotifications(20)
    expect(calls[0].table).toBe('notifications')
    expect(argsOf('eq')).toEqual([['user_id', 'user1']])
    expect(argsOf('order')).toEqual([['created_at', { ascending: false }]])
    expect(argsOf('limit')).toEqual([[20]])
    expect(rows).toHaveLength(1)
  })

  it('returns [] when signed out (no user)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await loadNotifications()).toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('throws on a db error', async () => {
    result = { error: { message: 'boom' } }
    await expect(loadNotifications()).rejects.toThrow('boom')
  })
})

describe('markRead', () => {
  it('sets read_at on the given id, only when currently unread', async () => {
    await markRead('n9')
    expect((argsOf('update')[0][0] as Record<string, unknown>).read_at).toEqual(expect.any(String))
    expect(argsOf('eq')).toEqual([['id', 'n9']])
    expect(argsOf('is')).toEqual([['read_at', null]])
  })
})

describe('markAllRead', () => {
  it('marks all of the user\'s unread notifications read', async () => {
    await markAllRead()
    expect(argsOf('eq')).toEqual([['user_id', 'user1']])
    expect(argsOf('is')).toEqual([['read_at', null]])
  })

  it('no-ops when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await markAllRead()
    expect(from).not.toHaveBeenCalled()
  })
})
