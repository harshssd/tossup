'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { COUNTRIES, TIERS, PLAYING_ROLES } from '@/lib/platform/recognition'

type Tab = 'clubs' | 'players' | 'tournaments'

const selectCls =
  'h-9 rounded-md border border-[#e7e4db] bg-white px-2 text-sm text-[#16150f] focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

export function DiscoverFilters({ tab, basePath = '/discover' }: { tab: Tab; basePath?: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')

  function apply(overrides: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    // The tab param only means something on /discover; single-type pages don't need it.
    if (basePath === '/discover') params.set('tab', tab)
    for (const [k, v] of Object.entries({ q, ...overrides })) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply({})
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${tab}…`}
        className="h-9 w-full max-w-xs"
      />
      <select className={selectCls} defaultValue={sp.get('country') ?? ''} onChange={(e) => apply({ country: e.target.value })}>
        <option value="">All countries</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <Input
        defaultValue={sp.get('region') ?? ''}
        onBlur={(e) => apply({ region: e.target.value })}
        placeholder="State / city"
        className="h-9 w-36"
      />
      {tab !== 'players' && (
        <select className={selectCls} defaultValue={sp.get('tier') ?? ''} onChange={(e) => apply({ tier: e.target.value })}>
          <option value="">Any recognition</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      )}
      {tab === 'tournaments' && (
        <select className={selectCls} defaultValue={sp.get('status') ?? ''} onChange={(e) => apply({ status: e.target.value })}>
          <option value="">Any status</option>
          <option value="OPEN">Open for teams</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="CLOSED">Closed</option>
        </select>
      )}
      {tab === 'players' && (
        <select className={selectCls} defaultValue={sp.get('role') ?? ''} onChange={(e) => apply({ role: e.target.value })}>
          <option value="">Any role</option>
          {PLAYING_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', '-').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      )}
      {tab === 'clubs' && (
        <Button
          type="button"
          variant={sp.get('recruiting') ? 'default' : 'outline'}
          size="sm"
          onClick={() => apply({ recruiting: sp.get('recruiting') ? '' : '1' })}
        >
          Recruiting
        </Button>
      )}
      {tab === 'players' && (
        <Button
          type="button"
          variant={sp.get('looking') ? 'default' : 'outline'}
          size="sm"
          onClick={() => apply({ looking: sp.get('looking') ? '' : '1' })}
        >
          Looking for a club
        </Button>
      )}
      <Button type="submit" size="sm">
        Search
      </Button>
    </form>
  )
}
