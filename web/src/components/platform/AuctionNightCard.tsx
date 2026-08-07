import Link from 'next/link'
import { Gavel, ArrowUpRight } from 'lucide-react'

// Surfaces the (separate, legacy) auction product as an optional organizer add-on
// from platform tournament manage. It's a hand-off to the auction tool's own hub
// (/auctions) — the auction runs on its own project and is set up there — not an
// embedded per-tournament flow, so the copy frames it as a distinct tool and the
// link opens in a new tab (keeping the manage context).
export function AuctionNightCard() {
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-[#cfe6d8] p-5 sm:p-6"
      style={{ background: 'linear-gradient(120deg,#eef7f1,#f6faf7)' }}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f4ec] text-[#0f5a30]">
          <Gavel className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f5a30]">
            Add-on
          </span>
          <h2 className="cy-display mt-1.5 text-xl font-semibold text-[#16150f]">Player auction night</h2>
          <p className="mt-1 text-sm text-[#5c5849]">
            Want an IPL-style player draft? The auction tool runs live bidding with per-team budgets and captains on
            their own devices. It&apos;s a separate tool — you set up your auction there.
          </p>
          <Link
            href="/auctions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#16150f] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2c2a20]"
          >
            <Gavel className="h-4 w-4" aria-hidden="true" /> Open the auction tool
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
