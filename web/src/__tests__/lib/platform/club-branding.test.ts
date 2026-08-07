import {
  isValidHexColor,
  imageUploadError,
  clubAssetPath,
  clubAssetObjectPath,
  CLUB_ASSET_BUCKET,
  MAX_IMAGE_BYTES,
} from '@/lib/platform/club-branding'

describe('isValidHexColor', () => {
  it('accepts 6-digit hex (either case)', () => {
    expect(isValidHexColor('#1f9d57')).toBe(true)
    expect(isValidHexColor('#ABCDEF')).toBe(true)
  })
  it('rejects names, shorthands, and malformed values', () => {
    expect(isValidHexColor('red')).toBe(false)
    expect(isValidHexColor('#fff')).toBe(false)
    expect(isValidHexColor('1f9d57')).toBe(false)
    expect(isValidHexColor('#1f9d5')).toBe(false)
    expect(isValidHexColor('#1f9d57;color:red')).toBe(false)
  })
})

describe('imageUploadError', () => {
  it('allows png/jpeg/webp under the size cap', () => {
    expect(imageUploadError({ type: 'image/png', size: 1000 })).toBeNull()
    expect(imageUploadError({ type: 'image/webp', size: MAX_IMAGE_BYTES })).toBeNull()
  })
  it('rejects non-image and oversize files', () => {
    expect(imageUploadError({ type: 'image/gif', size: 1000 })).toMatch(/PNG, JPG, or WebP/)
    expect(imageUploadError({ type: 'application/pdf', size: 10 })).toMatch(/PNG, JPG, or WebP/)
    expect(imageUploadError({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/3 MB/)
  })
})

describe('clubAssetPath', () => {
  it('keys the path on the club id with a mime-derived extension and token', () => {
    expect(clubAssetPath('club-1', 'crest', 'image/jpeg', 1700)).toBe('club-1/crest-1700.jpg')
    expect(clubAssetPath('club-1', 'cover', 'image/webp', 42)).toBe('club-1/cover-42.webp')
    expect(clubAssetPath('club-1', 'crest', 'image/png', 1)).toBe('club-1/crest-1.png')
  })
  it('defaults an unknown mime to png', () => {
    expect(clubAssetPath('c', 'crest', 'image/tiff', 9)).toBe('c/crest-9.png')
  })
})

describe('clubAssetObjectPath', () => {
  const base = `https://proj.supabase.co/storage/v1/object/public/${CLUB_ASSET_BUCKET}`

  it('extracts the object path from a club-assets public URL', () => {
    expect(clubAssetObjectPath(`${base}/club1/crest-100.png`)).toBe('club1/crest-100.png')
  })

  it('round-trips a clubAssetPath', () => {
    const p = clubAssetPath('club-xyz', 'cover', 'image/webp', 55)
    expect(clubAssetObjectPath(`${base}/${p}`)).toBe(p)
  })

  it('strips a query string / hash the CDN may append', () => {
    expect(clubAssetObjectPath(`${base}/club1/crest-100.png?width=64`)).toBe('club1/crest-100.png')
    expect(clubAssetObjectPath(`${base}/club1/crest-100.png#x`)).toBe('club1/crest-100.png')
  })

  it('decodes percent-encoded path segments', () => {
    expect(clubAssetObjectPath(`${base}/club1/crest%2D100.png`)).toBe('club1/crest-100.png')
  })

  it('returns null for an off-bucket URL (never target what we did not upload)', () => {
    expect(clubAssetObjectPath('https://example.com/logo.png')).toBeNull()
    expect(clubAssetObjectPath('https://proj.supabase.co/storage/v1/object/public/other-bucket/x.png')).toBeNull()
  })

  it('returns null when the object path is empty', () => {
    expect(clubAssetObjectPath(`${base}/`)).toBeNull()
  })
})
