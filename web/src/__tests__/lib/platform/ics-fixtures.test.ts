import { buildFixturesCalendar } from '@/lib/platform/ics'

const league = { id: 'league-1', name: 'Bay Premier' }
const fx = (over: Partial<Parameters<typeof buildFixturesCalendar>[1][number]> = {}) => ({
  id: 'f1',
  team_a_name: 'Sidewinders',
  team_b_name: 'Blasters',
  venue: 'Oval Park',
  scheduled_at: '2026-07-12T14:30:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  ...over,
})

describe('buildFixturesCalendar', () => {
  it('emits a valid VCALENDAR with a 3h match block', () => {
    const ics = buildFixturesCalendar(league, [fx()])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:fixture-f1@tossup.app')
    expect(ics).toContain('DTSTART:20260712T143000Z')
    expect(ics).toContain('DTEND:20260712T173000Z')
    expect(ics).toContain('SUMMARY:Sidewinders vs Blasters — Bay Premier')
    expect(ics).toContain('LOCATION:Oval Park')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('skips fixtures without a scheduled time and handles TBD teams', () => {
    const ics = buildFixturesCalendar(league, [fx({ scheduled_at: null }), fx({ id: 'f2', team_a_name: null })])
    expect(ics).not.toContain('fixture-f1@')
    expect(ics).toContain('SUMMARY:TBD vs Blasters — Bay Premier')
  })

  it('uses the trusted base URL for host + URL, never a request host', () => {
    const ics = buildFixturesCalendar(league, [fx()], 'https://tossup.app')
    expect(ics).toContain('UID:fixture-f1@tossup.app')
    expect(ics).toContain('URL:https://tossup.app/tournaments/league-1')
    const bad = buildFixturesCalendar(league, [fx()], 'not a url')
    expect(bad).toContain('UID:fixture-f1@tossup.app')
    expect(bad).not.toContain('URL:')
  })
})
