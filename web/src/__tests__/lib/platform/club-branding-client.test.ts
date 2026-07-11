import { uploadClubImage, setClubAccent, removeClubImage } from '@/lib/platform/club-branding-client'

// Wraps the authed browser client's Storage + clubs table (both RLS-gated).
const upload = jest.fn()
const getPublicUrl = jest.fn()
const from = jest.fn()

let updatePayload: Record<string, unknown> | null
let eqArgs: unknown[] | null
let dbResult: { error?: unknown }

jest.mock('@/lib/platform/auth-browser', () => ({
  createPlatformBrowserClient: () => ({
    storage: { from: () => ({ upload, getPublicUrl }) },
    from,
  }),
}))

beforeEach(() => {
  updatePayload = null
  eqArgs = null
  dbResult = { error: null }
  upload.mockReset().mockResolvedValue({ error: null })
  getPublicUrl.mockReset().mockReturnValue({ data: { publicUrl: 'https://cdn/x.png' } })
  from.mockReset().mockImplementation(() => ({
    update: (v: Record<string, unknown>) => {
      updatePayload = v
      return {
        eq: (...args: unknown[]) => {
          eqArgs = args
          return Promise.resolve(dbResult)
        },
      }
    },
  }))
})

const pngFile = () => new File(['xxxx'], 'crest.png', { type: 'image/png' })

describe('uploadClubImage', () => {
  it('uploads under the club-id-keyed path and saves the public URL to the column', async () => {
    const url = await uploadClubImage('club1', 'crest', pngFile())
    expect(url).toBe('https://cdn/x.png')
    const [path, , opts] = upload.mock.calls[0]
    expect(path).toMatch(/^club1\/crest-\d+\.png$/)
    expect(opts).toEqual({ contentType: 'image/png' })
    expect(updatePayload).toEqual({ crest_url: 'https://cdn/x.png' })
    expect(eqArgs).toEqual(['id', 'club1'])
  })

  it('rejects a disallowed file type before touching storage', async () => {
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' })
    await expect(uploadClubImage('club1', 'cover', gif)).rejects.toThrow(/PNG, JPG, or WebP/)
    expect(upload).not.toHaveBeenCalled()
  })

  it('surfaces a storage RLS denial', async () => {
    upload.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })
    await expect(uploadClubImage('club1', 'crest', pngFile())).rejects.toThrow(/row-level security/)
  })
})

describe('setClubAccent', () => {
  it('saves a valid hex', async () => {
    await setClubAccent('club1', '#1f9d57')
    expect(updatePayload).toEqual({ accent_color: '#1f9d57' })
    expect(eqArgs).toEqual(['id', 'club1'])
  })

  it('clears with null', async () => {
    await setClubAccent('club1', null)
    expect(updatePayload).toEqual({ accent_color: null })
  })

  it('rejects an invalid hex without a db call', async () => {
    await expect(setClubAccent('club1', 'red')).rejects.toThrow(/hex colour/)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('removeClubImage', () => {
  it('nulls the crest column', async () => {
    await removeClubImage('club1', 'crest')
    expect(updatePayload).toEqual({ crest_url: null })
    expect(eqArgs).toEqual(['id', 'club1'])
  })
})
