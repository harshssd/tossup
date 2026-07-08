import {
  createClubAnnouncement,
  setClubPostPinned,
  deleteClubPost,
  loadClubPostsAdmin,
} from '@/lib/platform/pavilion-client'

// pavilion-client wraps the authed browser client. Mock it to assert the club
// post column mapping + admin ops without a network.

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[]
let result: { data?: unknown; error?: unknown }

const getUser = jest.fn()
const from = jest.fn()

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['insert', 'update', 'delete', 'select', 'eq', 'order', 'limit']) {
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

// pavilion-client imports listClubPosts from pavilion, which reads platformDb —
// but loadClubPostsAdmin passes the authed client, so we never touch platformDb.
jest.mock('@/lib/platform/db', () => ({ platformDb: {} }))

beforeEach(() => {
  calls = []
  result = { data: [], error: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'admin1' } } })
  from.mockReset().mockImplementation((t: string) => makeBuilder(t))
})

const arg = (method: string) => calls.find((c) => c.method === method)?.args

describe('createClubAnnouncement', () => {
  it('maps input to a club-scoped, host-authored post', async () => {
    await createClubAnnouncement({
      clubId: 'c1',
      kind: 'SCHEDULE',
      priority: 'HIGH',
      title: '  Nets moved  ',
      body: 'Sunday 9am',
      isPinned: true,
    })
    const p = arg('insert')?.[0] as Record<string, unknown>
    expect(p).toMatchObject({
      club_id: 'c1',
      kind: 'SCHEDULE',
      priority: 'HIGH',
      title: 'Nets moved', // trimmed
      body: 'Sunday 9am',
      author_id: 'admin1',
      is_host: true,
      is_pinned: true,
    })
    expect(p.pinned_at).toBeTruthy() // pinned → timestamp
  })

  it('leaves pinned_at null when not pinned and blanks an empty title', async () => {
    await createClubAnnouncement({ clubId: 'c1', kind: 'ANNOUNCEMENT', priority: 'NORMAL', title: '   ', body: 'hi' })
    const p = arg('insert')?.[0] as Record<string, unknown>
    expect(p.pinned_at).toBeNull()
    expect(p.is_pinned).toBe(false)
    expect(p.title).toBeNull()
  })

  it('throws when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(
      createClubAnnouncement({ clubId: 'c1', kind: 'ANNOUNCEMENT', priority: 'NORMAL', body: 'x' })
    ).rejects.toThrow('signed in')
  })

  it('throws the supabase error', async () => {
    result = { error: { message: 'only a club admin can post' } }
    await expect(
      createClubAnnouncement({ clubId: 'c1', kind: 'ANNOUNCEMENT', priority: 'NORMAL', body: 'x' })
    ).rejects.toThrow('only a club admin can post')
  })
})

describe('setClubPostPinned', () => {
  it('pins with a timestamp, scoped to the post id', async () => {
    await setClubPostPinned('p1', true)
    const patch = arg('update')?.[0] as Record<string, unknown>
    expect(patch.is_pinned).toBe(true)
    expect(patch.pinned_at).toBeTruthy()
    expect(arg('eq')).toEqual(['id', 'p1'])
  })

  it('clears pinned_at when unpinning', async () => {
    await setClubPostPinned('p1', false)
    const patch = arg('update')?.[0] as Record<string, unknown>
    expect(patch.is_pinned).toBe(false)
    expect(patch.pinned_at).toBeNull()
  })
})

describe('deleteClubPost', () => {
  it('deletes by id', async () => {
    await deleteClubPost('p1')
    expect(arg('delete')).toBeTruthy()
    expect(arg('eq')).toEqual(['id', 'p1'])
  })
})

describe('loadClubPostsAdmin', () => {
  it('returns deduped posts read via the authed client', async () => {
    result = { data: [{ id: 'p1' }], error: null }
    const posts = await loadClubPostsAdmin('c1')
    expect(posts).toEqual([{ id: 'p1' }])
    // read the club-scoped board (never platformDb)
    expect(calls.some((c) => c.table === 'tournament_posts' && c.method === 'eq' && c.args[0] === 'club_id')).toBe(true)
  })
})
