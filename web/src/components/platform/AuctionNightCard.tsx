import Link from 'next/link'
import { Gavel, ArrowUpRight } from 'lucide-react'

// Repositions the (separate, legacy) auction product as a premium organizer
// add-on, surfaced from platform tournament manage. It's a hand-off to the
// auction tool's own hub (/auctions) — the auction runs on its own project and
// sets up there — not an embedded flow.
export function AuctionNightCard() {
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: '#f0d98a', background: 'linear-gradient(120deg,#fbf3d6,#fdfaf0)' }}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fbe7b8] text-[#8a6d12]">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-[#8a6d12] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            Premium
          </span>
          <h2 className="cy-display mt-1.5 text-xl font-semibold text-[#16150f]">Player auction night</h2>
          <p className="mt-1 text-sm text-[#5c5849]">
            Run a live, IPL-style player auction for your tournament — draft squads, real-time bidding, and per-team
            budgets. Captains join from their own devices.
          </p>
          <Link
            href="/auctions"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#16150f] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2c2a20]"
          >
            <Gavel className="h-4 w-4" /> Launch the auction tool <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
