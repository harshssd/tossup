// Pure helpers for club branding (crest/cover/accent). Kept free of client deps
// so they're unit-tested and shared by the uploader + validation. Enforcement is
// belt-and-suspenders: also enforced by the Storage bucket (size/mime) and a DB
// CHECK (accent hex).

export const CLUB_ASSET_BUCKET = 'club-assets'
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024 // 3 MB — matches the bucket limit
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** A 6-digit hex like #1f9d57 (matches the clubs_accent_color_hex DB CHECK). */
export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** Validate a chosen image before upload. Returns an error message, or null if ok. */
export function imageUploadError(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Use a PNG, JPG, or WebP image'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be 3 MB or smaller'
  }
  return null
}

/** Storage object path for a club asset. Keyed by club id (first path segment)
 *  so storage RLS can gate writes; a unique token avoids CDN cache staleness. */
export function clubAssetPath(clubId: string, kind: 'crest' | 'cover', mimeType: string, token: number): string {
  const ext = EXT_BY_TYPE[mimeType] ?? 'png'
  return `${clubId}/${kind}-${token}.${ext}`
}

/** Extract the storage object path (`{clubId}/{kind}-{token}.{ext}`) from a
 *  club-asset public URL, so a replaced/removed image can be deleted — and so the
 *  embed can render only first-party uploads. Returns null when the URL is NOT a
 *  club-assets object (e.g. an off-bucket URL an admin set directly), so cleanup
 *  never targets something we didn't upload. Anchored on the URL's PATH (not a
 *  substring search) so a marker hidden in a query string can't be mistaken for a
 *  real object path. */
export function clubAssetObjectPath(publicUrl: string): string | null {
  const prefix = `/storage/v1/object/public/${CLUB_ASSET_BUCKET}/`
  let pathname: string
  try {
    pathname = new URL(publicUrl).pathname
  } catch {
    return null
  }
  if (!pathname.startsWith(prefix)) return null
  const raw = pathname.slice(prefix.length)
  if (!raw) return null
  try {
    return raw.split('/').map(decodeURIComponent).join('/')
  } catch {
    return null
  }
}
