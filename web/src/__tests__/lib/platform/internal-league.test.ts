import { createInternalLeague } from '@/lib/platform/tournament-host'

// createInternalLeague delegates to createOwnedTournament, which inserts a
// leagues row as the authed user. Mock the browser client to assert the payload
// (club-scoped, PRIVATE) without a network.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leagueInsertArg: any
const getUser = jest.fn()
const from = jest.fn()

jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({ auth: { getUser }, from }),
}))

beforeEach(() => {
  leagueInsertArg = undefined
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  from.mockReset().mockImplementation((table: string) => {
    if (table === 'leagues') {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert: (arg: any) => {
          leagueInsertArg = arg
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'lg9', ...arg }, error: null }) }) }
        },
      }
    }
    if (table === 'users') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { primary_person_id: 'p1' }, error: null }) }) }) }
    }
    if (table === 'league_memberships') {
      return { insert: () => Promise.resolve({ error: null }) }
    }
    return {}
  })
})

describe('createInternalLeague', () => {
  it('creates a PRIVATE, club-scoped LEAGUE owned by the caller', async () => {
    const lg = await createInternalLeague('club1', { name: 'Winter Net League', format: 'T20' })
    expect(leagueInsertArg).toEqual({
      name: 'Winter Net League',
      type: 'LEAGUE',
      format: 'T20',
      club_id: 'club1',
      visibility: 'PRIVATE',
      owner_id: 'u1',
    })
    expect(lg.id).toBe('lg9')
  })

  it('defaults format to null and stays PRIVATE + club-scoped', async () => {
    await createInternalLeague('club1', { name: 'Practice Ladder' })
    expect(leagueInsertArg.format).toBeNull()
    expect(leagueInsertArg.visibility).toBe('PRIVATE')
    expect(leagueInsertArg.club_id).toBe('club1')
    expect(leagueInsertArg.type).toBe('LEAGUE')
  })
})
