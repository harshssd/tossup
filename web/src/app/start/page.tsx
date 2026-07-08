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
        </div>
      </PlatformShell>
    )
  }

  let initial = null
  if (user.primaryPersonId) {
    const supabase = await createPlatformServerClient()
    const { data } = await supabase
      .from('player_profiles')
      .select('city, region, country, primary_role, availability, looking_for_club')
      .eq('id', user.primaryPersonId)
      .maybeSingle()
    initial = data
  }

  return (
    <PlatformShell>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <StartWizard personId={user.primaryPersonId} displayName={user.name ?? user.email ?? 'Player'} initial={initial} />
      </div>
    </PlatformShell>
  )
}
