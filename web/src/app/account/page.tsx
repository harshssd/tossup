import { redirect } from 'next/navigation'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { SignOutButton } from '@/components/platform/SignOutButton'
import { getPlatformUser } from '@/lib/platform/auth-server'
import { getPersonsForUser } from '@/lib/platform/persons'
import { initials, roleLabel } from '@/lib/platform/recognition'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getPlatformUser()
  if (!user) redirect('/account/sign-in?redirect=/account')

  const persons = await getPersonsForUser(user.id)

  return (
    <PlatformShell>
      <div className="mx-auto max-w-lg px-4 py-12">
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

        <div className="cy-panel mt-4 rounded-2xl p-6">
          <h2 className="cy-display text-lg font-semibold text-[#16150f]">Your players</h2>
          <p className="mt-0.5 text-xs text-[#6f6c63]">Player profiles linked to your account.</p>
          <div className="mt-4 space-y-2">
            {persons.length === 0 && <p className="text-sm text-[#9a978d]">No linked players yet.</p>}
            {persons.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef0ea] text-[11px] font-bold text-[#6f6c63]">
                  {initials(p.display_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#16150f]">{p.display_name}</p>
                  <p className="truncate text-xs text-[#9a978d]">{roleLabel(p.primary_role)}</p>
                </div>
                {p.id === user.primaryPersonId && (
                  <span className="rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f5a30]">You</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PlatformShell>
  )
}
