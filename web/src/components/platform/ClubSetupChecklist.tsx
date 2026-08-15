'use client'

import { useEffect, useState } from 'react'
import { Check, ListChecks } from 'lucide-react'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { computeChecklist, checklistProgress, type ChecklistItem } from '@/lib/platform/club-checklist'

/** "Get your club set up" — computed from real club data, links each step to its
 *  manage section, and disappears once everything's done. */
export function ClubSetupChecklist({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createPlatformBrowserClient()
        const [clubRes, members, events, announcements, honors] = await Promise.all([
          supabase.from('clubs').select('crest_url, description').eq('id', clubId).maybeSingle(),
          supabase.from('club_memberships').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
          supabase.from('club_events').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
          // Any club-scoped post counts — the composer also posts SCHEDULE/
          // RESULT/ALERT kinds, and all of them mean "used the board" (review).
          supabase.from('tournament_posts').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
          supabase.from('honors').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
        ])
        if (cancelled) return
        // supabase-js returns {error} rather than throwing — a failed query must
        // NOT render a false "undone" checklist (count null → 0). Bail instead
        // (review: the checklist just doesn't render on error).
        if (clubRes.error || members.error || events.error || announcements.error || honors.error) {
          console.warn('club checklist: query failed', clubRes.error ?? members.error ?? events.error ?? announcements.error ?? honors.error)
          return
        }
        const club = clubRes.data
        setItems(
          computeChecklist({
            hasCrest: !!club?.crest_url,
            hasDescription: !!club?.description?.trim(),
            memberCount: members.count ?? 0,
            eventCount: events.count ?? 0,
            announcementCount: announcements.count ?? 0,
            honorCount: honors.count ?? 0,
          })
        )
      } catch {
        // Non-fatal: the checklist just doesn't render.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clubId])

  if (!items) return null
  const { done, total, complete } = checklistProgress(items)
  if (complete) return null

  return (
    <section className="mt-6 rounded-2xl border border-[#bfe3cc] bg-[#f2faf5] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="cy-display flex items-center gap-2 text-lg font-semibold text-[#0f5a30]">
          <ListChecks className="h-5 w-5" aria-hidden /> Get your club set up
        </h2>
        <span className="text-xs font-bold text-[#0f5a30]">
          {done} / {total} done
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d9ede0]" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Club setup progress">
        <div className="h-full rounded-full bg-[#1f9d57] transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.key}>
            {it.done ? (
              <span className="flex items-center gap-2 px-1 py-1 text-sm text-[#6f6c63]">
                <Check className="h-4 w-4 text-[#1f9d57]" aria-hidden /> {it.label}
              </span>
            ) : (
              <a
                href={it.anchor}
                className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-[#16150f] hover:bg-white"
              >
                <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-[#b5cfc0]" aria-hidden /> {it.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
