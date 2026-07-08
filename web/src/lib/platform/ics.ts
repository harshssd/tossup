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

/** Build a complete VCALENDAR for a club's events. `origin` (e.g. https://tossup.app)
 *  seeds stable UIDs and the club URL; pass '' if unknown. */
export function buildClubCalendar(club: CalendarClub, events: ClubEvent[], origin: string): string {
  let host = 'tossup'
  try {
    if (origin) host = new URL(origin).host || host
  } catch {
    // leave the fallback host
  }
  const clubUrl = origin && club.slug ? `${origin.replace(/\/$/, '')}/club/${club.slug}` : null

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TossUp//Club Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    prop('X-WR-CALNAME', escapeICSText(`${club.name} — TossUp`)),
    prop('X-WR-CALDESC', escapeICSText(`Events for ${club.name} on TossUp`)),
    ...events.flatMap((e) => vevent(e, host, clubUrl)),
    'END:VCALENDAR',
  ]
  // RFC 5545 requires CRLF line breaks and a trailing CRLF.
  return lines.join('\r\n') + '\r\n'
}
