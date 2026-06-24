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
  removeClubMember,
  setClubMemberRole,
  type ClubRole,
  type RosterMember,
} from '@/lib/platform/club-admin'

const selCls = 'h-8 rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'
const ROLES: ClubRole[] = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']

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

  const loadRoster = useCallback(async () => {
    if (!club) return
    try {
      setRoster(await getClubRoster(club.id))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [club])

  useEffect(() => {
    if (access === 'ok') loadRoster()
  }, [access, loadRoster])

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
                <span className="text-sm font-semibold text-[#16150f]">{m.name}</span>
                <div className="flex items-center gap-2">
                  <select className={selCls} value={m.role} onChange={(e) => onRole(m.id, e.target.value as ClubRole)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={() => onRemove(m.id)}>Remove</Button>
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
            Admins must be linked to a user account — promote to Admin/Owner after linking (coming soon).
          </p>
        </section>
      </div>
    </PlatformShell>
  )
}
