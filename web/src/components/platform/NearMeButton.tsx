'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Navigation, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Toggles the "clubs near me" mode on /discover. When off, requests the browser
 *  geolocation and navigates with a `?near=lat,lng` param; when on, clears it.
 *  Geolocation is client-only — no server-side geocoding needed. */
export function NearMeButton({ active }: { active: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (active) {
    return (
      <Button size="sm" variant="outline" onClick={() => router.push('/discover?tab=clubs')} className="gap-1.5">
        <X className="h-3.5 w-3.5" /> Clear &ldquo;near me&rdquo;
      </Button>
    )
  }

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Location isn’t available in this browser')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        router.push(`/discover?tab=clubs&near=${latitude.toFixed(5)},${longitude.toFixed(5)}`)
        setBusy(false)
      },
      () => {
        toast.error('Couldn’t get your location — allow location access and try again')
        setBusy(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={locate} className="gap-1.5" aria-busy={busy}>
      <Navigation className={`h-3.5 w-3.5 ${busy ? 'animate-pulse' : ''}`} aria-hidden />
      {busy ? 'Locating…' : 'Clubs near me'}
    </Button>
  )
}
