import { createPlatformServerClient } from './auth-server'
import { platformDb } from './db'
import { rankFeed, type FeedItem, type FollowScope, type ViewerFollowState } from './follows'
import { ANNOUNCEMENT_KINDS, KIND_META, isExpired, type Post } from './pavilion'
import { EVENT_TYPE_LABEL } from './events'
import { formatCricketScore } from './share'

// Server-side reads for the follow system: the viewer's follow state for one
// scope (feeds <FollowButton>), and the aggregated /home feed. Follows are read
// with the authed client (RLS: own rows). Followed CONTENT is read with the anon
// platformDb so a scope that has since gone PRIVATE silently drops out of the
// feed — a follow is a subscription to public content, not a back door.

/** Read whether the current viewer follows this scope, plus its public follower
 *  count. Count uses the anon-callable follower_count() definer (returns an
 *  integer only — never who), so a signed-out visitor still sees it. */
export async function getViewerFollowState(scope: FollowScope, scopeId: string): Promise<ViewerFollowState> {
  const supabase = await createPlatformServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: count } = await supabase.rpc('follower_count', { p_scope: scope, p_scope_id: scopeId })
  const followerCount = typeof count === 'number' ? count : 0

  if (!user) return { signedIn: false, following: false, followerCount }

  const { data: row } = await supabase
    .from('follows')
    .select('id')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .maybeSingle()

  return { signedIn: true, following: !!row, followerCount }
}

// Bound the fan-out: a user following hundreds of scopes still yields a
// glanceable digest, and each content read stays a single cheap `.in()` query.
const MAX_FOLLOWS = 200
const MAX_PER_SOURCE = 60

interface FollowRow {
  scope: FollowScope
  scope_id: string
}

/** Build the signed-in viewer's /home feed: upcoming events from followed clubs,
 *  plus recent results (from followed tournaments) and announcements (from both).
 *  Returns empty sections when the user follows nothing. */
export async function buildHomeFeed(now: number = Date.now()): Promise<{ upcoming: FeedItem[]; recent: FeedItem[]; followCount: number }> {
  const supabase = await createPlatformServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { upcoming: [], recent: [], followCount: 0 }

  const { data: follows } = await supabase
    .from('follows')
    .select('scope, scope_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_FOLLOWS)

  const rows = (follows ?? []) as FollowRow[]
  const clubIds = rows.filter((f) => f.scope === 'club').map((f) => f.scope_id)
  const leagueIds = rows.filter((f) => f.scope === 'league').map((f) => f.scope_id)
  if (clubIds.length === 0 && leagueIds.length === 0) return { upcoming: [], recent: [], followCount: 0 }

  const nowIso = new Date(now).toISOString()

  // Resolve display names/links via the anon client — PUBLIC scopes only. A club
  // that went private (or was deleted) simply won't appear in these maps, so its
  // content is dropped even if a stale follow row remains.
  const [clubsRes, leaguesRes] = await Promise.all([
    clubIds.length
      ? platformDb.from('clubs').select('id, name, slug').in('id', clubIds).eq('visibility', 'PUBLIC')
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string | null }[] }),
    leagueIds.length
      ? platformDb.from('leagues').select('id, name').in('id', leagueIds).eq('visibility', 'PUBLIC')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const clubMap = new Map((clubsRes.data ?? []).map((c) => [c.id, c]))
  const leagueMap = new Map((leaguesRes.data ?? []).map((l) => [l.id, l]))
  const liveClubIds = [...clubMap.keys()]
  const liveLeagueIds = [...leagueMap.keys()]
  if (liveClubIds.length === 0 && liveLeagueIds.length === 0) return { upcoming: [], recent: [], followCount: rows.length }

  const [eventsRes, resultsRes, clubPostsRes, leaguePostsRes] = await Promise.all([
    liveClubIds.length
      ? platformDb
          .from('club_events')
          .select('id, club_id, title, starts_at, event_type, location')
          .in('club_id', liveClubIds)
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(MAX_PER_SOURCE)
      : Promise.resolve({ data: [] }),
    liveLeagueIds.length
      ? platformDb
          .from('fixtures')
          .select('id, league_id, team_a_name, team_b_name, team_a_runs, team_a_wickets, team_a_overs, team_b_runs, team_b_wickets, team_b_overs, result_note, updated_at')
          .in('league_id', liveLeagueIds)
          .eq('status', 'COMPLETED')
          .order('updated_at', { ascending: false })
          .limit(MAX_PER_SOURCE)
      : Promise.resolve({ data: [] }),
    liveClubIds.length
      ? platformDb
          .from('tournament_posts')
          .select('*')
          .in('club_id', liveClubIds)
          .in('kind', ANNOUNCEMENT_KINDS)
          .order('created_at', { ascending: false })
          .limit(MAX_PER_SOURCE)
      : Promise.resolve({ data: [] }),
    liveLeagueIds.length
      ? platformDb
          .from('tournament_posts')
          .select('*')
          .in('league_id', liveLeagueIds)
          .in('kind', ANNOUNCEMENT_KINDS)
          .order('created_at', { ascending: false })
          .limit(MAX_PER_SOURCE)
      : Promise.resolve({ data: [] }),
  ])

  const items: FeedItem[] = []

  for (const e of eventsRes.data ?? []) {
    const club = clubMap.get(e.club_id)
    if (!club) continue
    const detail = [EVENT_TYPE_LABEL[e.event_type] ?? 'Event', e.location].filter(Boolean).join(' · ') || null
    items.push({
      key: `event:${e.id}`,
      type: 'event',
      when: 'upcoming',
      ts: new Date(e.starts_at).getTime(),
      sourceName: club.name,
      sourceHref: `/club/${club.slug ?? club.id}`,
      title: e.title,
      detail,
    })
  }

  for (const f of resultsRes.data ?? []) {
    const league = leagueMap.get(f.league_id)
    if (!league) continue
    const a = f.team_a_name ?? 'Team A'
    const b = f.team_b_name ?? 'Team B'
    const scoreA = formatCricketScore(f.team_a_runs, f.team_a_wickets, f.team_a_overs)
    const scoreB = formatCricketScore(f.team_b_runs, f.team_b_wickets, f.team_b_overs)
    const detail = f.result_note || (scoreA && scoreB ? `${a} ${scoreA} · ${b} ${scoreB}` : null)
    items.push({
      key: `result:${f.id}`,
      type: 'result',
      when: 'recent',
      ts: new Date(f.updated_at).getTime(),
      sourceName: league.name,
      sourceHref: `/tournaments/${f.league_id}`,
      title: `${a} vs ${b}`,
      detail,
    })
  }

  const pushPost = (p: Post) => {
    if (isExpired(p, now)) return
    const isClub = !!p.club_id
    const source = isClub ? clubMap.get(p.club_id!) : leagueMap.get(p.league_id!)
    if (!source) return
    const href = isClub ? `/club/${clubMap.get(p.club_id!)?.slug ?? p.club_id}` : `/tournaments/${p.league_id}`
    items.push({
      key: `post:${p.id}`,
      type: 'announcement',
      when: 'recent',
      ts: new Date(p.created_at).getTime(),
      sourceName: source.name,
      sourceHref: href,
      title: p.title || KIND_META[p.kind]?.label || 'Announcement',
      detail: p.body ?? null,
    })
  }
  for (const p of (clubPostsRes.data ?? []) as Post[]) pushPost(p)
  for (const p of (leaguePostsRes.data ?? []) as Post[]) pushPost(p)

  const { upcoming, recent } = rankFeed(items, now)
  return { upcoming, recent, followCount: rows.length }
}
