'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clubEmbedSnippet, clubEmbedPath } from '@/lib/platform/embed'

/** Manage-page widget: the <iframe> snippet a club pastes into their own website
 *  to embed their TossUp microsite card, plus a preview link. */
export function ClubEmbedSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  // This component only renders once the manage page's client auth gate has
  // loaded the club, so it never appears in the SSR tree — reading
  // window.location.origin at render is safe (no hydration mismatch).
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const snippet = origin ? clubEmbedSnippet(origin, slug) : ''

  async function copy() {
    if (!snippet) return
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the code and copy manually')
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-[#6f6c63]">
        Paste this into your club&apos;s website to show a live card that links back here.
      </p>
      <textarea
        readOnly
        value={snippet}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Embed code"
        rows={3}
        className="w-full rounded-xl border border-[#e7e4db] bg-[#f6f5f1] p-3 font-mono text-xs text-[#3a382f]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy} disabled={!snippet} className="gap-1.5 bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        <a
          href={clubEmbedPath(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-3 py-1.5 text-xs font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
        >
          <ExternalLink className="h-3.5 w-3.5 text-[#1f9d57]" /> Preview
        </a>
      </div>
    </div>
  )
}
