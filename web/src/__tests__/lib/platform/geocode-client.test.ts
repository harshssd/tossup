import { geocode } from '@/lib/platform/geocode-client'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('geocode', () => {
  it('returns coords from the proxy', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ lat: 37.77, lng: -122.42 }) })
    expect(await geocode('San Francisco, US')).toEqual({ lat: 37.77, lng: -122.42 })
    expect(fetchMock).toHaveBeenCalledWith('/api/geocode?q=San%20Francisco%2C%20US')
  })

  it('returns null for a too-short query without calling the API', async () => {
    expect(await geocode(' a ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response, empty result, or network error', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await geocode('Nowhere City')).toBeNull()

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    expect(await geocode('Nowhere City')).toBeNull()

    fetchMock.mockRejectedValue(new Error('network'))
    expect(await geocode('Nowhere City')).toBeNull()
  })
})
