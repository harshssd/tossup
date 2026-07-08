import {
  createClubAnnouncement,
  setClubPostPinned,
  deleteClubPost,
  loadClubPostsAdmin,
} from '@/lib/platform/pavilion-client'
import { listClubPosts } from '@/lib/platform/pavilion'

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

describe('listClubPosts sticky-merge', () => {
  // A hand-rolled db whose two queries (recent, then sticky) resolve, in call
  // order, to the queued page results. Exercises the reason for the two-query
  // design: a pinned post outside the recent-200 window must still be merged in.
  function makeDb(pages: { data: unknown[] }[]) {
    let i = 0
    return {
      from() {
        const b: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b
        const page = pages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        b.then = (resolve: (v: any) => void) => resolve({ data: page[i++]?.data ?? [], error: null })
        return b
      },
    }
  }

  it('merges a pinned post outside the recent window, deduped by id', async () => {
    const db = makeDb([
      { data: [{ id: 'a' }, { id: 'b' }] }, // recent 200 (no pinned 'z')
      { data: [{ id: 'z' }, { id: 'b' }] }, // sticky pinned rows ('z' is old, 'b' overlaps)
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = await listClubPosts('c1', db as any)
    expect(posts.map((p) => p.id).sort()).toEqual(['a', 'b', 'z']) // union, 'b' not duplicated
  })
})
