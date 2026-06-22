'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, MessagesSquare, Flag } from 'lucide-react'
import { PavilionPost } from './PavilionPost'
import { PavilionComposer } from './PavilionComposer'
import {
  listPosts,
  subscribeToBoard,
  rankAnnouncements,
  discussionPosts,
  rankFlags,
  type Post,
  type Lane,
} from '@/lib/platform/pavilion'

interface Props {
  leagueId: string
  mode: 'public' | 'host'
  defaultLane?: Lane
}

const LANES: { key: Lane; label: string; icon: typeof Megaphone }[] = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'discussion', label: 'Discussion', icon: MessagesSquare },
  { key: 'flags', label: 'Flags', icon: Flag },
]

export function Pavilion({ leagueId, mode, defaultLane = 'announcements' }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [lane, setLane] = useState<Lane>(defaultLane)

  const load = useCallback(async () => {
    setPosts(await listPosts(leagueId))
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    void load()
    const unsub = subscribeToBoard(leagueId, () => { void load() })
    return unsub
  }, [leagueId, load])

  const { pinned, feed } = useMemo(() => rankAnnouncements(posts), [posts])
  const discussion = useMemo(() => discussionPosts(posts), [posts])
  const flags = useMemo(() => rankFlags(posts), [posts])
  const openFlags = useMemo(() => flags.filter((f) => (f.status ?? 'OPEN') === 'OPEN').length, [flags])

  const counts: Record<Lane, number> = {
    announcements: pinned.length + feed.length,
    discussion: discussion.length,
    flags: flags.length,
  }

  return (
    <div className="cy-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#ece9e1] bg-[#f6f5f1] px-5 py-4">
        <h2 className="cy-display text-xl font-semibold text-[#16150f]">The Pavilion</h2>
        <p className="mt-0.5 text-xs text-[#6f6c63]">
          Announcements, discussion &amp; flags — the latest and most relevant rise to the top.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {LANES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setLane(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                lane === key ? 'bg-[#1f9d57] text-white' : 'bg-white text-[#6f6c63] hover:text-[#16150f]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className={`rounded-full px-1.5 text-[10px] ${lane === key ? 'bg-white/20' : 'bg-[#eef0ea]'}`}>
                {counts[key]}
              </span>
              {key === 'flags' && openFlags > 0 && (
                <span className="rounded-full bg-[#c0431a] px-1.5 text-[10px] text-white">{openFlags} open</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-5">
        {loading && <p className="text-sm text-[#9a978d]">Loading…</p>}

        {!loading && lane === 'announcements' && (
          <>
            {mode === 'host' && <PavilionComposer leagueId={leagueId} variant="announcement" onPosted={load} />}
            {pinned.length === 0 && feed.length === 0 && (
              <EmptyLane text={mode === 'host' ? 'No announcements yet — post the first update above.' : 'No announcements yet. Check back soon.'} />
            )}
            {pinned.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a6b09]">Pinned</p>
                {pinned.map((p) => <PavilionPost key={p.id} post={p} mode={mode} onChanged={load} />)}
              </div>
            )}
            {feed.map((p) => <PavilionPost key={p.id} post={p} mode={mode} onChanged={load} />)}
          </>
        )}

        {!loading && lane === 'discussion' && (
          <>
            <PavilionComposer leagueId={leagueId} variant="discussion" onPosted={load} />
            {discussion.length === 0 && <EmptyLane text="No discussion yet. Start the conversation above." />}
            {discussion.map((p) => <PavilionPost key={p.id} post={p} mode={mode} onChanged={load} />)}
          </>
        )}

        {!loading && lane === 'flags' && (
          <>
            <PavilionComposer leagueId={leagueId} variant="flag" onPosted={load} />
            {flags.length === 0 && <EmptyLane text="Nothing flagged. Raise an issue for the host above." />}
            {flags.map((p) => <PavilionPost key={p.id} post={p} mode={mode} onChanged={load} />)}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyLane({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#e7e4db] px-4 py-6 text-center text-sm text-[#9a978d]">{text}</p>
}
