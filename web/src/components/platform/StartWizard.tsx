'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MapPin, Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { COUNTRIES, PLAYING_ROLES } from '@/lib/platform/recognition'
import { listClubs, type Club } from '@/lib/platform/queries'
import { updateOwnedProfile, createOwnedPlayerProfile } from '@/lib/platform/persons-client'
import { onboardingProfileFields } from '@/lib/platform/onboarding'
import { ClubCard } from './ClubCard'

const selCls = 'h-10 w-full rounded-md border border-[#e7e4db] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'
const roleLabel = (r: string) => r.replace(/_/g, '-').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

interface InitialProfile {
  city?: string | null
  region?: string | null
  country?: string | null
  primary_role?: string | null
  availability?: string | null
}

const INTENTS = [
  { key: 'moved', label: 'I just moved here', hint: 'New city, need a club to play with' },
  { key: 'play', label: 'I want to play more', hint: 'Looking for regular games and practice' },
  { key: 'join', label: 'Looking to join a club', hint: "I'm ready to find a team" },
]

export function StartWizard({
  personId,
  displayName,
  initial,
}: {
  personId: string | null
  displayName: string
  initial: InitialProfile | null
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [city, setCity] = useState(initial?.city ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [role, setRole] = useState(initial?.primary_role ?? '')
  const [availability, setAvailability] = useState(initial?.availability ?? '')
  const [saving, setSaving] = useState(false)
  const [matches, setMatches] = useState<Club[]>([])

  async function findClubs() {
    if (!region.trim() && !city.trim()) {
      toast.error('Add at least your city or state so we can match you')
      return
    }
    setSaving(true)
    try {
      const fields = onboardingProfileFields({ city, region, country, role, availability })
      if (personId) {
        await updateOwnedProfile(personId, fields)
      } else {
        await createOwnedPlayerProfile({ display_name: displayName, ...fields })
      }
      const clubs = await listClubs({
        recruiting: true,
        region: region.trim() || undefined,
        country: country || undefined,
      })
      setMatches(clubs)
      setStep(3)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9a978d]">
        <span className={step >= 1 ? 'text-[#1f9d57]' : ''}>1 · You</span>
        <span>·</span>
        <span className={step >= 2 ? 'text-[#1f9d57]' : ''}>2 · Where</span>
        <span>·</span>
        <span className={step >= 3 ? 'text-[#1f9d57]' : ''}>3 · Matches</span>
      </div>

      {step === 1 && (
        <div className="mt-4">
          <h1 className="cy-display text-3xl font-bold text-[#16150f]">What brings you to TossUp?</h1>
          <p className="mt-1 text-sm text-[#6f6c63]">Pick what fits — either way, we&apos;ll help you find a club.</p>
          <div className="mt-5 space-y-2.5">
            {INTENTS.map((it) => (
              <button
                key={it.key}
                onClick={() => setStep(2)}
                className="flex w-full items-center justify-between rounded-2xl border border-[#e7e4db] bg-white px-5 py-4 text-left transition-colors hover:border-[#1f9d57]"
              >
                <span>
                  <span className="block font-semibold text-[#16150f]">{it.label}</span>
                  <span className="block text-sm text-[#6f6c63]">{it.hint}</span>
                </span>
                <span className="text-[#1f9d57]">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4">
          <h1 className="cy-display text-3xl font-bold text-[#16150f]">Where do you play?</h1>
          <p className="mt-1 text-sm text-[#6f6c63]">We&apos;ll match you with clubs recruiting near you.</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-[#3a382f]">City</span>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Jose" className="h-10" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-[#3a382f]">State / province</span>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. California" className="h-10" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-[#3a382f]">Country</span>
              <select className={selCls} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-[#3a382f]">Main role</span>
              <select className={selCls} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Any / not sure</option>
                {PLAYING_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-[#3a382f]">Availability (optional)</span>
              <Input
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g. Weekends and Wednesday evenings"
                className="h-10"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={findClubs} disabled={saving} className="gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
              <Search className="h-4 w-4" /> {saving ? 'Finding…' : 'Find my club'}
            </Button>
            <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
              Back
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#9a978d]">This also marks you “looking for a club”, so clubs recruiting near you can reach out.</p>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0f5a30]">
            <Check className="h-4 w-4" /> You&apos;re on the map — clubs near you can find you now.
          </p>
          <h1 className="cy-display mt-2 text-3xl font-bold text-[#16150f]">
            {matches.length > 0 ? 'Clubs recruiting near you' : 'No clubs recruiting here yet'}
          </h1>
          {matches.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map((c, i) => (
                <ClubCard key={c.id} club={c} index={i} />
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[#6f6c63]">
              <MapPin className="h-4 w-4" /> No open spots in {region || city} right now — you&apos;ll show up when clubs look for players.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/discover?tab=recruiting" className="font-bold text-[#1f9d57] hover:underline">
              Browse the recruiting board →
            </Link>
            <Link href="/discover?tab=clubs" className="font-semibold text-[#6f6c63] hover:text-[#16150f]">
              Explore all clubs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
