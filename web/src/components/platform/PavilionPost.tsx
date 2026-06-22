'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pin, PinOff, Trash2, MessageCircle, ShieldCheck, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { initials } from '@/lib/platform/recognition'
import {
  addReply,
  deletePost,
  listReplies,
  setFlagStatus,
  setPinned,
  timeAgo,
  KIND_META,
  PRIORITY_META,
  FLAG_STATUS_META,
  type Post,
  type PostReply,
  type FlagStatus,
} from '@/lib/platform/pavilion'

interface Props {
  post: Post
  mode: 'public' | 'host'
  onChanged: () => void
}

const FLAG_NEXT: Record<FlagStatus, FlagStatus | null> = {
  OPEN: 'ACKNOWLEDGED',
  ACKNOWLEDGED: 'RESOLVED',
  RESOLVED: null,
}

export function PavilionPost({ post, mode, onChanged }: Props) {
  const kindMeta = KIND_META[post.kind]
  const prio = PRIORITY_META[post.priority]
  const showPrio = post.priority === 'URGENT' || post.priority === 'HIGH'
  const isFlag = post.kind === 'FLAG'
  const flagMeta = isFlag ? FLAG_STATUS_META[post.status ?? 'OPEN'] : null

  const [expanded, setExpanded] = useState(false)
  const [replies, setReplies] = useState<PostReply[]>([])
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)

  const loadReplies = useCallback(async () => {
    setReplies(await listReplies(post.id))
  }, [post.id])

  useEffect(() => {
    if (expanded) void loadReplies()
  }, [expanded, post.reply_count, loadReplies])

  async function sendReply() {
    const text = replyText.trim()
    if (!text) return
    setBusy(true)
    try {
      await addReply({ post_id: post.id, body: text, is_host: mode === 'host', author_name: mode === 'host' ? 'Host' : 'Anonymous' })
      setReplyText('')
      await loadReplies()
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function togglePin() {
    try {
      await setPinned(post.id, !post.is_pinned)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function advanceFlag() {
    const next = FLAG_NEXT[post.status ?? 'OPEN']
    if (!next) return
    try {
      await setFlagStatus(post.id, next)
      toast.success(`Marked ${FLAG_STATUS_META[next].label.toLowerCase()}`)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function remove() {
    if (!confirm('Delete this post and its replies?')) return
    try {
      await deletePost(post.id)
      toast.success('Deleted')
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="cy-card cy-panel rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={post.is_host ? { background: '#0f5a30', color: '#fff' } : { background: '#eef0ea', color: '#6f6c63' }}
        >
          {initials(post.author_name || (post.is_host ? 'Host' : 'A'))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${kindMeta.chip}`}>
              {kindMeta.label}
            </span>
            {showPrio && (
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: prio.accent }}>
                {prio.label}
              </span>
            )}
            {post.is_pinned && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9a6b09]">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
            {flagMeta && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${flagMeta.chip}`}>
                {flagMeta.label}
              </span>
            )}
            <span className="ml-auto text-[11px] text-[#9a978d]">{timeAgo(post.created_at)}</span>
          </div>

          {post.title && <h4 className="mt-1.5 font-bold text-[#16150f]">{post.title}</h4>}
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#3a382f]">{post.body}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-[#9a978d]">
            {post.is_host ? 'Host' : post.author_name || 'Anonymous'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#6f6c63] hover:text-[#0f5a30]">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.reply_count > 0 ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>

            {mode === 'host' && (
              <div className="flex items-center gap-2">
                {!isFlag && post.is_host && (
                  <button onClick={togglePin} className="flex items-center gap-1 text-xs font-semibold text-[#6f6c63] hover:text-[#9a6b09]">
                    {post.is_pinned ? <><PinOff className="h-3.5 w-3.5" /> Unpin</> : <><Pin className="h-3.5 w-3.5" /> Pin</>}
                  </button>
                )}
                {isFlag && FLAG_NEXT[post.status ?? 'OPEN'] && (
                  <button onClick={advanceFlag} className="flex items-center gap-1 text-xs font-semibold text-[#0f5a30] hover:text-[#16150f]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Mark {FLAG_STATUS_META[FLAG_NEXT[post.status ?? 'OPEN']!].label.toLowerCase()}
                  </button>
                )}
                <button onClick={remove} className="flex items-center gap-1 text-xs font-semibold text-[#9a978d] hover:text-[#c0431a]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-[#ece9e1] pt-3">
              {replies.length === 0 && <p className="text-xs text-[#9a978d]">No replies yet.</p>}
              {replies.map((r) => (
                <div key={r.id} className="flex items-start gap-2">
                  <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#cfccc2]" />
                  <div className="min-w-0 flex-1 rounded-lg bg-[#f6f5f1] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${r.is_host ? 'text-[#0f5a30]' : 'text-[#16150f]'}`}>
                        {r.is_host ? 'Host' : r.author_name || 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-[#9a978d]">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#3a382f]">{r.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply() } }}
                  placeholder="Write a reply…"
                  className="h-9 flex-1 rounded-md border border-[#e7e4db] bg-white px-3 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]"
                />
                <Button size="sm" onClick={sendReply} disabled={busy} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
