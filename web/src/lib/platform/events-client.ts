'use client'

import { createPlatformBrowserClient } from './auth-browser'
import { readClubEvents, type EventType, type EventWithCounts, type RsvpStatus } from './events'

// Club event writes + RSVP. Run as the authenticated user; RLS is the gate
// (admins write events; any signed-in user RSVPs to an event they can see).

export interface NewEvent {
  clubId: string
  title: string
  eventType: EventType
  startsAt: string
  endsAt?: string | null
  location?: string | null
  description?: string | null
}

/** Authed read for the manage screen (sees a PRIVATE club's events + past ones).
 *  Counts come from the raw RSVP rows so PRIVATE clubs — excluded from the public
 *  counts view — still show real attendance. */
export function loadClubEventsAdmin(clubId: string): Promise<EventWithCounts[]> {
  return readClubEvents(createPlatformBrowserClient(), clubId, { upcoming: false, countsFromRsvps: true })
}

/** Create an event. Admin-only via RLS (created_by must be the caller). */
export async function createEvent(input: NewEvent): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase.from('club_events').insert({
    club_id: input.clubId,
    title: input.title,
    event_type: input.eventType,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
}

/** Delete an event (RSVPs cascade). Admin-only via RLS. */
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('club_events').delete().eq('id', eventId)
  if (error) throw new Error(error.message)
}

/** Set (upsert) the current user's RSVP for an event. */
export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to RSVP')
  const { error } = await supabase
    .from('event_rsvps')
    .upsert(
      { event_id: eventId, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' }
    )
  if (error) throw new Error(error.message)
}

/** Clear the current user's RSVP for an event. */
export async function clearRsvp(eventId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)
  if (error) throw new Error(error.message)
}

/** The current user's RSVP status per event id (empty when signed out). */
export async function getMyRsvps(eventIds: string[]): Promise<Record<string, RsvpStatus>> {
  if (!eventIds.length) return {}
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase
    .from('event_rsvps')
    .select('event_id, status')
    .eq('user_id', user.id)
    .in('event_id', eventIds)
  const out: Record<string, RsvpStatus> = {}
  for (const r of data ?? []) out[r.event_id] = r.status
  return out
}
