'use client'

import { useState } from 'react'
import { ImageDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Same-origin path to the PNG (e.g. /api/share/fixture/[id]). */
  imagePath: string
  /** Share-sheet title + text (used when native file share is available). */
  title: string
  text?: string
  /** Download filename (no extension). */
  filename: string
  variant?: 'pill' | 'icon'
  className?: string
}

/** Shares a generated result-card image: native file share on mobile (→ WhatsApp /
 *  Instagram / etc.), falling back to opening the PNG in a new tab so the user can
 *  save it. Kept resilient — any capability gap or error lands on the open-tab path. */
export function ShareImageButton({ imagePath, title, text, filename, variant = 'pill', className }: Props) {
  const [busy, setBusy] = useState(false)

  const shareCard = async () => {
    const url = new URL(imagePath, window.location.origin).toString()
    setBusy(true)
    try {
      // Prefer sharing the actual image file (best on mobile).
      if (typeof navigator !== 'undefined' && navigator.canShare) {
        const res = await fetch(url)
        if (res.ok) {
          const blob = await res.blob()
          const file = new File([blob], `${filename}.png`, { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text: text ?? title })
            return
          }
        }
      }
      // Fallback: open the image so the user can save or share it manually.
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // Share sheet dismissed, fetch/CSP failure, etc. — offer the raw image.
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={shareCard}
        disabled={busy}
        aria-label="Share result card"
        title="Share result card"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-[#9a978d] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f] disabled:opacity-50',
          className
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={shareCard}
      disabled={busy}
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-3 py-1.5 text-xs font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30] disabled:opacity-50',
        className
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5 text-[#1f9d57]" />}
      Result card
    </button>
  )
}
