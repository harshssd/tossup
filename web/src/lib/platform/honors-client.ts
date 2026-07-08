'use client'

import { createPlatformBrowserClient } from './auth-browser'
import { readClubHonors, type HonorResult, type HonorView } from './honors'

/** Authed read for the admin manage screen (sees a PRIVATE club's honors too). */
export function loadClubHonors(clubId: string): Promise<HonorView[]> {
  return readClubHonors(createPlatformBrowserClient(), clubId)
}

// Honors board writes. Run as the authenticated user; RLS + the create_honor
// SECURITY DEFINER function (not these helpers) are the gate.

export interface NewHonor {
  clubId: string
  title: string
  result: HonorResult
  year?: number | null
  seasonLabel?: string | null
  captainPersonId?: string | null
  notes?: string | null
  photoUrl?: string | null
  /** Person ids from the club roster who played. */
  squad?: string[]
}

/** Add an honor (with captain + squad) atomically via create_honor. Admin-only. */
export async function createHonor(input: NewHonor): Promise<string> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.rpc('create_honor', {
    p_club_id: input.clubId,
    p_title: input.title,
    p_result: input.result,
    p_year: input.year ?? undefined,
    p_season_label: input.seasonLabel ?? undefined,
    p_captain_person_id: input.captainPersonId ?? undefined,
    p_notes: input.notes ?? undefined,
    p_photo_url: input.photoUrl ?? undefined,
    p_squad: input.squad ?? [],
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Delete an honor (squad rows cascade). Admin-only via RLS. */
export async function deleteHonor(honorId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('honors').delete().eq('id', honorId)
  if (error) throw new Error(error.message)
}
