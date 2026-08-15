'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { createClient as createLegacyClient } from '@/lib/supabase'

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  async function signOut() {
    // Sign out BOTH sessions: the platform account and the separate legacy
    // auction-tool account. Without the second call, "Sign out" on a shared
    // machine left the auction session alive (2026-08 audit U2).
    await Promise.allSettled([
      createPlatformBrowserClient().auth.signOut(),
      createLegacyClient().auth.signOut(),
    ])
    router.push('/discover')
    router.refresh()
  }
  return (
    <button onClick={signOut} className={className ?? 'flex items-center gap-1.5 text-sm font-semibold text-[#6f6c63] hover:text-[#c0431a]'}>
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  )
}
