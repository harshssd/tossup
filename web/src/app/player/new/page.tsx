'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createPlayerProfile } from '@/lib/platform/queries'
import { COUNTRIES, PLAYING_ROLES, roleLabel } from '@/lib/platform/recognition'
import { PlatformShell } from '@/components/platform/PlatformShell'

export default function NewPlayerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [looking, setLooking] = useState(true)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const display_name = String(f.get('display_name') || '').trim()
    if (!display_name) return
    setSaving(true)
    try {
      const p = await createPlayerProfile({
        display_name,
        primary_role: str(f, 'primary_role'),
        batting_style: str(f, 'batting_style'),
        bowling_style: str(f, 'bowling_style'),
        country: str(f, 'country'),
        region: str(f, 'region'),
        city: str(f, 'city'),
        availability: str(f, 'availability'),
        bio: str(f, 'bio'),
        contact_email: str(f, 'contact_email'),
        contact_phone: str(f, 'contact_phone'),
        looking_for_club: looking,
      })
      toast.success('Profile created')
      router.push(`/player/${p.id}`)
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <PlatformShell>
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="cy-panel rounded-3xl p-6 sm:p-8">
      <h1 className="cy-display text-3xl font-semibold text-[#16150f] sm:text-4xl">Create a player profile</h1>
      <p className="mt-2 text-sm text-[#6f6c63]">Get discovered by clubs recruiting in your area.</p>
      <div className="cy-seam mt-5 max-w-[10rem]" />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Name" required>
          <Input name="display_name" required />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Role">
            <Select name="primary_role">
              <option value="">—</option>
              {PLAYING_ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Batting">
            <Input name="batting_style" placeholder="Right-hand" />
          </Field>
          <Field label="Bowling">
            <Input name="bowling_style" placeholder="Right-arm off" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Country">
            <Select name="country">
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="State / region">
            <Input name="region" />
          </Field>
          <Field label="City">
            <Input name="city" />
          </Field>
        </div>
        <Field label="Availability">
          <Input name="availability" placeholder="Weekends, evenings…" />
        </Field>
        <Field label="Bio">
          <Textarea name="bio" rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact email">
            <Input name="contact_email" type="email" />
          </Field>
          <Field label="Contact phone">
            <Input name="contact_phone" />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-md border border-[#e7e4db] p-3">
          <div>
            <p className="text-sm font-medium">Looking for a club</p>
            <p className="text-xs text-muted-foreground">Surface your profile to recruiting clubs.</p>
          </div>
          <Switch checked={looking} onCheckedChange={setLooking} />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Creating…' : 'Create profile'}
        </Button>
      </form>
      </div>
    </div>
    </PlatformShell>
  )
}

function str(f: FormData, k: string): string | null {
  const v = String(f.get(k) || '').trim()
  return v || null
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">
        {label} {required && <span className="text-[#d64545]">*</span>}
      </Label>
      {children}
    </div>
  )
}
function Select({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <select
      name={name}
      className="h-9 w-full rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]"
    >
      {children}
    </select>
  )
}
