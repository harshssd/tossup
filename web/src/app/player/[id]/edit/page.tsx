'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { updateOwnedProfile } from '@/lib/platform/persons-client'
import { COUNTRIES, PLAYING_ROLES, roleLabel } from '@/lib/platform/recognition'
import type { PlayerProfile } from '@/lib/platform/queries'

const selectCls =
  'h-9 w-full rounded-md border border-[#e7e4db] bg-white px-2 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

// Owner-only profile editor (2026-08 audit U8: profiles were write-once — no
// edit surface existed at all). RLS (pp_owner_update + the trust-column guard)
// is the real gate; this page just also checks ownership for honest UX.
export default function EditPlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'guest' | 'denied' | 'ok'>('loading')
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const supabase = createPlatformBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState('guest')
        return
      }
      const { data: p } = await supabase.from('player_profiles').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      if (!p || p.user_id !== user.id) {
        setState('denied')
        return
      }
      setProfile(p as PlayerProfile)
      setState('ok')
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    const f = new FormData(e.currentTarget)
    const str = (k: string) => String(f.get(k) || '').trim() || null
    const display_name = String(f.get('display_name') || '').trim()
    if (!display_name) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await updateOwnedProfile(profile.id, {
        display_name,
        bio: str('bio'),
        city: str('city'),
        region: str('region'),
        country: str('country'),
        primary_role: str('primary_role'),
        availability: str('availability'),
        batting_style: str('batting_style'),
        bowling_style: str('bowling_style'),
        looking_for_club: f.get('looking_for_club') === 'on',
      })
      toast.success('Profile saved')
      router.push(`/player/${profile.id}`)
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  if (state === 'loading')
    return (
      <PlatformShell>
        <p className="px-4 py-16 text-center text-sm text-[#9a978d]">Loading…</p>
      </PlatformShell>
    )
  if (state === 'guest')
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Sign in to edit your profile</h1>
          <Link
            href={`/account/sign-in?redirect=/player/${id}/edit`}
            className="mt-5 inline-flex rounded-full bg-[#1f9d57] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f5a30]"
          >
            Sign in
          </Link>
        </div>
      </PlatformShell>
    )
  if (state === 'denied' || !profile)
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Not your profile</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">Only the profile&apos;s owner can edit it.</p>
          <Link href={`/player/${id}`} className="mt-5 inline-block text-sm font-semibold text-[#0f5a30] underline">
            View profile
          </Link>
        </div>
      </PlatformShell>
    )

  return (
    <PlatformShell>
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link
          href={`/player/${profile.id}`}
          className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]"
        >
          ← {profile.display_name}
        </Link>
        <h1 className="cy-display mt-2 text-3xl font-semibold text-[#16150f]">Edit profile</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-[#6f6c63]">Name</span>
            <Input name="display_name" defaultValue={profile.display_name} required className="mt-1 h-9" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#6f6c63]">Bio</span>
            <Textarea name="bio" rows={3} defaultValue={profile.bio ?? ''} className="mt-1" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">Country</span>
              <select name="country" defaultValue={profile.country ?? ''} className={`mt-1 ${selectCls}`}>
                <option value="">—</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">State / region</span>
              <Input name="region" defaultValue={profile.region ?? ''} className="mt-1 h-9" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">City</span>
              <Input name="city" defaultValue={profile.city ?? ''} className="mt-1 h-9" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">Primary role</span>
              <select name="primary_role" defaultValue={profile.primary_role ?? ''} className={`mt-1 ${selectCls}`}>
                <option value="">—</option>
                {PLAYING_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">Availability</span>
              <Input name="availability" defaultValue={profile.availability ?? ''} placeholder="e.g. weekends" className="mt-1 h-9" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">Batting style</span>
              <Input name="batting_style" defaultValue={profile.batting_style ?? ''} placeholder="e.g. RHB" className="mt-1 h-9" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#6f6c63]">Bowling style</span>
              <Input name="bowling_style" defaultValue={profile.bowling_style ?? ''} placeholder="e.g. Right-arm medium" className="mt-1 h-9" />
            </label>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2.5 text-sm font-semibold text-[#16150f]">
            <input type="checkbox" name="looking_for_club" defaultChecked={!!profile.looking_for_club} className="h-4 w-4 accent-[#1f9d57]" />
            I&apos;m looking for a club (shows you on the Discover recruiting board)
          </label>
          <Button type="submit" size="sm" disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </div>
    </PlatformShell>
  )
}
