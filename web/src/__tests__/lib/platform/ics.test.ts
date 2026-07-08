import { escapeICSText, formatICSDate, foldICSLine, buildClubCalendar } from '@/lib/platform/ics'
import type { ClubEvent } from '@/lib/platform/events'

function makeEvent(over: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: 'e1',
    club_id: 'c1',
    title: 'Nets',
    description: null,
    event_type: 'PRACTICE',
    location: null,
    starts_at: '2026-07-10T18:00:00.000Z',
    ends_at: '2026-07-10T20:00:00.000Z',
    created_by: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
    ...over,
  }
}

describe('escapeICSText', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(escapeICSText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d')
    expect(escapeICSText('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3')
  })
  it('escapes backslash before other specials (order-safe)', () => {
    // a literal backslash then comma must become \\ then \,  — not \\,
    expect(escapeICSText('\\,')).toBe('\\\\\\,')
  })
})

describe('formatICSDate', () => {
  it('formats ISO to UTC basic DATE-TIME with Z', () => {
    expect(formatICSDate('2026-07-10T18:05:09.000Z')).toBe('20260710T180509Z')
  })
  it('converts a non-UTC offset to UTC', () => {
    expect(formatICSDate('2026-07-10T18:00:00+02:00')).toBe('20260710T160000Z')
  })
  it('throws on an invalid date', () => {
    expect(() => formatICSDate('not-a-date')).toThrow('invalid date')
  })
})

describe('foldICSLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldICSLine('SUMMARY:hi')).toBe('SUMMARY:hi')
  })
  it('folds lines over 75 octets with a leading space, each segment ≤75', () => {
    const long = 'DESCRIPTION:' + 'x'.repeat(200)
    const folded = foldICSLine(long)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75)
    // Continuation lines start with a space; unfolding reconstructs the original.
    parts.slice(1).forEach((p) => expect(p.startsWith(' ')).toBe(true))
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(long)
  })
  it('never splits a multibyte code point across a fold', () => {
    const folded = foldICSLine('X:' + '🏏'.repeat(40)) // each bat is 4 octets
    for (const p of folded.split('\r\n')) {
      expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75)
      expect(p).not.toContain('�') // no broken surrogate
    }
  })
})

describe('buildClubCalendar', () => {
  const club = { name: 'Oval CC', slug: 'oval-cc' }

  it('wraps events in a valid VCALENDAR envelope with CRLF endings', () => {
    const ics = buildClubCalendar(club, [makeEvent()], 'https://tossup.app')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//TossUp//Club Events//EN')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('emits DTSTART/DTEND/SUMMARY/UID and a club URL', () => {
    const ics = buildClubCalendar(club, [makeEvent()], 'https://tossup.app')
    expect(ics).toContain('DTSTART:20260710T180000Z')
    expect(ics).toContain('DTEND:20260710T200000Z')
    expect(ics).toContain('SUMMARY:Nets')
    expect(ics).toContain('UID:club-event-e1@tossup.app')
    expect(ics).toContain('URL:https://tossup.app/club/oval-cc')
    expect(ics).toContain('CATEGORIES:PRACTICE')
  })

  it('defaults a 2h block when ends_at is null', () => {
    const ics = buildClubCalendar(club, [makeEvent({ ends_at: null })], '')
    expect(ics).toContain('DTSTART:20260710T180000Z')
    expect(ics).toContain('DTEND:20260710T200000Z') // +2h
  })

  it('omits DESCRIPTION/LOCATION when absent and includes+escapes them when present', () => {
    const bare = buildClubCalendar(club, [makeEvent()], '')
    expect(bare).not.toContain('DESCRIPTION:')
    expect(bare).not.toContain('LOCATION:')

    const full = buildClubCalendar(club, [makeEvent({ description: 'Bring pads, whites', location: 'The Oval; Gate 3' })], '')
    expect(full).toContain('DESCRIPTION:Bring pads\\, whites')
    expect(full).toContain('LOCATION:The Oval\\; Gate 3')
  })

  it('renders multiple events and an empty calendar', () => {
    const two = buildClubCalendar(club, [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })], 'https://tossup.app')
    expect(two.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(two).toContain('UID:club-event-a@tossup.app')
    expect(two).toContain('UID:club-event-b@tossup.app')

    const none = buildClubCalendar(club, [], '')
    expect(none).toContain('BEGIN:VCALENDAR')
    expect(none).not.toContain('BEGIN:VEVENT')
  })

  it('falls back to a stable UID host and no URL when origin is empty', () => {
    const ics = buildClubCalendar(club, [makeEvent()], '')
    expect(ics).toContain('UID:club-event-e1@tossup')
    expect(ics).not.toContain('URL:')
  })
})
