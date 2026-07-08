import Link from 'next/link'
import type { Metadata } from 'next'
import { Compass, Gavel, Plus, Shield, Trophy, Users } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { CricketBall } from '@/components/platform/CricketBall'

export const metadata: Metadata = {
  title: 'TossUp — Find your cricket club. Host your league.',
  description:
    'The home of grassroots cricket — discover clubs and players near you, host tournaments with live standings, and give your club a public face.',
}

const TICKER = ['Find your club', 'Recruit players', 'Host a tournament', 'Live standings', 'Recognized results', 'Grassroots → Official']

const PILLARS = [
  {
    icon: Trophy,
    title: 'Host your league',
    body: 'Registrations, fixtures, results, and auto-standings — plus the Pavilion, a comms board that replaces the WhatsApp group.',
    href: '/tournaments/new',
    cta: 'Host a tournament',
  },
  {
    icon: Shield,
    title: 'Grow your club',
    body: 'A public club page with roster and recognition tier. Add every player who ever wore the shirt — no app install required.',
    href: '/club/new',
    cta: 'Start a club',
  },
  {
    icon: Users,
    title: 'Get discovered',
    body: 'New in town? Find recreational cricket near you — clubs recruiting players, tournaments open for teams.',
    href: '/discover',
    cta: 'Discover cricket near you',
  },
]

export default function Home() {
  return (
    <PlatformShell>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(closest-side_at_50%_30%,#eaf6ee,transparent_70%)]"
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="flex justify-center">
            <CricketBall size={72} className="drop-shadow-[0_0_26px_rgba(193,18,31,0.45)]" />
          </div>
          <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#e7f4ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f5a30]">
            <span className="cy-pulse h-1.5 w-1.5 rounded-full bg-[#1f9d57]" /> The home of grassroots cricket
          </span>
          <h1 className="cy-display mt-5 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            <span className="text-[#16150f]">Find your club.</span>
            <br />
            <span className="text-[#16150f]">Host your </span>
            <span className="cy-grad-text">league.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#6f6c63]">
            Discover clubs and players near you, run tournaments with live standings, and give your
            club a public face — from your local turf to the recognized leagues.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/start"
              className="flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(31,157,87,0.7)] transition-transform hover:scale-[1.03]"
            >
              <Compass className="h-4 w-4" /> Find your club
            </Link>
            <Link
              href="/tournaments/new"
              className="flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-6 py-3 text-sm font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
            >
              <Plus className="h-4 w-4" /> Host a tournament
            </Link>
            <Link
              href="/club/new"
              className="flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-6 py-3 text-sm font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
            >
              <Shield className="h-4 w-4" /> Start a club
            </Link>
          </div>
        </div>
        <div className="relative z-10 mx-auto mt-14 max-w-4xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          <div className="cy-marquee text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a877d]">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k} className="inline-flex gap-10">
                {TICKER.map((t) => (
                  <span key={t} className="inline-flex items-center gap-2.5">
                    <span className="h-1 w-1 rounded-full bg-[#1f9d57]" /> {t}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="cy-panel rounded-3xl border border-[#e7e4db] bg-white p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7f4ec] text-[#0f5a30]">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="cy-display mt-4 text-xl font-bold text-[#16150f]">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6f6c63]">{p.body}</p>
              <Link href={p.href} className="mt-4 inline-block text-sm font-bold text-[#1f9d57] hover:underline">
                {p.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e7e4db] bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-[#6f6c63]">
          <div className="flex items-center gap-2">
            <CricketBall size={20} />
            <span className="cy-display font-bold text-[#16150f]">TossUp</span>
            <span className="text-xs">· grassroots cricket</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/discover" className="hover:text-[#16150f]">Discover</Link>
            <Link href="/tournaments" className="hover:text-[#16150f]">Tournaments</Link>
            <Link href="/club/new" className="hover:text-[#16150f]">Start a club</Link>
            <Link href="/auctions" className="flex items-center gap-1.5 hover:text-[#16150f]">
              <Gavel className="h-3.5 w-3.5" /> Player auction
            </Link>
          </nav>
        </div>
      </footer>
    </PlatformShell>
  )
}
