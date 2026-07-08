'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import {
  addClubMember,
  getClubAdminState,
  getClubRoster,
  linkMemberToUser,
  mergeMembers,
  removeClubMember,
  setClubMemberRole,
  type ClubRole,
  type RosterMember,
} from '@/lib/platform/club-admin'
import { createHonor, deleteHonor, loadClubHonors } from '@/lib/platform/honors-client'
import type { HonorResult, HonorView } from '@/lib/platform/honors'

const selCls = 'h-8 rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'
// Promoting an account-less Person to ADMIN/OWNER fails the admin-must-be-user
// trigger, so only MEMBER/MODERATOR are offered as targets. The member's current
// role is always included so it renders correctly (incl. OWNER/ADMIN rows).
// Promoting an account-less Person to ADMIN/OWNER fails the admin-must-be-user
// trigger, so ADMIN is only offered once the member is linked to a user account.
function roleOptions(current: string, linked: boolean): string[] {
  const assignable = linked ? ['ADMIN', 'MODERATOR', 'MEMBER'] : ['MODERATOR', 'MEMBER']
  return Array.from(new Set<string>([current, ...assignable]))
}

const RESULT_LABEL: Record<string, string> = {
  CHAMPION: 'Champions',
  RUNNER_UP: 'Runners-up',
  THIRD: 'Third place',
  SPECIAL: 'Special',
}

export default function ManageClubPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [club, setClub] = useState<{ id: string; name: string } | null>(null)
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [access, setAccess] = useState<'checking' | 'guest' | 'denied' | 'ok' | 'missing'>('checking')
  const [adding, setAdding] = useState(false)

  // Resolve the club by slug (authed client so a private club's admin can read it)
  // then gate on club-admin authority.
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createPlatformBrowserClient()
        const { data: c } = await supabase.from('clubs').select('id, name').eq('slug', slug).maybeSingle()
        if (cancelled) return
        if (!c) {
          setAccess('missing')
          return
        }
        setClub(c)
        const { signedIn, isAdmin } = await getClubAdminState(c.id)
        if (cancelled) return
        setAccess(!signedIn ? 'guest' : isAdmin ? 'ok' : 'denied')
      } catch {
        if (!cancelled) setAccess('denied')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const [honors, setHonors] = useState<HonorView[]>([])

  const loadRoster = useCallback(async () => {
    if (!club) return
    try {
      setRoster(await getClubRoster(club.id))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [club])

  const loadHonors = useCallback(async () => {
    if (!club) return
    try {
      setHonors(await loadClubHonors(club.id))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [club])

  useEffect(() => {
    if (access === 'ok') {
      loadRoster()
      loadHonors()
    }
  }, [access, loadRoster, loadHonors])

  async function onDeleteHonor(id: string, title: string) {
    if (!confirm(`Remove "${title}" from the cabinet? This cannot be undone.`)) return
    try {
      await deleteHonor(id)
      toast.success('Honour removed')
      await loadHonors()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!club) return
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name') || '').trim()
    const role = (String(f.get('role') || 'MEMBER') as 'MEMBER' | 'MODERATOR')
    if (!name) return
    setAdding(true)
    try {
      await addClubMember(club.id, name, role)
      e.currentTarget.reset()
      toast.success('Member added')
      await loadRoster()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function onRole(membershipId: string, role: ClubRole) {
    try {
      await setClubMemberRole(membershipId, role)
      await loadRoster()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function onRemove(membershipId: string) {
    try {
      await removeClubMember(membershipId)
      toast.success('Member removed')
      await loadRoster()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function onLink(m: RosterMember) {
    const email = window.prompt(`Link "${m.name}" to which account? Enter the member's account email:`)?.trim()
    if (!email) return
    try {
      await linkMemberToUser(m.personId, email)
      toast.success(`Linked ${m.name} to ${email}`)
      await loadRoster()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const [loserId, setLoserId] = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [merging, setMerging] = useState(false)

  async function onMerge() {
    if (!loserId || !winnerId || loserId === winnerId) {
      toast.error('Pick two different members')
      return
    }
    const loser = roster.find((m) => m.personId === loserId)
    const winner = roster.find((m) => m.personId === winnerId)
    if (!confirm(`Merge "${loser?.name}" into "${winner?.name}"? This removes "${loser?.name}" and moves everything to "${winner?.name}". This cannot be undone.`)) {
      return
    }
    setMerging(true)
    try {
      await mergeMembers(loserId, winnerId)
      toast.success('Members merged')
      setLoserId('')
      setWinnerId('')
      await loadRoster()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setMerging(false)
    }
  }

  if (access === 'checking') return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Checking access…</div>
  if (access === 'missing') {
    return (
      <PlatformShell>
        <div className="px-4 py-16 text-center text-sm text-[#9a978d]">Club not found.</div>
      </PlatformShell>
    )
  }
  if (access === 'guest') {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Sign in to manage</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">Only the club&apos;s admins can manage its roster.</p>
          <Button className="mt-5" onClick={() => router.push(`/account/sign-in?redirect=/club/${slug}/manage`)}>
            Sign in
          </Button>
        </div>
      </PlatformShell>
    )
  }
  if (access === 'denied') {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Not an admin</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">You don&apos;t have permission to manage this club.</p>
          <Link href={`/club/${slug}`} className="mt-5 inline-block">
            <Button variant="outline">View club</Button>
          </Link>
        </div>
      </PlatformShell>
    )
  }

  return (
    <PlatformShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/club/${slug}`} className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]">
          ← {club?.name}
        </Link>
        <h1 className="cy-display mt-2 text-3xl font-semibold text-[#16150f] sm:text-4xl">Manage roster</h1>

        <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
          <h2 className="cy-display text-xl font-semibold text-[#16150f]">
            Members <span className="text-[#9a978d]">({roster.length})</span>
          </h2>
          <div className="mt-3 divide-y divide-[#efece4]">
            {roster.length === 0 && <p className="py-2 text-sm text-[#9a978d]">No members yet — add some below.</p>}
            {roster.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#16150f]">
                  {m.name}
                  {m.linked && (
                    <span className="rounded-full bg-[#dff3e4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f5a30]">
                      Linked
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Role for ${m.name}`}
                    className={selCls}
                    value={m.role}
                    onChange={(e) => onRole(m.id, e.target.value as ClubRole)}
                  >
                    {roleOptions(m.role, m.linked).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {!m.linked && (
                    <Button size="sm" variant="outline" aria-label={`Link ${m.name} to an account`} onClick={() => onLink(m)}>
                      Link
                    </Button>
                  )}
                  <Button size="sm" variant="outline" aria-label={`Remove ${m.name}`} onClick={() => onRemove(m.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onAdd} className="mt-4 flex flex-wrap gap-2 border-t border-[#efece4] pt-4">
            <Input name="name" placeholder="Player name" className="h-9 w-48" />
            <select name="role" className={`${selCls} h-9`} defaultValue="MEMBER">
              <option value="MEMBER">Member</option>
              <option value="MODERATOR">Moderator</option>
            </select>
            <Button type="submit" size="sm" disabled={adding} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
              {adding ? 'Adding…' : 'Add member'}
            </Button>
          </form>
          <p className="mt-2 text-xs text-[#9a978d]">
            Use Link to connect a member to their account — once linked, you can promote them to Admin.
          </p>
        </section>

        {/* Honours */}
        <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
          <h2 className="cy-display text-xl font-semibold text-[#16150f]">
            Honours <span className="text-[#9a978d]">({honors.length})</span>
          </h2>
          <p className="mt-1 text-sm text-[#6f6c63]">
            Your trophy cabinet — which cup, which year, who captained, and who played.
          </p>
          <div className="mt-3 divide-y divide-[#efece4]">
            {honors.length === 0 && <p className="py-2 text-sm text-[#9a978d]">No honours yet — add your first below.</p>}
            {honors.map((h) => (
              <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#16150f]">
                    {h.title}{' '}
                    <span className="font-normal text-[#9a978d]">
                      {[RESULT_LABEL[h.result] ?? h.result, h.season_label || h.year].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                  {(h.captainName || h.squad.length > 0) && (
                    <p className="mt-0.5 text-xs text-[#6f6c63]">
                      {h.captainName ? `Captain: ${h.captainName}` : ''}
                      {h.captainName && h.squad.length > 0 ? ' · ' : ''}
                      {h.squad.length > 0 ? `${h.squad.length} player${h.squad.length === 1 ? '' : 's'}` : ''}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" aria-label={`Remove ${h.title}`} onClick={() => onDeleteHonor(h.id, h.title)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {club && <HonorForm clubId={club.id} roster={roster} onSaved={loadHonors} />}
        </section>

        {roster.length >= 2 && (
          <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
            <h2 className="cy-display text-xl font-semibold text-[#16150f]">Merge duplicates</h2>
            <p className="mt-1 text-sm text-[#6f6c63]">
              Same player added twice? Merge them — everything moves to the one you keep.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select className={`${selCls} h-9`} value={loserId} onChange={(e) => setLoserId(e.target.value)} aria-label="Duplicate to remove">
                <option value="">Remove…</option>
                {roster.map((m) => (
                  <option key={m.personId} value={m.personId}>{m.name} ({m.role})</option>
                ))}
              </select>
              <span className="text-xs text-[#9a978d]">into</span>
              <select className={`${selCls} h-9`} value={winnerId} onChange={(e) => setWinnerId(e.target.value)} aria-label="Member to keep">
                <option value="">Keep…</option>
                {roster.map((m) => (
                  <option key={m.personId} value={m.personId}>{m.name} ({m.role})</option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={merging} onClick={onMerge}>
                {merging ? 'Merging…' : 'Merge'}
              </Button>
            </div>
          </section>
        )}
      </div>
    </PlatformShell>
  )
}

// Add-honour form: title/result/year, an optional captain, and a squad picked
// from the club roster (captain + squad are Persons, so account-less members
// count). Collapsed behind a button so it doesn't clutter the cabinet list.
function HonorForm({
  clubId,
  roster,
  onSaved,
}: {
  clubId: string
  roster: RosterMember[]
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [squad, setSquad] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSquad((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const title = String(f.get('title') || '').trim()
    if (!title) {
      toast.error('Title is required')
      return
    }
    const yearRaw = String(f.get('year') || '').trim()
    const captain = String(f.get('captain') || '')
    setSaving(true)
    try {
      await createHonor({
        clubId,
        title,
        result: String(f.get('result') || 'CHAMPION') as HonorResult,
        year: yearRaw ? Number(yearRaw) : null,
        seasonLabel: String(f.get('season') || '').trim() || null,
        captainPersonId: captain || null,
        notes: String(f.get('notes') || '').trim() || null,
        squad: [...squad],
      })
      form.reset()
      setSquad(new Set())
      setOpen(false)
      toast.success('Honour added')
      await onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-4" onClick={() => setOpen(true)}>
        + Add honour
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-[#efece4] pt-4">
      <div className="flex flex-wrap gap-2">
        <Input name="title" placeholder="Title, e.g. Bay Area Premier League" className="h-9 w-64" />
        <select name="result" className={`${selCls} h-9`} defaultValue="CHAMPION" aria-label="Result">
          <option value="CHAMPION">Champions</option>
          <option value="RUNNER_UP">Runners-up</option>
          <option value="THIRD">Third place</option>
          <option value="SPECIAL">Special</option>
        </select>
        <Input name="year" type="number" placeholder="Year" className="h-9 w-24" />
        <Input name="season" placeholder="Season (optional)" className="h-9 w-40" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-[#6f6c63]" htmlFor="honor-captain">Captain</label>
        <select id="honor-captain" name="captain" className={`${selCls} h-9`} defaultValue="">
          <option value="">— none —</option>
          {roster.map((m) => (
            <option key={m.personId} value={m.personId}>{m.name}</option>
          ))}
        </select>
      </div>

      {roster.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6f6c63]">Squad — who played ({squad.size})</p>
          <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {roster.map((m) => {
              const on = squad.has(m.personId)
              return (
                <button
                  type="button"
                  key={m.personId}
                  onClick={() => toggle(m.personId)}
                  aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    on
                      ? 'border-[#1f9d57] bg-[#e7f4ec] text-[#0f5a30]'
                      : 'border-[#e7e4db] bg-white text-[#3a382f] hover:border-[#d8d4c8]'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {m.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Input name="notes" placeholder="Notes (optional)" className="h-9 w-full" />

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
          {saving ? 'Saving…' : 'Add honour'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
