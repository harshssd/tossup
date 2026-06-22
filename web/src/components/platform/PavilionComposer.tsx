'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  createPost,
  ANNOUNCEMENT_COMPOSE_KINDS,
  PRIORITY_OPTIONS,
  HOST_LABEL,
  ANON_LABEL,
  type PostKind,
  type PostPriority,
} from '@/lib/platform/pavilion'

type Variant = 'announcement' | 'discussion' | 'flag'

const VARIANT_COPY: Record<Variant, { title: string; bodyPlaceholder: string; cta: string }> = {
  announcement: { title: 'Post an announcement', bodyPlaceholder: 'What do participants need to know?', cta: 'Publish' },
  discussion: { title: 'Start a discussion', bodyPlaceholder: 'Ask a question or share something with the group…', cta: 'Post' },
  flag: { title: 'Raise a flag', bodyPlaceholder: 'Describe the issue, dispute, or concern for the host…', cta: 'Submit flag' },
}

const fieldCls =
  'h-9 rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'
const areaCls =
  'min-h-[80px] w-full rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

interface Props {
  leagueId: string
  variant: Variant
  onPosted: () => void
}

export function PavilionComposer({ leagueId, variant, onPosted }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<PostKind>('ANNOUNCEMENT')
  const [priority, setPriority] = useState<PostPriority>('NORMAL')
  const [pinned, setPinned] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  const copy = VARIANT_COPY[variant]

  function reset() {
    setBody(''); setTitle(''); setName(''); setKind('ANNOUNCEMENT')
    setPriority('NORMAL'); setPinned(false); setExpiresAt('')
  }

  async function submit() {
    const text = body.trim()
    if (!text) {
      toast.error('Write a message first')
      return
    }
    if (variant === 'announcement' && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      toast.error('Expiry must be in the future — it would hide this announcement immediately.')
      return
    }
    setSaving(true)
    try {
      await createPost({
        league_id: leagueId,
        body: text,
        title: variant === 'announcement' ? title.trim() || null : null,
        kind: variant === 'announcement' ? kind : variant === 'flag' ? 'FLAG' : 'GENERAL',
        priority: variant === 'announcement' ? priority : 'NORMAL',
        is_host: variant === 'announcement',
        is_pinned: variant === 'announcement' ? pinned : false,
        pinned_at: variant === 'announcement' && pinned ? new Date().toISOString() : null,
        status: variant === 'flag' ? 'OPEN' : null,
        author_name: name.trim() || (variant === 'announcement' ? HOST_LABEL : ANON_LABEL),
        expires_at: variant === 'announcement' && expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      toast.success(variant === 'flag' ? 'Flag submitted' : 'Posted')
      reset()
      setOpen(false)
      onPosted()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-[#d8d4c8] bg-[#f6f5f1] px-4 py-3 text-left text-sm font-semibold text-[#6f6c63] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
      >
        + {copy.title}
      </button>
    )
  }

  return (
    <div className="cy-panel rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#16150f]">{copy.title}</h4>
        <button onClick={() => { reset(); setOpen(false) }} className="text-xs font-semibold text-[#9a978d] hover:text-[#16150f]">
          Cancel
        </button>
      </div>

      {variant === 'announcement' && (
        <div className="mb-2 flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as PostKind)} className={fieldCls}>
            {ANNOUNCEMENT_COMPOSE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as PostPriority)} className={fieldCls}>
            {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label} priority</option>)}
          </select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline (optional)" className="h-9 w-48" />
        </div>
      )}

      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={copy.bodyPlaceholder} className={areaCls} />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {variant !== 'announcement' && (
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="h-9 w-44" />
        )}
        {variant === 'announcement' && (
          <>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6f6c63]">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-[#1f9d57]" />
              Pin to top
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6f6c63]">
              Expires
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={fieldCls} />
            </label>
          </>
        )}
        <Button size="sm" onClick={submit} disabled={saving} className="ml-auto bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
          {saving ? 'Saving…' : copy.cta}
        </Button>
      </div>
    </div>
  )
}
