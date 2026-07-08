'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ClubAnnouncements } from './ClubAnnouncements'
import {
  ANNOUNCEMENT_COMPOSE_KINDS,
  PRIORITY_OPTIONS,
  type Post,
  type PostKind,
  type PostPriority,
} from '@/lib/platform/pavilion'
import { createClubAnnouncement, deleteClubPost, loadClubPostsAdmin, setClubPostPinned } from '@/lib/platform/pavilion-client'

const selCls = 'h-9 rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

/** Club announcements admin surface: composer + the shared feed with pin/delete. */
export function ClubAnnouncementsManager({ clubId }: { clubId: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [now] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setPosts(await loadClubPostsAdmin(clubId))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [clubId])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const body = String(f.get('body') || '').trim()
    if (!body) {
      toast.error('Say something in the announcement')
      return
    }
    setSaving(true)
    try {
      await createClubAnnouncement({
        clubId,
        kind: String(f.get('kind') || 'ANNOUNCEMENT') as PostKind,
        priority: String(f.get('priority') || 'NORMAL') as PostPriority,
        title: String(f.get('title') || '').trim() || null,
        body,
        isPinned: f.get('pin') === 'on',
      })
      form.reset()
      setOpen(false)
      toast.success('Announcement posted')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function onTogglePin(p: Post) {
    if (pendingId) return
    setPendingId(p.id)
    try {
      await setClubPostPinned(p.id, !p.is_pinned)
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  async function onDelete(p: Post) {
    if (pendingId) return
    if (!confirm('Delete this announcement?')) return
    setPendingId(p.id)
    try {
      await deleteClubPost(p.id)
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      {posts.length === 0 && <p className="mt-3 py-2 text-sm text-[#9a978d]">No announcements yet — post your first below.</p>}
      <ClubAnnouncements posts={posts} now={now} admin={{ pendingId, onTogglePin, onDelete }} />

      {!open ? (
        <Button size="sm" variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          + New announcement
        </Button>
      ) : (
        <form onSubmit={onCreate} className="mt-4 space-y-3 border-t border-[#efece4] pt-4">
          <div className="flex flex-wrap gap-2">
            <select name="kind" className={selCls} defaultValue="ANNOUNCEMENT" aria-label="Kind">
              {ANNOUNCEMENT_COMPOSE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <select name="priority" className={selCls} defaultValue="NORMAL" aria-label="Priority">
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <Input name="title" aria-label="Title" placeholder="Title (optional)" className="h-9 w-full" />
          <Textarea name="body" aria-label="Announcement" placeholder="What's the news? e.g. Nets moved to Sunday 9am at the Oval." rows={3} />
          <label className="flex items-center gap-2 text-sm text-[#3a382f]">
            <input type="checkbox" name="pin" className="h-4 w-4 accent-[#1f9d57]" /> Pin to top
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
              {saving ? 'Posting…' : 'Post announcement'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
