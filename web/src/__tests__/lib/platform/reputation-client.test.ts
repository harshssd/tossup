import { requestReputationRecompute } from '@/lib/platform/reputation-client'

const rpc = jest.fn()
jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({ rpc }),
}))

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null })
})

describe('requestReputationRecompute', () => {
  it('calls the admin-gated recompute RPC', async () => {
    await requestReputationRecompute()
    expect(rpc).toHaveBeenCalledWith('request_reputation_recompute')
  })

  it('surfaces the RPC error (e.g. not authorized)', async () => {
    rpc.mockResolvedValue({ error: { message: 'not authorized' } })
    await expect(requestReputationRecompute()).rejects.toThrow('not authorized')
  })
})
