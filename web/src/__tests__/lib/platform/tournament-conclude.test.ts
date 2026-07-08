import { concludeTournament, getMyAdminClubs } from '@/lib/platform/tournament-host'

// tournament-host wraps the authed browser client. Mock it to assert the RPC
// param mapping and error handling without a network.

const rpc = jest.fn()

jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({ rpc }),
}))

beforeEach(() => {
  rpc.mockReset()
})

describe('concludeTournament', () => {
  it('passes champion + runner-up to the rpc and returns the honor count', async () => {
    rpc.mockResolvedValue({ data: 2, error: null })
    const written = await concludeTournament('lg1', 'champ', 'runner')
    expect(written).toBe(2)
    expect(rpc).toHaveBeenCalledWith('conclude_tournament', {
      p_league_id: 'lg1',
      p_champion_team_id: 'champ',
      p_runner_up_team_id: 'runner',
    })
  })

  it('omits runner-up when not given (undefined, not null)', async () => {
    rpc.mockResolvedValue({ data: 1, error: null })
    await concludeTournament('lg1', 'champ', null)
    expect(rpc).toHaveBeenCalledWith('conclude_tournament', {
      p_league_id: 'lg1',
      p_champion_team_id: 'champ',
      p_runner_up_team_id: undefined,
    })
  })

  it('returns 0 when no verified honors were written (no registered clubs)', async () => {
    rpc.mockResolvedValue({ data: 0, error: null })
    expect(await concludeTournament('lg1', 'champ')).toBe(0)
  })

  it('coerces a null rpc payload to 0', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await concludeTournament('lg1', 'champ')).toBe(0)
  })

  it('throws the rpc error message', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'only a tournament host can conclude it' } })
    await expect(concludeTournament('lg1', 'champ')).rejects.toThrow('only a tournament host can conclude it')
  })
})

describe('getMyAdminClubs', () => {
  it('returns the admin clubs', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'c1', name: 'Strikers', slug: 'strikers' }], error: null })
    const clubs = await getMyAdminClubs()
    expect(rpc).toHaveBeenCalledWith('list_my_admin_clubs')
    expect(clubs).toEqual([{ id: 'c1', name: 'Strikers', slug: 'strikers' }])
  })

  it('degrades to an empty list on error (never blocks the register form)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope' } })
    expect(await getMyAdminClubs()).toEqual([])
  })
})
