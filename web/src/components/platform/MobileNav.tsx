'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X, Compass, Shield, Plus, Newspaper, Trophy, Users, Tag } from 'lucide-react'

const LINKS = [
  { href: '/home', label: 'Feed', icon: Newspaper },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/discover?tab=clubs', label: 'Clubs', icon: Shield },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/discover?tab=players', label: 'Players', icon: Users },
  { href: '/pricing', label: 'Pricing', icon: Tag },
]

/** Small-screen menu (audit U10: the nav previously degraded by deletion — on
 *  phones, Tournaments and "Start a club" simply vanished). Renders the full
 *  link set + create actions in a dropdown panel. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on outside pointerdown + Escape. A fixed-position backdrop can't work
  // here: the sticky header's backdrop-blur creates a containing block, so
  // `fixed inset-0` would resolve against the header strip, not the viewport
  // (review PR-4). Document-level listeners are immune to that trap.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#6f6c63] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <>
          <nav
            aria-label="Menu"
            className="absolute right-0 top-11 z-50 max-h-[calc(100dvh-4rem)] w-56 overflow-y-auto rounded-2xl border border-[#e7e4db] bg-white shadow-[0_16px_50px_-20px_rgba(20,21,15,0.4)]"
          >
            <ul className="py-1.5">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#3a382f] hover:bg-[#f6f5f1] hover:text-[#16150f]"
                  >
                    <l.icon className="h-4 w-4 text-[#9a978d]" aria-hidden /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#eceae3] p-3">
              <Link
                href="/club/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 rounded-full border border-[#d8d4c8] bg-white px-4 py-2 text-sm font-bold text-[#16150f] hover:border-[#1f9d57] hover:text-[#0f5a30]"
              >
                <Shield className="h-4 w-4" /> Start a club
              </Link>
              <Link
                href="/tournaments/new"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f5a30]"
              >
                <Plus className="h-4 w-4" /> Host a tournament
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  )
}
