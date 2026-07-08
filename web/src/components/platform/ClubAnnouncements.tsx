import { Pin, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KIND_META, PRIORITY_META, rankAnnouncements, timeAgo, type Post } from '@/lib/platform/pavilion'

interface AdminControls {
  pendingId: string | null
  onTogglePin: (post: Post) => void
  onDelete: (post: Post) => void
}

/** Read-only ranked announcements feed (pinned strip + relevance feed). Shared by
 *  the public club page (no admin prop) and the manage screen (admin controls).
 *  Directive-less so it renders in both a server and a client tree. */
export function ClubAnnouncements({
  posts,
  now,
  admin,
}: {
  posts: Post[]
  now: number
  admin?: AdminControls
}) {
  const { pinned, feed } = rankAnnouncements(posts, now)
  if (pinned.length === 0 && feed.length === 0) return null

  return (
    <div className="mt-3 space-y-2.5">
      {[...pinned, ...feed].map((p) => {
        const kind = KIND_META[p.kind]
        const rail = PRIORITY_META[p.priority].rail
        return (
          <div
            key={p.id}
            className="cy-panel overflow-hidden rounded-2xl border border-[#e7e4db] bg-white p-4"
            style={rail !== 'transparent' ? { borderLeft: `4px solid ${rail}` } : undefined}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {p.is_pinned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9a6b09]">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${kind.chip}`}>
                  {kind.label}
                </span>
                {p.priority !== 'NORMAL' && p.priority !== 'LOW' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: PRIORITY_META[p.priority].accent }}>
                    {PRIORITY_META[p.priority].label}
                  </span>
                )}
              </div>
              <span className="text-xs text-[#9a978d]">{timeAgo(p.created_at, now)}</span>
            </div>
            {p.title && <p className="mt-1.5 text-base font-semibold text-[#16150f]">{p.title}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#3a382f]">{p.body}</p>
            {admin && (
              <div className="mt-2.5 flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={admin.pendingId === p.id}
                  onClick={() => admin.onTogglePin(p)}
                >
                  <Pin className="mr-1 h-3.5 w-3.5" /> {p.is_pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={admin.pendingId === p.id}
                  aria-label="Delete announcement"
                  onClick={() => admin.onDelete(p)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
