import { createHonor, deleteHonor } from '@/lib/platform/honors-client'

// honors-client wraps the authed browser client. Mock it so we can assert the
// param-name mapping (p_* keys) and the delete/error handling without a network.

const rpc = jest.fn()
const eq = jest.fn()
const del = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ delete: del }))

jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({ rpc, from }),
}))

beforeEach(() => {
  // jest.config resetMocks:true clears implementations before each test, so
  // re-establish the chainable builder (from -> delete -> eq) here.
  rpc.mockReset()
  eq.mockReset()
  del.mockReset().mockReturnValue({ eq })
  from.mockReset().mockReturnValue({ delete: del })
})

describe('createHonor', () => {
  it('maps fields to p_* rpc args and returns the new id', async () => {
    rpc.mockResolvedValue({ data: 'honor-123', error: null })

    const id = await createHonor({
      clubId: 'c1',
      title: 'Bay Area Premier League',
      result: 'CHAMPION',
      year: 2024,
      seasonLabel: 'Summer',
      captainPersonId: 'cap',
      notes: 'won by 12',
      photoUrl: 'http://x/y.png',
      squad: ['s1', 's2'],
    })

    expect(id).toBe('honor-123')
    expect(rpc).toHaveBeenCalledWith('create_honor', {
      p_club_id: 'c1',
      p_title: 'Bay Area Premier League',
      p_result: 'CHAMPION',
      p_year: 2024,
      p_season_label: 'Summer',
      p_captain_person_id: 'cap',
      p_notes: 'won by 12',
      p_photo_url: 'http://x/y.png',
      p_squad: ['s1', 's2'],
    })
  })

  it('coerces empty optionals to undefined and defaults squad to []', async () => {
    rpc.mockResolvedValue({ data: 'honor-9', error: null })

    await createHonor({ clubId: 'c1', title: 'Cup', result: 'RUNNER_UP' })

    expect(rpc).toHaveBeenCalledWith('create_honor', {
      p_club_id: 'c1',
      p_title: 'Cup',
      p_result: 'RUNNER_UP',
      p_year: undefined,
      p_season_label: undefined,
      p_captain_person_id: undefined,
      p_notes: undefined,
      p_photo_url: undefined,
      p_squad: [],
    })
  })

  it('throws the supabase error message', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'only a club admin can add honors' } })
    await expect(createHonor({ clubId: 'c1', title: 'X', result: 'CHAMPION' })).rejects.toThrow(
      'only a club admin can add honors'
    )
  })
})

describe('deleteHonor', () => {
  it('deletes by id', async () => {
    eq.mockResolvedValue({ error: null })
    await deleteHonor('honor-123')
    expect(from).toHaveBeenCalledWith('honors')
    expect(eq).toHaveBeenCalledWith('id', 'honor-123')
  })

  it('throws when the delete is blocked', async () => {
    eq.mockResolvedValue({ error: { message: 'denied' } })
    await expect(deleteHonor('honor-123')).rejects.toThrow('denied')
  })
})
