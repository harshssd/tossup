import { redirect } from 'next/navigation'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { SignOutButton } from '@/components/platform/SignOutButton'
import { getPlatformUser } from '@/lib/platform/auth-server'
import { initials } from '@/lib/platform/recognition'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getPlatformUser()
  if (!user) redirect('/account/sign-in?redirect=/account')

  return (
    <PlatformShell>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="cy-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f5a30] text-sm font-bold text-white">
              {initials(user.name || user.email || 'Player')}
            </span>
            <div className="min-w-0">
              <h1 className="cy-display truncate text-xl font-semibold text-[#16150f]">{user.name || 'Your account'}</h1>
              <p className="truncate text-sm text-[#6f6c63]">{user.email}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#ece9e1] pt-4">
            <SignOutButton />
          </div>
        </div>
      </div>
    </PlatformShell>
  )
}
