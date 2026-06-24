import { Suspense } from 'react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { AccountAuthForm } from '@/components/platform/AccountAuthForm'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return (
    <PlatformShell>
      <div className="mx-auto max-w-md px-4 py-12">
        <Suspense>
          <AccountAuthForm mode="sign-up" />
        </Suspense>
      </div>
    </PlatformShell>
  )
}
