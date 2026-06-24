'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Mail, Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'

const field = 'h-10 w-full rounded-lg border border-[#e7e4db] bg-white pl-9 pr-3 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

export function AccountAuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const params = useSearchParams()
  // Only allow same-origin in-app paths; reject protocol-relative (//evil) and
  // backslash forms so a crafted ?redirect can't bounce an authed user off-site.
  const raw = params.get('redirect')
  const redirect = raw && /^\/(?![/\\])/.test(raw) ? raw : '/discover'
  const supabase = createPlatformBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const isSignUp = mode === 'sign-up'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required')
      return
    }
    setBusy(true)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() || undefined },
            emailRedirectTo: `${window.location.origin}/account/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        })
        if (error) throw error
        // If confirmation is required, there's a user but no session yet.
        if (data.user && !data.session) {
          setSent(true)
          return
        }
        toast.success('Account created')
        router.push(redirect)
        router.refresh()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        toast.success('Welcome back')
        router.push(redirect)
        router.refresh()
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/account/callback?redirect=${encodeURIComponent(redirect)}` },
      })
      if (error) throw error
    } catch (err) {
      toast.error((err as Error).message)
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="cy-panel rounded-2xl p-6 text-center">
        <Mail className="mx-auto h-8 w-8 text-[#1f9d57]" />
        <h2 className="cy-display mt-3 text-xl font-semibold text-[#16150f]">Check your email</h2>
        <p className="mt-1 text-sm text-[#6f6c63]">
          We sent a confirmation link to <span className="font-semibold text-[#16150f]">{email}</span>. Click it to finish creating your account.
        </p>
      </div>
    )
  }

  return (
    <div className="cy-panel rounded-2xl p-6">
      <h1 className="cy-display text-2xl font-semibold text-[#16150f]">{isSignUp ? 'Create your account' : 'Sign in'}</h1>
      <p className="mt-1 text-sm text-[#6f6c63]">
        {isSignUp ? 'Hosts and admins need an account. Members can be added without one.' : 'Welcome back to TossUp.'}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {isSignUp && (
          <div className="relative">
            <User className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a978d]" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={field} />
          </div>
        )}
        <div className="relative">
          <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a978d]" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={field} autoComplete="email" />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a978d]" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={field} autoComplete={isSignUp ? 'new-password' : 'current-password'} />
        </div>
        <Button type="submit" disabled={busy} className="h-10 w-full bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
          {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-[#9a978d]">
        <span className="h-px flex-1 bg-[#ece9e1]" /> or <span className="h-px flex-1 bg-[#ece9e1]" />
      </div>
      <Button onClick={google} disabled={busy} variant="outline" className="h-10 w-full border-[#e7e4db] bg-white text-[#16150f] hover:bg-[#f6f5f1]">
        Continue with Google
      </Button>

      <p className="mt-5 text-center text-sm text-[#6f6c63]">
        {isSignUp ? (
          <>Already have an account? <Link href="/account/sign-in" className="font-semibold text-[#0f5a30] hover:underline">Sign in</Link></>
        ) : (
          <>New to TossUp? <Link href="/account/sign-up" className="font-semibold text-[#0f5a30] hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  )
}
