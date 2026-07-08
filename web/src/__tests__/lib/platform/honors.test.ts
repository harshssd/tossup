import { readClubHonors, getPlayerHonors } from '@/lib/platform/honors'
import { platformDb } from '@/lib/platform/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// honors.ts reads via a supabase client. We mock @/lib/platform/db (the anon
// platformDb) with a thenable query builder that returns queued results per
// table, in call order — so we test the assembly/dedup/sort logic without a DB.

type Row = Record<string, unknown>
let queues: Record<string, Row[][]>
// Records every filter call so tests can assert the right column was queried,
// not just that the queue order happened to line up.
let calls: Array<{ table: string; method: string; args: unknown[] }>

jest.mock('@/lib/platform/db', () => {
  const build = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        calls.push({ table, method: m, args })
        return b
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    b.then = (resolve: (v: any) => void) => resolve({ data: (queues[table] ?? []).shift() ?? [] })
    return b
  }
  return { platformDb: { from: (table: string) => build(table) } }
})

beforeEach(() => {
  queues = {}
  calls = []
})

const filtered = (table: string, method: string) =>
  calls.filter((c) => c.table === table && c.method === method).map((c) => c.args[0])

describe('getPlayerHonors', () => {
  it('dedupes captain+squad honors and sorts by year desc then result rank', async () => {
    queues = {
      // 1) honors where captain = person
      // 2) honors.in(extraIds) for squad-only honors
      honors: [
        [{ id: 'h1', club_id: 'c1', title: 'Cup A', result: 'RUNNER_UP', year: 2022, season_label: null, source: 'SELF_REPORTED' }],
        [
          { id: 'h2', club_id: 'c1', title: 'Cup B', result: 'CHAMPION', year: 2024, season_label: null, source: 'SELF_REPORTED' },
          { id: 'h3', club_id: 'c2', title: 'Cup C', result: 'CHAMPION', year: 2022, season_label: null, source: 'TOSSUP_VERIFIED' },
        ],
      ],
      // squad membership: h1 (also captain -> dedup), h2, h3
      honor_squad_members: [[{ honor_id: 'h1' }, { honor_id: 'h2' }, { honor_id: 'h3' }]],
      clubs: [[{ id: 'c1', name: 'Alpha', slug: 'alpha' }, { id: 'c2', name: 'Beta', slug: 'beta' }]],
    }

    const out = await getPlayerHonors('p1')

    // h1 appears once (not double-counted from captain + squad)
    expect(out.map((h) => h.id)).toEqual(['h2', 'h3', 'h1'])
    expect(out).toHaveLength(3)

    const h1 = out.find((h) => h.id === 'h1')!
    const h2 = out.find((h) => h.id === 'h2')!
    expect(h1.asCaptain).toBe(true)
    expect(h2.asCaptain).toBe(false)
    expect(h1.clubName).toBe('Alpha')
    expect(h1.clubSlug).toBe('alpha')

    // The two person-scoped queries must filter the correct columns, not just
    // return the right queue entry — captaincy on honors, membership on squad.
    expect(filtered('honors', 'eq')).toContain('captain_person_id')
    expect(filtered('honor_squad_members', 'eq')).toContain('person_id')
  })

  it('returns empty when the person has no honors', async () => {
    queues = { honors: [[]], honor_squad_members: [[]] }
    expect(await getPlayerHonors('nobody')).toEqual([])
  })
})

describe('readClubHonors', () => {
  it('resolves captain + squad person ids to display names', async () => {
    queues = {
      honors: [[{ id: 'h1', club_id: 'c1', title: 'League', result: 'CHAMPION', year: 2024, season_label: null, captain_person_id: 'cap', notes: null, source: 'SELF_REPORTED' }]],
      honor_squad_members: [[{ honor_id: 'h1', person_id: 'cap' }, { honor_id: 'h1', person_id: 's2' }]],
      player_profiles: [[{ id: 'cap', display_name: 'Cap Tain' }, { id: 's2', display_name: 'Sub Two' }]],
    }

    const out = await readClubHonors(platformDb as unknown as SupabaseClient<Database>, 'c1')

    expect(out).toHaveLength(1)
    expect(out[0].captainName).toBe('Cap Tain')
    expect(out[0].squad.map((s) => s.name)).toEqual(['Cap Tain', 'Sub Two'])
  })
})
