import { platformDb } from './db'
import type { Database } from '@/lib/database.types'

// ---------------- Types ----------------
export type Post = Database['public']['Tables']['tournament_posts']['Row']
export type PostReply = Database['public']['Tables']['tournament_post_replies']['Row']
export type PostKind = Database['public']['Enums']['post_kind']
export type PostPriority = Database['public']['Enums']['post_priority']
export type FlagStatus = Database['public']['Enums']['flag_status']

export type Lane = 'announcements' | 'discussion' | 'flags'

/** Author labels for the pre-auth era (single source of truth). */
export const HOST_LABEL = 'Host'
export const ANON_LABEL = 'Anonymous'

/** Kinds that live in the Announcements lane (host broadcasts). */
export const ANNOUNCEMENT_KINDS: PostKind[] = ['ANNOUNCEMENT', 'SCHEDULE', 'RESULT', 'ALERT']

// ---------------- Display metadata (Clubhouse light) ----------------
export const KIND_META: Record<PostKind, { label: string; chip: string }> = {
  ANNOUNCEMENT: { label: 'Announcement', chip: 'bg-[#e7f4ec] text-[#0f5a30]' },
  SCHEDULE: { label: 'Schedule', chip: 'bg-[#fcf3d6] text-[#9a6b09]' },
  RESULT: { label: 'Result', chip: 'bg-[#e4eefb] text-[#2257b3]' },
  ALERT: { label: 'Alert', chip: 'bg-[#fdeee4] text-[#c0431a]' },
  GENERAL: { label: 'Discussion', chip: 'bg-[#efede6] text-[#6f6c63]' },
  FLAG: { label: 'Flag', chip: 'bg-[#fdeee4] text-[#c0431a]' },
}

export const PRIORITY_META: Record<PostPriority, { label: string; accent: string; rail: string }> = {
  URGENT: { label: 'Urgent', accent: '#c0431a', rail: '#e07a44' },
  HIGH: { label: 'High', accent: '#9a6b09', rail: '#e8b53f' },
  NORMAL: { label: 'Normal', accent: '#6f6c63', rail: 'transparent' },
  LOW: { label: 'Low', accent: '#9a978d', rail: 'transparent' },
}

export const FLAG_STATUS_META: Record<FlagStatus, { label: string; chip: string }> = {
  OPEN: { label: 'Open', chip: 'bg-[#fdeee4] text-[#c0431a]' },
  ACKNOWLEDGED: { label: 'Acknowledged', chip: 'bg-[#fcf3d6] text-[#9a6b09]' },
  RESOLVED: { label: 'Resolved', chip: 'bg-[#e7f4ec] text-[#0f5a30]' },
}

export const ANNOUNCEMENT_COMPOSE_KINDS: { value: PostKind; label: string }[] = [
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'SCHEDULE', label: 'Schedule change' },
  { value: 'RESULT', label: 'Result update' },
  { value: 'ALERT', label: 'Alert' },
]

export const PRIORITY_OPTIONS: { value: PostPriority; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'LOW', label: 'Low' },
]

// ---------------- Relevance ranking ----------------
// "Most relevant latest at top": pinned items float above everything, then the
// rest sort by a score blending priority and recency (≈2-day decay). A fresh
// URGENT outranks a stale HIGH; a stale LOW sinks. Predictable, not a black box.
const PRIORITY_WEIGHT: Record<PostPriority, number> = { URGENT: 1000, HIGH: 300, NORMAL: 100, LOW: 30 }

export function relevanceScore(p: Post, now: number): number {
  const ageHours = (now - new Date(p.created_at).getTime()) / 3_600_000
  const recency = 200 * Math.exp(-Math.max(ageHours, 0) / 48)
  return PRIORITY_WEIGHT[p.priority] + recency
}

export function isExpired(p: Post, now: number): boolean {
  return p.expires_at ? new Date(p.expires_at).getTime() < now : false
}

/** Split announcement posts into a host-curated pinned strip and a ranked feed.
 *  Expiry applies to pinned items too — a time-bound notice clears even when
 *  pinned, so an expired pin can't sit at the top forever. id is the final,
 *  deterministic tie-breaker so equal-score posts don't flicker between renders. */
export function rankAnnouncements(posts: Post[], now: number = Date.now()): { pinned: Post[]; feed: Post[] } {
  const ann = posts.filter((p) => ANNOUNCEMENT_KINDS.includes(p.kind) && !isExpired(p, now))
  const pinned = ann
    .filter((p) => p.is_pinned)
    .sort((a, b) => new Date(b.pinned_at ?? b.created_at).getTime() - new Date(a.pinned_at ?? a.created_at).getTime() || a.id.localeCompare(b.id))
  const feed = ann
    .filter((p) => !p.is_pinned)
    .sort((a, b) => relevanceScore(b, now) - relevanceScore(a, now) || a.id.localeCompare(b.id))
  return { pinned, feed }
}

/** Flags newest-first, but OPEN ahead of resolved so nothing slips. */
export function rankFlags(posts: Post[]): Post[] {
  const order: Record<string, number> = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 }
  return posts
    .filter((p) => p.kind === 'FLAG')
    .sort(
      (a, b) =>
        (order[a.status ?? 'OPEN'] ?? 0) - (order[b.status ?? 'OPEN'] ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        a.id.localeCompare(b.id)
    )
}

export function discussionPosts(posts: Post[]): Post[] {
  return posts
    .filter((p) => p.kind === 'GENERAL')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.id.localeCompare(b.id))
}

// ---------------- Relative time ----------------
export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------- Queries ----------------
export async function listPosts(leagueId: string): Promise<Post[]> {
  // The 200 most recent posts PLUS every pinned / OPEN-flag row. On a busy
  // tournament (>200 posts) a host's pinned notice or an unresolved flag could
  // be older than the newest 200 and silently fall off the board — the worst
  // failure for a comms hub. The sticky query (pinned OR open flag) is small
  // and guarantees they're always present; we merge and dedupe by id.
  const [recent, sticky] = await Promise.all([
    platformDb.from('tournament_posts').select('*').eq('league_id', leagueId).order('created_at', { ascending: false }).limit(200),
    platformDb.from('tournament_posts').select('*').eq('league_id', leagueId).or('is_pinned.eq.true,status.eq.OPEN'),
  ])
  if (recent.error) console.error('listPosts (recent):', recent.error.message)
  if (sticky.error) console.error('listPosts (sticky):', sticky.error.message)
  const byId = new Map<string, Post>()
  for (const p of recent.data ?? []) byId.set(p.id, p)
  for (const p of sticky.data ?? []) byId.set(p.id, p)
  return [...byId.values()]
}

/** Club Pavilion (v1 = announcements). Same sticky-merge as listPosts but scoped
 *  to a club. `db` picks trust level: anon platformDb for the public page (PUBLIC
 *  clubs), an authed client on manage (sees a PRIVATE club's board). */
export async function listClubPosts(clubId: string, db = platformDb): Promise<Post[]> {
  const [recent, sticky] = await Promise.all([
    db.from('tournament_posts').select('*').eq('club_id', clubId).order('created_at', { ascending: false }).limit(200),
    db.from('tournament_posts').select('*').eq('club_id', clubId).eq('is_pinned', true),
  ])
  if (recent.error) console.error('listClubPosts (recent):', recent.error.message)
  if (sticky.error) console.error('listClubPosts (sticky):', sticky.error.message)
  const byId = new Map<string, Post>()
  for (const p of recent.data ?? []) byId.set(p.id, p)
  for (const p of sticky.data ?? []) byId.set(p.id, p)
  return [...byId.values()]
}

export async function listReplies(postId: string): Promise<PostReply[]> {
  const { data, error } = await platformDb
    .from('tournament_post_replies')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) console.error('listReplies:', error.message)
  return data ?? []
}

export async function createPost(
  input: Partial<Post> & { league_id: string; body: string }
): Promise<Post> {
  const { data, error } = await platformDb.from('tournament_posts').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updatePost(id: string, patch: Partial<Post>): Promise<void> {
  // Never let a caller clobber server-maintained columns (reply_count is owned
  // by the trigger; id/created_at are immutable).
  const safe: Partial<Post> = { ...patch }
  delete safe.id
  delete safe.reply_count
  delete safe.created_at
  const { error } = await platformDb
    .from('tournament_posts')
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await platformDb.from('tournament_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function setPinned(id: string, pinned: boolean): Promise<void> {
  return updatePost(id, { is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null })
}

export function setFlagStatus(id: string, status: FlagStatus): Promise<void> {
  return updatePost(id, { status })
}

export async function addReply(
  input: Partial<PostReply> & { post_id: string; body: string }
): Promise<PostReply> {
  const { data, error } = await platformDb.from('tournament_post_replies').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data
}

// ---------------- Acknowledgements ----------------
/** Which of these posts the given viewer has already acknowledged. */
export async function listMyAcks(viewerId: string, postIds: string[]): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set()
  const { data, error } = await platformDb
    .from('tournament_post_acks')
    .select('post_id')
    .eq('viewer_id', viewerId)
    .in('post_id', postIds)
  if (error) console.error('listMyAcks:', error.message)
  return new Set((data ?? []).map((a) => a.post_id))
}

/** Record an acknowledgement. Idempotent: a repeat from the same browser is a
 *  no-op (UNIQUE(post_id, viewer_id) + ignoreDuplicates), so the count can't be
 *  inflated and the trigger only fires on a genuine first insert. */
export async function acknowledge(postId: string, viewerId: string, viewerName?: string | null): Promise<void> {
  const { error } = await platformDb
    .from('tournament_post_acks')
    .upsert({ post_id: postId, viewer_id: viewerId, viewer_name: viewerName ?? null }, { onConflict: 'post_id,viewer_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function unacknowledge(postId: string, viewerId: string): Promise<void> {
  const { error } = await platformDb
    .from('tournament_post_acks')
    .delete()
    .eq('post_id', postId)
    .eq('viewer_id', viewerId)
  if (error) throw new Error(error.message)
}

// ---------------- Realtime ----------------
/** Subscribe to live changes for one tournament's board. Returns an unsubscribe fn.
 *  We listen ONLY to this league's tournament_posts: the reply-count trigger
 *  UPDATEs the parent post on every reply insert/delete, so reply activity
 *  surfaces through the league-filtered posts stream. That avoids a broad,
 *  cross-tournament reply feed that would refetch every open board on any
 *  reply platform-wide. The channel name carries a per-instance suffix so two
 *  mounts of the same league (e.g. StrictMode double-mount) don't collide. */
export function subscribeToBoard(leagueId: string, onChange: () => void): () => void {
  const channel = platformDb
    .channel(`pavilion:${leagueId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tournament_posts', filter: `league_id=eq.${leagueId}` },
      onChange
    )
    .subscribe()
  return () => {
    void platformDb.removeChannel(channel)
  }
}
