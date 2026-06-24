'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  async function signOut() {
    await createPlatformBrowserClient().auth.signOut()
    router.push('/discover')
    router.refresh()
  }
  return (
    <button onClick={signOut} className={className ?? 'flex items-center gap-1.5 text-sm font-semibold text-[#6f6c63] hover:text-[#c0431a]'}>
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  )
}
