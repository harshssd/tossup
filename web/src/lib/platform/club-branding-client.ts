'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { createPlatformBrowserClient } from './auth-browser'
import { CLUB_ASSET_BUCKET, clubAssetObjectPath, clubAssetPath, imageUploadError, isValidHexColor } from './club-branding'

export interface ClubBranding {
  crest_url: string | null
  cover_url: string | null
  accent_color: string | null
}

/** Best-effort delete of a replaced/removed club-asset object so the bucket
 *  doesn't accumulate orphans. Never throws: the column change is the source of
 *  truth, and storage RLS (club_assets_admin_delete) already scopes the delete to
 *  this club's admins. Off-bucket URLs (clubAssetObjectPath → null) are skipped so
 *  we never touch something we didn't upload. */
async function cleanupReplacedAsset(supabase: SupabaseClient<Database>, oldUrl: string | null): Promise<void> {
  if (!oldUrl) return
  const path = clubAssetObjectPath(oldUrl)
  if (!path) return
  try {
    await supabase.storage.from(CLUB_ASSET_BUCKET).remove([path])
  } catch {
    // Orphaned object is acceptable — the crest/cover column already changed.
  }
}

export async function loadClubBranding(clubId: string): Promise<ClubBranding> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.from('clubs').select('crest_url, cover_url, accent_color').eq('id', clubId).maybeSingle()
  if (error) throw new Error(error.message)
  return { crest_url: data?.crest_url ?? null, cover_url: data?.cover_url ?? null, accent_color: data?.accent_color ?? null }
}

/** Upload a crest/cover image to Storage (RLS: only this club's admins) and save
 *  the public URL onto the club. Deletes the previously-stored image best-effort.
 *  Returns the new URL. */
export async function uploadClubImage(clubId: string, kind: 'crest' | 'cover', file: File): Promise<string> {
  const err = imageUploadError(file)
  if (err) throw new Error(err)

  const supabase = createPlatformBrowserClient()
  const column = kind === 'crest' ? 'crest_url' : 'cover_url'

  // Capture the current image up front so we can clean it up after the swap.
  const { data: existing } = await supabase.from('clubs').select('crest_url, cover_url').eq('id', clubId).maybeSingle()
  const oldUrl = existing?.[column] ?? null

  const path = clubAssetPath(clubId, kind, file.type, Date.now())
  const { error: upErr } = await supabase.storage.from(CLUB_ASSET_BUCKET).upload(path, file, { contentType: file.type })
  if (upErr) throw new Error(upErr.message)

  const { data } = supabase.storage.from(CLUB_ASSET_BUCKET).getPublicUrl(path)
  const url = data.publicUrl
  const { error: dbErr } = await supabase.from('clubs').update({ [column]: url }).eq('id', clubId)
  if (dbErr) throw new Error(dbErr.message)

  await cleanupReplacedAsset(supabase, oldUrl)
  return url
}

/** Clear a crest/cover from the club and delete the storage object best-effort. */
export async function removeClubImage(clubId: string, kind: 'crest' | 'cover'): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const column = kind === 'crest' ? 'crest_url' : 'cover_url'

  const { data: existing } = await supabase.from('clubs').select('crest_url, cover_url').eq('id', clubId).maybeSingle()
  const oldUrl = existing?.[column] ?? null

  const { error } = await supabase.from('clubs').update({ [column]: null }).eq('id', clubId)
  if (error) throw new Error(error.message)

  await cleanupReplacedAsset(supabase, oldUrl)
}

/** Set (or clear with null) the club's accent colour. Validated to a hex here and
 *  by the DB CHECK. */
export async function setClubAccent(clubId: string, hex: string | null): Promise<void> {
  if (hex && !isValidHexColor(hex)) throw new Error('Enter a hex colour like #1f9d57')
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('clubs').update({ accent_color: hex }).eq('id', clubId)
  if (error) throw new Error(error.message)
}
