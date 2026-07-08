'use client'

import { useState } from 'react'
import { Check, MessageCircle, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  text?: string
  /** Path to share; defaults to the current page. Made absolute at click time. */
  path?: string
  /** 'pill' shows a labelled button pair; 'icon' is a compact single glyph. */
  variant?: 'pill' | 'icon'
  className?: string
}

export function ShareButton({ title, text, path, variant = 'pill', className }: Props) {
  const [copied, setCopied] = useState(false)

  const absoluteUrl = () =>
    new URL(path ?? window.location.pathname + window.location.search, window.location.origin).toString()

  const share = async () => {
    const url = absoluteUrl()
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text ?? title, url })
      } catch {
        // user dismissed the share sheet — nothing to do
      }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const whatsapp = () => {
    const msg = `${text ?? title}\n${absoluteUrl()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={share}
        aria-label="Share"
        title="Share"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-[#9a978d] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f]',
          className
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[#1f9d57]" /> : <Share2 className="h-3.5 w-3.5" />}
      </button>
    )
  }

  const pillCls =
    'flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-3 py-1.5 text-xs font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button type="button" onClick={share} className={pillCls}>
        {copied ? <Check className="h-3.5 w-3.5 text-[#1f9d57]" /> : <Share2 className="h-3.5 w-3.5" />}
        {copied ? 'Link copied' : 'Share'}
      </button>
      <button type="button" onClick={whatsapp} aria-label="Share on WhatsApp" className={pillCls}>
        <MessageCircle className="h-3.5 w-3.5 text-[#1f9d57]" /> WhatsApp
      </button>
    </div>
  )
}
