'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { COUNTRIES, PLAYING_ROLES, roleLabel } from '@/lib/platform/recognition'
import { loadClubSettings, updateClubSettings, type ClubSettingsPatch } from '@/lib/platform/club-admin'

const selectCls =
  'h-9 w-full rounded-md border border-[#e7e4db] bg-white px-2 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

/** Club Settings (2026-08 audit U3): every field from the create form is now
 *  editable post-creation — most importantly `is_recruiting`/`roles_needed`,
 *  the club's discovery lever, which previously could never be changed. */
export function ClubSettingsForm({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [values, setValues] = useState<ClubSettingsPatch | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [recruiting, setRecruiting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadClubSettings(clubId)
      .then((v) => {
        if (cancelled || !v) return
        setValues(v)
        setRecruiting(!!v.is_recruiting)
        setRoles(v.roles_needed ?? [])
      })
      .catch((err) => {
        if (!cancelled) toast.error((err as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [clubId])

  if (!values) return <p className="mt-3 text-sm text-[#9a978d]">Loading…</p>

  const str = (f: FormData, k: string) => String(f.get(k) || '').trim() || null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name') || '').trim()
    if (!name) {
      toast.error('Club name is required')
      return
    }
    setSaving(true)
    try {
      await updateClubSettings(clubId, {
        name,
        description: str(f, 'description'),
        country: str(f, 'country'),
        region: str(f, 'region'),
        city: str(f, 'city'),
        website: str(f, 'website'),
        contact_email: str(f, 'contact_email'),
        founded_year: f.get('founded_year') ? Number(f.get('founded_year')) : null,
        is_recruiting: recruiting,
        roles_needed: recruiting ? roles : [],
      })
      toast.success('Club settings saved')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">Club name</span>
          <Input name="name" defaultValue={values.name ?? ''} required className="mt-1 h-9" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">Founded year</span>
          <Input name="founded_year" type="number" defaultValue={values.founded_year ?? ''} className="mt-1 h-9" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-[#6f6c63]">Description</span>
        <Textarea name="description" rows={3} defaultValue={values.description ?? ''} className="mt-1" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">Country</span>
          <select name="country" defaultValue={values.country ?? ''} className={`mt-1 ${selectCls}`}>
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
          <Input name="region" defaultValue={values.region ?? ''} className="mt-1 h-9" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">City</span>
          <Input name="city" defaultValue={values.city ?? ''} className="mt-1 h-9" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">Website</span>
          <Input name="website" type="url" defaultValue={values.website ?? ''} className="mt-1 h-9" placeholder="https://" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#6f6c63]">Contact email</span>
          <Input name="contact_email" type="email" defaultValue={values.contact_email ?? ''} className="mt-1 h-9" />
        </label>
      </div>

      <div className="rounded-xl border border-[#e7e4db] bg-[#f6f5f1] p-3">
        <button
          type="button"
          onClick={() => setRecruiting((r) => !r)}
          aria-pressed={recruiting}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            recruiting ? 'bg-[#1f9d57] text-white' : 'border border-[#d8d4c8] bg-white text-[#6f6c63]'
          }`}
        >
          {recruiting ? 'Recruiting: ON' : 'Recruiting: OFF'}
        </button>
        <p className="mt-1.5 text-xs text-[#9a978d]">
          Recruiting clubs appear on the Discover recruiting board and show a &ldquo;Recruiting players&rdquo; banner.
        </p>
        {recruiting && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLAYING_ROLES.map((r) => {
              const on = roles.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoles((xs) => (on ? xs.filter((x) => x !== r) : [...xs, r]))}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    on ? 'bg-[#0f5a30] text-white' : 'border border-[#d8d4c8] bg-white text-[#6f6c63]'
                  }`}
                >
                  {roleLabel(r)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Button type="submit" size="sm" disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  )
}
