'use client'

import { useEffect, useState } from 'react'
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Compass } from "lucide-react";
import { CricketBall } from "@/components/platform/CricketBall";
import { createBrowserClient } from '@supabase/ssr'
import { motion } from 'framer-motion'
import { PageTransition } from '@/components/PageTransition'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = typeof window !== 'undefined' &&
                   process.env.NEXT_PUBLIC_SUPABASE_URL &&
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                   !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') ?
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ) : null

  useEffect(() => {
    const getUser = async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.warn('Auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null)
        setLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-card flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="clubhouse cy-ground flex min-h-screen flex-col">
        {/* Navigation Header */}
        <header className="relative z-10 border-b border-[#e7e4db] bg-white/80 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
            <div className="cy-spin-hover flex items-center gap-2.5">
              <CricketBall size={32} />
              <span className="cy-display text-2xl font-extrabold text-[#16150f]">TossUp</span>
              <span className="hidden rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f5a30] sm:inline">
                Cricket
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/discover">
                  <Compass className="h-4 w-4 mr-2" />
                  Discover
                </Link>
              </Button>
              {user ? (
                <>
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    Welcome back, {user.user_metadata?.name || user.email?.split('@')[0]}!
                  </span>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/auth/signin">
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
                    <Link href="/auth/signup">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Sign Up
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="relative flex-1 flex items-center justify-center px-6 py-16 lg:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background:radial-gradient(closest-side_at_50%_38%,#eaf6ee,transparent_70%)]"
          />
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mb-8"
            >
              <CricketBall size={76} className="drop-shadow-[0_0_26px_rgba(193,18,31,0.55)]" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="cy-display text-5xl font-semibold tracking-tight sm:text-7xl"
            >
              <span className="text-[#16150f]">Toss</span>
              <span className="cy-grad-text">Up</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg leading-8 text-[#6f6c63]"
            >
              The home of grassroots cricket — discover clubs, find players, and follow
              tournaments, from your local turf to the recognized leagues.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 flex items-center justify-center gap-x-6"
            >
              {user ? (
                <>
                  <Button asChild size="lg" className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/auction/create">Create Auction</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
                    <Link href="/auth/signup">Get Started Free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/discover">Discover clubs &amp; tournaments</Link>
                  </Button>
                </>
              )}
            </motion.div>
          </div>
        </section>

      </div>
    </PageTransition>
  );
}
