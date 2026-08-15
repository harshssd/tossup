import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Shield, Plus, Heart } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'

// Transparent, public pricing — a deliberate strategy move (2026-08 audit
// research): CricClubs and TeamSnap both sales-gate league pricing, and that
// opacity is their most-cited trust complaint. Payments aren't wired yet, so
// paid tiers are honest "founding season free" pre-orders, not checkout.
export const metadata: Metadata = {
  title: 'Pricing — TossUp',
  description:
    'Simple, public pricing. Players are free forever — profiles, points tables, and honors never go behind a paywall. Clubs and leagues pay for organizer superpowers.',
}

// Everything in FREE exists in the product today — this list is verifiable.
const FREE = [
  'Club page with roster, events & RSVPs',
  'Tournament hosting: registrations → fixtures → standings',
  'Trophy cabinet & verified honors',
  'Player profiles, discovery & "clubs near me"',
  'Share cards for WhatsApp & Instagram',
  'Follows, feed, notifications & weekly digest',
  'Club branding: crest, cover photo & accent',
  'Unlimited co-admins',
  'Embeddable club widget for your website',
]

// The Pro lists are ROADMAP, and the page says so explicitly ("what Pro will
// add") — presenting planned features as current would defeat the page's whole
// trust thesis (2026-08 review).
const CLUB_PRO = [
  'Priority placement in Discover',
  'Your crest on result share-cards',
  'Recognition review fast-track',
  'Email delivery for member digests',
  'Season archive & exports',
]

const LEAGUE_PRO = [
  'Everything in Club Pro',
  'Registrations with custom questions',
  'Sponsor strip on YOUR result share-cards',
  'Collect team fees online (at-cost + small platform fee)',
  'Exportable standings & records',
]

export default function PricingPage() {
  return (
    <PlatformShell>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="cy-display text-4xl font-semibold text-[#16150f] sm:text-5xl">
            Simple pricing, published for everyone
          </h1>
          <p className="mt-3 text-base text-[#6f6c63]">
            No sales calls, no hidden league quotes. Players never pay — organizers pay for superpowers.
          </p>
        </div>

        {/* The promise — the trust wedge, stated as commitment */}
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[#bfe3cc] bg-[#f2faf5] p-5 text-center">
          <p className="flex items-center justify-center gap-2 font-semibold text-[#0f5a30]">
            <Heart className="h-4 w-4" aria-hidden /> The TossUp promise
          </p>
          <p className="mt-1.5 text-sm text-[#3a382f]">
            Player profiles, points tables, and honors are <strong>free forever</strong> — we will never paywall your
            identity or your club&apos;s history, and we will never run ads in your feed.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Free */}
          <div className="cy-panel flex flex-col rounded-2xl border border-[#e7e4db] p-6">
            <h2 className="cy-display text-xl font-semibold text-[#16150f]">Free</h2>
            <p className="mt-1 text-sm text-[#6f6c63]">For every player, club, and league. Forever.</p>
            <p className="mt-4 text-3xl font-bold text-[#16150f]">
              $0<span className="text-sm font-semibold text-[#9a978d]"> / forever</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#3a382f]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1f9d57]" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/club/new"
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#1f9d57] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0f5a30]"
              >
                <Shield className="h-4 w-4" /> Start your club
              </Link>
              <Link
                href="/tournaments/new"
                className="flex items-center justify-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-4 py-2.5 text-sm font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
              >
                <Plus className="h-4 w-4" /> Host a tournament
              </Link>
            </div>
          </div>

          {/* Club Pro */}
          <div className="cy-panel flex flex-col rounded-2xl border-2 border-[#1f9d57] p-6">
            <div className="flex items-center justify-between">
              <h2 className="cy-display text-xl font-semibold text-[#16150f]">Club Pro</h2>
              <span className="rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f5a30]">
                Founding season free
              </span>
            </div>
            <p className="mt-1 text-sm text-[#6f6c63]">For clubs that want the full clubhouse.</p>
            <p className="mt-4 text-3xl font-bold text-[#16150f]">
              $149<span className="text-sm font-semibold text-[#9a978d]"> / year</span>
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#9a978d]">What Pro will add</p>
            <ul className="mt-2 flex-1 space-y-2.5">
              {CLUB_PRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#3a382f]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1f9d57]" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl bg-[#f6f5f1] px-3 py-2.5 text-center text-xs text-[#6f6c63]">
              Pro is <strong>in build</strong> — nothing above is live yet. Founding clubs get their first Pro season
              free when it ships. Start free today; you keep everything either way.
            </p>
          </div>

          {/* League Pro */}
          <div className="cy-panel flex flex-col rounded-2xl border border-[#e7e4db] p-6">
            <div className="flex items-center justify-between">
              <h2 className="cy-display text-xl font-semibold text-[#16150f]">League Pro</h2>
              <span className="rounded-full bg-[#fcf3d6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9a6b09]">
                Founding season free
              </span>
            </div>
            <p className="mt-1 text-sm text-[#6f6c63]">For organizers running real seasons.</p>
            <p className="mt-4 text-3xl font-bold text-[#16150f]">
              $299<span className="text-sm font-semibold text-[#9a978d]"> / year</span>
              <span className="ml-2 align-middle text-sm font-semibold text-[#9a978d]">or $39 / tournament</span>
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#9a978d]">What Pro will add</p>
            <ul className="mt-2 flex-1 space-y-2.5">
              {LEAGUE_PRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#3a382f]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1f9d57]" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl bg-[#f6f5f1] px-3 py-2.5 text-center text-xs text-[#6f6c63]">
              Pro is <strong>in build</strong> — nothing above is live yet. Founding leagues get their first Pro season
              free when it ships; the fee schedule for online registration payments will be published on this page.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-4 text-sm text-[#6f6c63]">
          <div>
            <p className="font-semibold text-[#16150f]">Why is pricing public?</p>
            <p className="mt-1">
              Because you shouldn&apos;t need a sales call to find out what your league would pay. What you see here is
              what it costs.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#16150f]">What happens if I never upgrade?</p>
            <p className="mt-1">
              Nothing bad. Your page, roster, history, honors, and every player&apos;s profile stay live and free. Pro
              adds organizer conveniences on top — it never takes away the base.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#16150f]">Cricket is seasonal — is billing?</p>
            <p className="mt-1">Yes: annual, aligned to your season. No monthly drip through the off-season.</p>
          </div>
        </div>
      </div>
    </PlatformShell>
  )
}
