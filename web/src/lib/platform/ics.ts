import type { ClubEvent } from './events'

// iCalendar (RFC 5545) serialization for a club's events feed. Pure + unit-tested;
// no I/O, so the route handler just fetches rows and hands them here.

// Open-ended events (ends_at null) get a sensible default block so calendar apps
// render a visible slot instead of a zero-length instant.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

/** Escape a TEXT value per RFC 5545 §3.3.11: backslash, semicolon, comma, newline. */
export function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** ISO timestamp → UTC "basic format" DATE-TIME (YYYYMMDDTHHMMSSZ). */
export function formatICSDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date for ICS: ${iso}`)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

function utf8Len(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  if (c <= 0x7f) return 1
  if (c <= 0x7ff) return 2
  if (c <= 0xffff) return 3
  return 4
}

/** Fold a content line to ≤75 octets per RFC 5545 §3.1, continuing with a leading
 *  space. Octet-aware and code-point-safe (never splits a multibyte char). */
export function foldICSLine(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = utf8Len(ch)
    if (bytes + b > 75) {
      out.push(cur)
      cur = ' ' + ch // continuation lines start with a space (counts toward 75)
      bytes = 1 + b
    } else {
      cur += ch
      bytes += b
    }
  }
  out.push(cur)
  return out.join('\r\n')
}

function prop(name: string, value: string): string {
  return foldICSLine(`${name}:${value}`)
}

function vevent(e: ClubEvent, host: string, clubUrl: string | null): string[] {
  const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + DEFAULT_DURATION_MS).toISOString()
  const lines = [
    'BEGIN:VEVENT',
    `UID:club-event-${e.id}@${host}`,
    prop('DTSTAMP', formatICSDate(e.updated_at || e.created_at || e.starts_at)),
    prop('DTSTART', formatICSDate(e.starts_at)),
    prop('DTEND', formatICSDate(end)),
    prop('SUMMARY', escapeICSText(e.title)),
    `CATEGORIES:${e.event_type}`,
  ]
  if (e.description) lines.push(prop('DESCRIPTION', escapeICSText(e.description)))
  if (e.location) lines.push(prop('LOCATION', escapeICSText(e.location)))
  if (clubUrl) lines.push(prop('URL', clubUrl))
  lines.push('END:VEVENT')
  return lines
}

export interface CalendarClub {
  name: string
  slug: string | null
}

// Fixed UID authority — UIDs only need to be globally unique + stable, not a real
// host. Deliberately NOT request-derived, so a poisoned Host header can't rewrite
// UIDs/URLs in a (CDN-)cached feed.
const UID_HOST = 'tossup.app'

/** Build a complete VCALENDAR for a club's events. `baseUrl` must be a TRUSTED,
 *  server-configured origin (e.g. env NEXT_PUBLIC_SITE_URL) — never the request
 *  host. When absent, per-event URLs are omitted rather than pointing somewhere
 *  attacker-controllable. */
export function buildClubCalendar(club: CalendarClub, events: ClubEvent[], baseUrl?: string): string {
  let host = UID_HOST
  let clubUrl: string | null = null
  if (baseUrl) {
    try {
      const u = new URL(baseUrl)
      host = u.host || UID_HOST
      // encodeURIComponent the slug so it can never smuggle CRLF/property lines into the feed.
      clubUrl = club.slug ? `${baseUrl.replace(/\/$/, '')}/club/${encodeURIComponent(club.slug)}` : null
    } catch {
      // malformed baseUrl → keep the safe defaults (fixed host, no URL)
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TossUp//Club Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Nudge subscribing clients to re-poll hourly (matches the route's Cache-Control).
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    prop('X-WR-CALNAME', escapeICSText(`${club.name} — TossUp`)),
    prop('X-WR-CALDESC', escapeICSText(`Events for ${club.name} on TossUp`)),
    ...events.flatMap((e) => vevent(e, host, clubUrl)),
    'END:VCALENDAR',
  ]
  // RFC 5545 requires CRLF line breaks and a trailing CRLF.
  return lines.join('\r\n') + '\r\n'
}

// ---------------- Tournament fixtures calendar (2026-08 "good to great") ----------------

export interface CalendarLeague {
  id: string
  name: string
}

export interface CalendarFixture {
  id: string
  team_a_name: string | null
  team_b_name: string | null
  venue: string | null
  scheduled_at: string | null
  updated_at: string | null
}

// Cricket matches run long — block 3 hours by default.
const FIXTURE_DURATION_MS = 3 * 60 * 60 * 1000

function fixtureVevent(f: CalendarFixture, host: string, leagueName: string, leagueUrl: string | null): string[] {
  // Callers pre-filter to scheduled_at != null; guard anyway.
  if (!f.scheduled_at) return []
  const end = new Date(new Date(f.scheduled_at).getTime() + FIXTURE_DURATION_MS).toISOString()
  const title = `${f.team_a_name ?? 'TBD'} vs ${f.team_b_name ?? 'TBD'}`
  const lines = [
    'BEGIN:VEVENT',
    `UID:fixture-${f.id}@${host}`,
    prop('DTSTAMP', formatICSDate(f.updated_at || f.scheduled_at)),
    prop('DTSTART', formatICSDate(f.scheduled_at)),
    prop('DTEND', formatICSDate(end)),
    prop('SUMMARY', escapeICSText(`${title} — ${leagueName}`)),
    'CATEGORIES:MATCH',
  ]
  if (f.venue) lines.push(prop('LOCATION', escapeICSText(f.venue)))
  if (leagueUrl) lines.push(prop('URL', leagueUrl))
  lines.push('END:VEVENT')
  return lines
}

/** Build a VCALENDAR of a tournament's scheduled fixtures ("the season in your
 *  calendar"). Same trust rules as buildClubCalendar: `baseUrl` must be a
 *  TRUSTED server-configured origin, never the request host. */
export function buildFixturesCalendar(league: CalendarLeague, fixtures: CalendarFixture[], baseUrl?: string): string {
  let host = UID_HOST
  let leagueUrl: string | null = null
  if (baseUrl) {
    try {
      const u = new URL(baseUrl)
      host = u.host || UID_HOST
      leagueUrl = `${baseUrl.replace(/\/$/, '')}/tournaments/${encodeURIComponent(league.id)}`
    } catch {
      // malformed baseUrl → safe defaults
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TossUp//Tournament Fixtures//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    prop('X-WR-CALNAME', escapeICSText(`${league.name} — fixtures`)),
    prop('X-WR-CALDESC', escapeICSText(`Match schedule for ${league.name} on TossUp`)),
    ...fixtures.flatMap((f) => fixtureVevent(f, host, league.name, leagueUrl)),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}
