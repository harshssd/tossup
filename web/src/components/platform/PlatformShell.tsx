import Link from 'next/link'
import { Compass, Plus, Shield } from 'lucide-react'
import { CricketBall } from './CricketBall'
import { PlatformAuthNav } from './PlatformAuthNav'

const NAV_LINKS = [
  { href: '/discover?tab=clubs', label: 'Clubs' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/discover?tab=players', label: 'Players' },
]

// Clubhouse light theme chrome for every platform page. The `clubhouse` class
// scopes a light token set so this subtree renders light while legacy pages
// stay on the dark theme.
export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="clubhouse cy-ground min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[#e7e4db] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/discover" className="cy-spin-hover group flex items-center gap-2.5">
            <CricketBall size={30} />
            <span className="cy-display text-[1.35rem] font-extrabold leading-none tracking-tight text-[#16150f]">
              TossUp
            </span>
            <span className="hidden rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f5a30] sm:inline">
              Cricket
            </span>
          </Link>
          <nav className="flex items-center gap-1.5">
            {/* On small screens the three type links collapse into one Discover entry. */}
            <Link
              href="/discover"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[#6f6c63] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f] md:hidden"
            >
              <Compass className="h-4 w-4" /> Discover
            </Link>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#6f6c63] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f] md:flex"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/club/new"
              className="hidden items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-4 py-2 text-sm font-bold text-[#16150f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30] sm:flex"
            >
              <Shield className="h-4 w-4" /> Start a club
            </Link>
            <Link
              href="/tournaments/new"
              className="flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-4 py-2 text-sm font-bold text-white shadow-[0_8px_22px_-10px_rgba(31,157,87,0.8)] transition-colors hover:bg-[#0f5a30]"
            >
              <Plus className="h-4 w-4" /> Host
            </Link>
            <PlatformAuthNav />
          </nav>
        </div>
      </header>
      <main className="relative z-[1]">{children}</main>
    </div>
  )
}
