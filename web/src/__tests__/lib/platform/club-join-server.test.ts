import { getViewerJoinState } from '@/lib/platform/club-join'

// getViewerJoinState picks which join affordance the club page renders, so its
// mapping (signed-out short-circuit, isMember coercion, latest-request status)
// is worth a direct test. Mock the authed server client.

const getUser = jest.fn()
const rpc = jest.fn()
let reqResult: { data: { status: string } | null }

function fromChain() {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b
  b.maybeSingle = async () => reqResult
  return b
}

jest.mock('@/lib/platform/auth-server', () => ({
  createPlatformServerClient: async () => ({ auth: { getUser }, rpc, from: () => fromChain() }),
}))

beforeEach(() => {
  reqResult = { data: null }
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user1' } } })
  rpc.mockReset().mockResolvedValue({ data: false })
})

it('returns a signed-out state without querying when there is no user', async () => {
  getUser.mockResolvedValue({ data: { user: null } })
  const state = await getViewerJoinState('club1')
  expect(state).toEqual({ signedIn: false, isMember: false, requestStatus: null })
  expect(rpc).not.toHaveBeenCalled()
})

it('reports membership from the is_club_member RPC (strict true)', async () => {
  rpc.mockResolvedValue({ data: true })
  expect((await getViewerJoinState('club1')).isMember).toBe(true)

  rpc.mockResolvedValue({ data: null }) // non-true → not a member
  expect((await getViewerJoinState('club1')).isMember).toBe(false)
})

it('flows the latest request status through, or null when none', async () => {
  reqResult = { data: { status: 'PENDING' } }
  expect((await getViewerJoinState('club1')).requestStatus).toBe('PENDING')

  reqResult = { data: null }
  expect((await getViewerJoinState('club1')).requestStatus).toBeNull()
})
