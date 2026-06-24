'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { initials } from '@/lib/platform/recognition'

// Header auth slot for the platform chrome. Reflects the platform session
// client-side (no SSR auth coupling, so it works whether the parent page is a
// server or client component). Renders nothing until the first auth event to
// avoid a logged-out flash / hydration mismatch.
export function PlatformAuthNav() {
  const [label, setLabel] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createPlatformBrowserClient()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setSignedIn(!!u)
      setLabel((u?.user_metadata?.name as string | undefined) || u?.email || null)
      setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null

  if (!signedIn) {
    return (
      <Link
        href="/account/sign-in"
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[#6f6c63] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f]"
      >
        <LogIn className="h-4 w-4" /> Sign in
      </Link>
    )
  }

  return (
    <Link href="/account" title={label ?? 'Account'} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-[#eef0ea]">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f5a30] text-[11px] font-bold text-white">
        {initials(label ?? 'P')}
      </span>
    </Link>
  )
}
