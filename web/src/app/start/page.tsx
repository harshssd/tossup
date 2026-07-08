import Link from 'next/link'
import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { Button } from '@/components/ui/button'
import { getPlatformUser, createPlatformServerClient } from '@/lib/platform/auth-server'
import { StartWizard } from '@/components/platform/StartWizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Find your club — TossUp',
  description: 'New in town or looking for a game? Tell us where you are and what you play, and we’ll match you with cricket clubs recruiting near you.',
}

export default async function StartPage() {
  const user = await getPlatformUser()

  if (!user) {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Compass className="mx-auto h-10 w-10 text-[#1f9d57]" />
          <h1 className="cy-display mt-4 text-3xl font-bold text-[#16150f]">Find your cricket club</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">
            Sign in and we&apos;ll match you with clubs recruiting near you — and put you on the map so clubs can find you too.
          </p>
          <Link href="/account/sign-in?redirect=/start">
            <Button className="mt-6 bg-[#1f9d57] text-white hover:bg-[#0f5a30]">Sign in to get started</Button>
          </Link>
          <p className="mt-4 text-sm text-[#9a978d]">
            or{' '}
            <Link href="/discover?tab=clubs" className="font-semibold text-[#1f9d57] hover:underline">
              browse clubs first
            </Link>
          </p>
        </div>
      </PlatformShell>
    )
  }

  const supabase = await createPlatformServerClient()

  // Always operate on the user's canonical primary Person. The signup trigger
  // normally creates + links one; if it's missing, ensure_self_person creates and
  // links it (so we never orphan a second profile with primary_person_id left null).
  let personId = user.primaryPersonId
  if (!personId) {
    const { data } = await supabase.rpc('ensure_self_person', {
      p_display_name: user.name ?? user.email ?? 'Player',
    })
    personId = data ?? null
  }

  if (!personId) {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="cy-display text-2xl font-bold text-[#16150f]">We couldn&apos;t set up your profile</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">Something went wrong. Please refresh and try again.</p>
          <Link href="/discover?tab=clubs" className="mt-4 inline-block font-semibold text-[#1f9d57] hover:underline">
            Browse clubs instead →
          </Link>
        </div>
      </PlatformShell>
    )
  }

  const { data: initial } = await supabase
    .from('player_profiles')
    .select('city, region, country, primary_role, availability, looking_for_club')
    .eq('id', personId)
    .maybeSingle()

  return (
    <PlatformShell>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <StartWizard personId={personId} initial={initial} />
      </div>
    </PlatformShell>
  )
}
