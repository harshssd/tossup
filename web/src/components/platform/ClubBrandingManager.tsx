'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Loader2, ImagePlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { imageUploadError, isValidHexColor } from '@/lib/platform/club-branding'
import {
  loadClubBranding,
  uploadClubImage,
  removeClubImage,
  setClubAccent,
  type ClubBranding,
} from '@/lib/platform/club-branding-client'

export function ClubBrandingManager({ clubId }: { clubId: string }) {
  const [branding, setBranding] = useState<ClubBranding>({ crest_url: null, cover_url: null, accent_color: null })
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<'crest' | 'cover' | 'accent' | null>(null)
  const [accent, setAccent] = useState('#1f9d57')
  const crestInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const b = await loadClubBranding(clubId)
        if (cancelled) return
        setBranding(b)
        if (b.accent_color) setAccent(b.accent_color)
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clubId])

  async function onFile(kind: 'crest' | 'cover', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    const err = imageUploadError(file)
    if (err) {
      toast.error(err)
      return
    }
    setBusy(kind)
    try {
      const url = await uploadClubImage(clubId, kind, file)
      setBranding((b) => ({ ...b, [kind === 'crest' ? 'crest_url' : 'cover_url']: url }))
      toast.success(`${kind === 'crest' ? 'Crest' : 'Cover'} updated`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onRemove(kind: 'crest' | 'cover') {
    setBusy(kind)
    try {
      await removeClubImage(clubId, kind)
      setBranding((b) => ({ ...b, [kind === 'crest' ? 'crest_url' : 'cover_url']: null }))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onSaveAccent(hex: string | null) {
    if (hex && !isValidHexColor(hex)) {
      toast.error('Enter a hex colour like #1f9d57')
      return
    }
    setBusy('accent')
    try {
      await setClubAccent(clubId, hex)
      setBranding((b) => ({ ...b, accent_color: hex }))
      toast.success(hex ? 'Accent colour saved' : 'Accent colour cleared')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!loaded) return <p className="mt-3 text-sm text-[#9a978d]">Loading…</p>

  return (
    <div className="mt-4 space-y-5">
      {/* Crest */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e7e4db] bg-[#f6f5f1]">
          {branding.crest_url ? (
            <Image src={branding.crest_url} alt="Club crest" width={64} height={64} className="h-full w-full object-cover" unoptimized />
          ) : (
            <ImagePlus className="h-5 w-5 text-[#b8b3a6]" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#16150f]">Crest / logo</p>
          <div className="mt-1 flex items-center gap-2">
            <input ref={crestInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile('crest', e)} />
            <Button size="sm" variant="outline" disabled={busy === 'crest'} onClick={() => crestInput.current?.click()}>
              {busy === 'crest' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : branding.crest_url ? 'Replace' : 'Upload'}
            </Button>
            {branding.crest_url && (
              <Button size="sm" variant="outline" disabled={busy === 'crest'} onClick={() => onRemove('crest')}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cover */}
      <div>
        <p className="text-sm font-semibold text-[#16150f]">Cover photo</p>
        <div className="mt-1.5 flex h-24 items-center justify-center overflow-hidden rounded-xl border border-[#e7e4db] bg-[#f6f5f1]">
          {branding.cover_url ? (
            <Image src={branding.cover_url} alt="Club cover" width={768} height={192} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-xs text-[#9a978d]">No cover photo yet</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile('cover', e)} />
          <Button size="sm" variant="outline" disabled={busy === 'cover'} onClick={() => coverInput.current?.click()}>
            {busy === 'cover' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : branding.cover_url ? 'Replace' : 'Upload'}
          </Button>
          {branding.cover_url && (
            <Button size="sm" variant="outline" disabled={busy === 'cover'} onClick={() => onRemove('cover')}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Accent */}
      <div>
        <p className="text-sm font-semibold text-[#16150f]">Accent colour</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            type="color"
            aria-label="Accent colour picker"
            value={isValidHexColor(accent) ? accent : '#1f9d57'}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-[#e7e4db] bg-white p-1"
          />
          <Input
            aria-label="Accent colour hex"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            placeholder="#1f9d57"
            className="h-9 w-28"
          />
          <Button size="sm" disabled={busy === 'accent'} onClick={() => onSaveAccent(accent)} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
            {busy === 'accent' ? 'Saving…' : 'Save'}
          </Button>
          {branding.accent_color && (
            <Button size="sm" variant="outline" disabled={busy === 'accent'} onClick={() => onSaveAccent(null)}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
