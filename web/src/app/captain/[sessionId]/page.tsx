'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Trophy, Clock, Users, Target, AlertCircle, Check, Send,
  Timer, Crown, Zap, TrendingUp, Minus, Plus, DollarSign,
  Shield, ChevronRight, Gauge, BarChart3, History,
  CircleDot, Swords, Eye, Wallet, PieChart, ArrowUpRight,
  ArrowDownRight, AlertTriangle, Sparkles, Radio, UserCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCaptainSession } from '@/hooks/useCaptainSession'
import type {
  CaptainSessionData, SquadPlayer, TierRequirement,
  BidHistoryEntry, BudgetAnalytics, TeamSelectionOption, SwitchableTeam
} from '@/hooks/useCaptainSession'
import { OpenOutcryBidPanel } from '@/components/auction/OpenOutcryBidPanel'
import type { OutcryConfig } from '@/lib/outcry-utils'

// ── Utility Functions ──────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatCurrency(amount: number, icon: string): string {
  return `${amount.toLocaleString()} ${icon}`
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'BATSMAN': return '🏏'
    case 'BOWLER': return '🎯'
    case 'ALL_ROUNDER': return '⚡'
    case 'WICKETKEEPER': return '🧤'
    default: return '🏏'
  }
}

function getRoleLabel(role: string) {
  return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

// ── Sub-components ─────────────────────────────────────────────

function BudgetGauge({ analytics, currencyIcon }: { analytics: BudgetAnalytics; currencyIcon: string }) {
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (analytics.percentRemaining / 100) * circumference
  const healthColors = {
    healthy: { stroke: '#10b981', bg: 'from-emerald-500/10', text: 'text-emerald-400', label: 'Healthy' },
    caution: { stroke: '#f59e0b', bg: 'from-amber-500/10', text: 'text-amber-400', label: 'Caution' },
    critical: { stroke: '#ef4444', bg: 'from-red-500/10', text: 'text-red-400', label: 'Low' },
  }
  const colors = healthColors[analytics.budgetHealth]

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor"
            className="text-white/5" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r="54" fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-white">
            {analytics.percentRemaining}%
          </span>
          <span className="text-[10px] uppercase tracking-wider text-white/40">remaining</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.stroke }} />
        <span className={cn('text-xs font-medium', colors.text)}>{colors.label}</span>
      </div>
    </div>
  )
}

function BudgetDetailRow({ label, value, subtitle, accent }: {
  label: string; value: string; subtitle?: string; accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-white/50">{label}</span>
      <div className="text-right">
        <span className={cn('text-sm font-semibold tabular-nums', accent ? 'text-emerald-400' : 'text-white')}>
          {value}
        </span>
        {subtitle && <div className="text-[10px] text-white/30">{subtitle}</div>}
      </div>
    </div>
  )
}

function SquadMiniCard({ player, currencyIcon }: { player: SquadPlayer; currencyIcon: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10 ring-2 ring-white/10">
            <AvatarImage src={player.image} />
            <AvatarFallback className="text-xs font-bold bg-white/10 text-white">
              {player.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 text-sm">{getRoleIcon(player.playingRole)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{player.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">{getRoleLabel(player.playingRole)}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
              backgroundColor: player.tier.color + '20',
              color: player.tier.color,
            }}>
              {player.tier.name}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-white">{player.acquiredPrice}</p>
          <p className="text-[10px] text-white/30">{currencyIcon}</p>
        </div>
      </div>
    </motion.div>
  )
}

function TierProgressBar({ tier }: { tier: TierRequirement }) {
  const progress = tier.minPerTeam > 0 ? Math.min(100, (tier.acquiredCount / tier.minPerTeam) * 100) : 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
          <span className="text-xs font-medium text-white/70">{tier.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs tabular-nums text-white/50">
            {tier.acquiredCount}/{tier.minPerTeam}
          </span>
          {tier.fulfilled && <Check className="h-3 w-3 text-emerald-400" />}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: tier.color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/30">
        <span>{tier.availablePlayers} available</span>
        <span>max {tier.maxPerTeam}</span>
      </div>
    </div>
  )
}

function BidHistoryRow({ entry, currencyIcon }: { entry: BidHistoryEntry; currencyIcon: string }) {
  const resultColors = {
    WON: 'text-emerald-400 bg-emerald-400/10',
    LOST: 'text-red-400 bg-red-400/10',
    PENDING: 'text-amber-400 bg-amber-400/10',
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] text-sm">
        {getRoleIcon(entry.playerRole)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{entry.playerName}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
            backgroundColor: entry.tierColor + '20',
            color: entry.tierColor,
          }}>
            {entry.tierName}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums text-white">{entry.bidAmount} {currencyIcon}</p>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', resultColors[entry.result])}>
          {entry.result}
        </Badge>
      </div>
    </div>
  )
}

function CompositionDonut({ composition }: { composition: CaptainSessionData['squadComposition'] }) {
  const segments = [
    { label: 'Batsmen', count: composition.batsmen, color: '#3b82f6', icon: '🏏' },
    { label: 'Bowlers', count: composition.bowlers, color: '#ef4444', icon: '🎯' },
    { label: 'All-Rounders', count: composition.allRounders, color: '#a855f7', icon: '⚡' },
    { label: 'Keepers', count: composition.wicketkeepers, color: '#f59e0b', icon: '🧤' },
  ]

  const total = composition.total || 1
  let cumulativePercent = 0

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {segments.map((seg, i) => {
            const percent = (seg.count / total) * 100
            const dashArray = 2 * Math.PI * 40
            const offset = dashArray - (percent / 100) * dashArray
            const rotation = (cumulativePercent / 100) * 360
            cumulativePercent += percent

            return seg.count > 0 ? (
              <circle
                key={i}
                cx="50" cy="50" r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={dashArray}
                strokeDashoffset={offset}
                transform={`rotate(${rotation} 50 50)`}
                className="transition-all duration-700"
              />
            ) : null
          })}
          {composition.total === 0 && (
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
              className="text-white/5" strokeWidth="10" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{composition.total}</span>
          <span className="text-[9px] text-white/40">/{composition.targetSize}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm">{seg.icon}</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-white/60">{seg.label}</span>
              <div className="flex-1 h-1 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(seg.count / Math.max(1, composition.targetSize)) * 100}%`, backgroundColor: seg.color }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold tabular-nums text-white/80">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Loading State ──────────────────────────────────────────────

function CaptainDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <div className="h-16 bg-black/40 border-b border-white/[0.06]" />
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-64 bg-white/[0.04]" />
            <Skeleton className="h-48 bg-white/[0.04]" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-80 bg-white/[0.04]" />
            <Skeleton className="h-48 bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

// ── Team Selection Screen ──────────────────────────────────────

function TeamSelectionScreen({
  teams,
  auctionId,
}: {
  teams: TeamSelectionOption[]
  auctionId: string
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Select a Team</h1>
          <p className="text-sm text-white/40">Choose which team's captain dashboard to view</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teams.map((team) => (
            <motion.button
              key={team.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/captain/${auctionId}_${team.id}`)}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] p-5 text-left transition-all"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
                  style={{
                    background: team.primaryColor
                      ? `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor})`
                      : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  }}
                >
                  {team.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                    {team.captainName && (
                      <span className="flex items-center gap-1">
                        <Crown className="h-2.5 w-2.5 text-amber-400" />
                        {team.captainName}
                      </span>
                    )}
                    <span>{team.playerCount} players</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 ml-auto shrink-0 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export default function CaptainDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const {
    session,
    loading,
    error,
    timeLeft,
    submitBid,
    isSubmitting,
    refresh,
    needsTeamSelection,
    teamOptions,
    auctionIdForSelection,
  } = useCaptainSession(sessionId)

  const [bidAmount, setBidAmount] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // Set initial bid amount when round changes
  useEffect(() => {
    if (session?.currentRound && !session.currentRound.myBid) {
      setBidAmount(session.currentRound.tier.basePrice.toString())
    }
  }, [session?.currentRound?.id])

  // Quick bid adjust
  const adjustBid = (increment: number) => {
    if (!session?.currentRound) return
    const current = parseInt(bidAmount) || session.currentRound.tier.basePrice
    const newAmount = Math.max(current + increment, session.currentRound.tier.basePrice)
    setBidAmount(Math.min(newAmount, session.budgetAnalytics.maxAllowableBid).toString())
  }

  // Submit bid handler
  const handleSubmitBid = async () => {
    if (!session?.currentRound || !bidAmount) return
    const amount = parseInt(bidAmount)

    if (isNaN(amount) || amount < session.currentRound.tier.basePrice) {
      toast.error(`Minimum bid is ${session.currentRound.tier.basePrice} ${session.auction.currencyIcon}`)
      return
    }
    if (amount > session.budgetAnalytics.maxAllowableBid) {
      toast.error(`Maximum allowable bid is ${session.budgetAnalytics.maxAllowableBid} ${session.auction.currencyIcon}`)
      return
    }

    try {
      await submitBid(amount)
      toast.success(`Bid of ${amount} ${session.auction.currencyIcon} submitted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit bid')
    }
  }

  // ── Error state ──────────────────────────────────────────────
  if (error && !session) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Session Error</h1>
          <p className="text-white/50 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={refresh} variant="outline" className="border-white/10 text-white hover:bg-white/5">
              Try Again
            </Button>
            <Button onClick={() => router.push('/home')} className="bg-white/10 text-white hover:bg-white/15">
              Back to TossUp
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (loading || !session) return <CaptainDashboardSkeleton />

  const { auction, team, currentRound, budgetAnalytics, squadComposition } = session
  const isLive = auction.status === 'LIVE'
  const isCompleted = auction.status === 'COMPLETED'
  const roundIsOpen = currentRound?.status === 'OPEN'
  const timerUrgent = timeLeft > 0 && timeLeft <= 15

  return (
    <div className="min-h-screen bg-[#0a0e17] selection:bg-blue-500/30">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/[0.02] blur-[100px]" />
      </div>

      {/* Admin viewing banner */}
      {session.isAdminViewing && (
        <div className="sticky top-0 z-[60] bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5">
          <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-2 text-xs text-amber-400">
            <Eye className="h-3 w-3" />
            <span>
              Viewing as <strong>{session.accessRole === 'AUCTION_OWNER' ? 'Auction Owner' : 'Auction Admin'}</strong> — {team.name}'s captain dashboard
            </span>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <header className={cn(
        'sticky z-50 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]',
        session.isAdminViewing ? 'top-[33px]' : 'top-0'
      )}>
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Auction name + status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white leading-none">{auction.name}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isLive && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
                      </span>
                      LIVE
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-medium text-emerald-400">COMPLETED</span>
                  )}
                  {!isLive && !isCompleted && (
                    <span className="text-[10px] font-medium text-amber-400">{auction.status}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Timer (when live) */}
          {roundIsOpen && timeLeft > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full border',
                timerUrgent
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-white'
              )}
            >
              <Timer className={cn('h-3.5 w-3.5', timerUrgent && 'animate-pulse')} />
              <span className="text-sm font-mono font-bold tabular-nums">{formatTime(timeLeft)}</span>
            </motion.div>
          )}

          {/* Right: Team badge + budget + switcher */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/40">Budget</p>
              <p className="text-sm font-bold tabular-nums text-white">
                {budgetAnalytics.remaining.toLocaleString()} {auction.currencyIcon}
              </p>
            </div>

            {/* Team switcher for admins */}
            {session.switchableTeams && session.switchableTeams.length > 1 ? (
              <div className="relative group">
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: team.primaryColor
                        ? `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor})`
                        : 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                    }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <span className="text-xs text-white/60 hidden sm:inline">{team.name}</span>
                  <ChevronRight className="h-3 w-3 text-white/30 rotate-90" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-white/[0.08] bg-[#151a27] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/30 font-medium">
                    Switch Team
                  </div>
                  {session.switchableTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/captain/${auction.id}_${t.id}`)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                        t.id === team.id ? 'text-white bg-white/[0.04]' : 'text-white/60'
                      )}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: t.primaryColor || '#3b82f6' }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <span className="truncate">{t.name}</span>
                      {t.id === team.id && <Check className="h-3 w-3 ml-auto text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                style={{
                  background: team.primaryColor
                    ? `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor})`
                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                }}
              >
                {team.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="relative max-w-[1400px] mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Left Column (8 cols) ────────────────────────────── */}
          <div className="lg:col-span-8 space-y-5">

            {/* Active Bidding Panel (only when round is open) */}
            <AnimatePresence mode="wait">
              {currentRound && isLive ? (
                <motion.div
                  key="bidding-panel"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01]"
                >
                  {/* Tier color accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: currentRound.tier.color }} />

                  <div className="p-5">
                    {/* Status row */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-400" />
                        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                          Now Bidding
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentRound.totalBids > 0 && (
                          <span className="text-[10px] text-white/40 tabular-nums">
                            {currentRound.totalBids} bid{currentRound.totalBids !== 1 ? 's' : ''} placed
                          </span>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px]',
                            roundIsOpen ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/5 text-white/40'
                          )}
                        >
                          {currentRound.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                      {/* Player info (3 cols) */}
                      <div className="md:col-span-3">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-16 w-16 ring-2 ring-white/10 shrink-0">
                            <AvatarImage src={currentRound.player?.image} />
                            <AvatarFallback className="text-lg font-bold bg-blue-600/30 text-blue-300">
                              {currentRound.player?.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h2 className="text-xl font-bold text-white mb-1.5 truncate">
                              {currentRound.player?.name || 'Unknown Player'}
                            </h2>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {getRoleIcon(currentRound.player?.playingRole || 'BATSMAN')}{' '}
                                {getRoleLabel(currentRound.player?.playingRole || 'BATSMAN')}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-md border" style={{
                                backgroundColor: currentRound.tier.color + '15',
                                borderColor: currentRound.tier.color + '30',
                                color: currentRound.tier.color,
                              }}>
                                {currentRound.tier.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Base: {currentRound.tier.basePrice} {auction.currencyIcon}
                              </span>
                              {currentRound.highestBid && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <TrendingUp className="h-3 w-3" />
                                  High: {currentRound.highestBid} {auction.currencyIcon}
                                </span>
                              )}
                            </div>

                            {/* Current bid status */}
                            {currentRound.myBid && (
                              <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 w-fit">
                                <Check className="h-3.5 w-3.5 text-blue-400" />
                                <span className="text-xs font-medium text-blue-300">
                                  Your bid: {currentRound.myBid.amount} {auction.currencyIcon}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className={cn('text-[10px] px-1.5',
                                    currentRound.myBid.status === 'WINNING' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/5 text-white/50'
                                  )}
                                >
                                  {currentRound.myBid.status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bid input (2 cols) */}
                      <div className="md:col-span-2">
                        {(auction as any).biddingType === 'OPEN_OUTCRY' && (auction as any).outcryConfig ? (
                          <OpenOutcryBidPanel
                            auctionId={auction.id}
                            teamId={team.id}
                            teamName={team.name}
                            roundId={currentRound.id}
                            basePrice={(currentRound as any).basePrice ?? currentRound.tier.basePrice}
                            currentBidAmount={(currentRound as any).currentBidAmount ?? currentRound.tier.basePrice}
                            currentBidTeamId={(currentRound as any).currentBidTeamId ?? null}
                            bidCount={(currentRound as any).bidCount ?? 0}
                            outcryConfig={(auction as any).outcryConfig as OutcryConfig}
                            budgetRemaining={budgetAnalytics.remaining}
                            currencyIcon={auction.currencyIcon}
                            currencyName={auction.currencyName}
                          />
                        ) : (
                        <div className="space-y-3">
                          {/* Max bid indicator */}
                          <div className="flex items-center justify-between text-[10px] text-white/30">
                            <span>Max bid</span>
                            <span className="tabular-nums font-medium">{budgetAnalytics.maxAllowableBid.toLocaleString()} {auction.currencyIcon}</span>
                          </div>

                          {/* Bid amount input */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => adjustBid(-10)}
                              disabled={!roundIsOpen || isSubmitting}
                              className="h-10 w-10 p-0 text-white/40 hover:text-white hover:bg-white/5"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              min={currentRound.tier.basePrice}
                              max={budgetAnalytics.maxAllowableBid}
                              disabled={!roundIsOpen || isSubmitting}
                              className="text-center text-lg font-bold bg-white/[0.04] border-white/[0.08] text-white h-10 tabular-nums"
                            />
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => adjustBid(10)}
                              disabled={!roundIsOpen || isSubmitting}
                              className="h-10 w-10 p-0 text-white/40 hover:text-white hover:bg-white/5"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Quick amounts */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: 'Base', value: currentRound.tier.basePrice },
                              { label: '+50', value: currentRound.tier.basePrice + 50 },
                              { label: 'Max', value: budgetAnalytics.maxAllowableBid },
                            ].map((opt) => (
                              <Button
                                key={opt.label}
                                variant="ghost" size="sm"
                                onClick={() => setBidAmount(Math.min(opt.value, budgetAnalytics.maxAllowableBid).toString())}
                                disabled={!roundIsOpen || isSubmitting}
                                className="h-7 text-[10px] font-medium text-white/40 hover:text-white hover:bg-white/5 border border-white/[0.06]"
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>

                          {/* Submit button */}
                          <Button
                            onClick={handleSubmitBid}
                            disabled={
                              !roundIsOpen || isSubmitting || !bidAmount ||
                              parseInt(bidAmount) < currentRound.tier.basePrice ||
                              parseInt(bidAmount) > budgetAnalytics.maxAllowableBid ||
                              timeLeft === 0
                            }
                            className={cn(
                              'w-full h-11 font-semibold transition-all',
                              currentRound.myBid
                                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            )}
                          >
                            {isSubmitting ? (
                              <span className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                              </span>
                            ) : currentRound.myBid ? (
                              <span className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Update Bid
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Place Bid
                              </span>
                            )}
                          </Button>
                        </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : isLive ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <Radio className="h-6 w-6 text-blue-400 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">Waiting for Next Round</h3>
                  <p className="text-sm text-white/40">The auctioneer is preparing the next player</p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ── Tabbed Content Area ─────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList variant="line" className="border-b border-white/[0.06] bg-transparent w-full justify-start">
                <TabsTrigger value="overview" className="text-xs gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="squad" className="text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  My Squad
                  <span className="text-[10px] tabular-nums text-white/30 ml-0.5">
                    {squadComposition.total}/{squadComposition.targetSize}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Bid History
                  {session.bidHistory.length > 0 && (
                    <span className="text-[10px] tabular-nums text-white/30 ml-0.5">
                      {session.bidHistory.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Overview Tab ──────────────────────────────────── */}
              <TabsContent value="overview" className="mt-5 space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Squad',
                      value: `${squadComposition.total}/${squadComposition.targetSize}`,
                      icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10',
                    },
                    {
                      label: 'Spent',
                      value: `${budgetAnalytics.spent.toLocaleString()}`,
                      icon: Wallet, color: 'text-purple-400', bg: 'bg-purple-400/10',
                    },
                    {
                      label: 'Avg/Player',
                      value: budgetAnalytics.avgSpendPerPlayer > 0 ? budgetAnalytics.avgSpendPerPlayer.toLocaleString() : '—',
                      icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/10',
                    },
                    {
                      label: 'Bids Won',
                      value: `${session.bidHistory.filter(b => b.result === 'WON').length}`,
                      icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/10',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', stat.bg)}>
                          <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
                        </div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Composition + Tier Progress */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Squad Composition */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                      Squad Composition
                    </h3>
                    <CompositionDonut composition={squadComposition} />
                  </div>

                  {/* Tier Requirements */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                      Tier Requirements
                    </h3>
                    <div className="space-y-4">
                      {session.tierRequirements.map((tier) => (
                        <TierProgressBar key={tier.id} tier={tier} />
                      ))}
                      {session.tierRequirements.length === 0 && (
                        <p className="text-sm text-white/30 text-center py-4">No tiers configured</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auction Progress */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                    Auction Progress
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>{session.auctionProgress.soldPlayers} sold</span>
                      <span>{session.auctionProgress.availablePlayers} remaining</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${session.auctionProgress.totalPlayers > 0
                            ? (session.auctionProgress.soldPlayers / session.auctionProgress.totalPlayers) * 100
                            : 0}%`
                        }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold tabular-nums text-emerald-400">{session.auctionProgress.soldPlayers}</p>
                        <p className="text-[10px] text-white/30">Sold</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-amber-400">{session.auctionProgress.availablePlayers}</p>
                        <p className="text-[10px] text-white/30">Available</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-red-400">{session.auctionProgress.unsoldPlayers}</p>
                        <p className="text-[10px] text-white/30">Unsold</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other Teams */}
                {session.otherTeams.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                      Other Teams
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {session.otherTeams.map((t) => (
                        <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02]">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: t.primaryColor || '#3b82f6',
                            }}
                          >
                            {t.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white/70 truncate">{t.name}</p>
                            <p className="text-[10px] text-white/30">{t.playerCount} players</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Squad Tab ────────────────────────────────────── */}
              <TabsContent value="squad" className="mt-5">
                {session.squad.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                      <Users className="h-7 w-7 text-white/20" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">No Players Yet</h3>
                    <p className="text-sm text-white/40">
                      {isLive
                        ? 'Start bidding to build your squad'
                        : isCompleted
                          ? 'No players were acquired in this auction'
                          : 'The auction hasn\'t started yet'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Spending summary */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">Total spent on {session.squad.length} player{session.squad.length !== 1 ? 's' : ''}</span>
                        <span className="text-sm font-bold text-white tabular-nums">
                          {budgetAnalytics.spent.toLocaleString()} {auction.currencyIcon}
                        </span>
                      </div>
                    </div>

                    {/* Player cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {session.squad.map((player) => (
                        <SquadMiniCard
                          key={player.id}
                          player={player}
                          currencyIcon={auction.currencyIcon}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Bid History Tab ───────────────────────────────── */}
              <TabsContent value="history" className="mt-5">
                {session.bidHistory.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                      <History className="h-7 w-7 text-white/20" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">No Bids Yet</h3>
                    <p className="text-sm text-white/40">Your bid history will appear here</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    {/* Summary badges */}
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-400 text-[10px]">
                        {session.bidHistory.filter(b => b.result === 'WON').length} Won
                      </Badge>
                      <Badge variant="secondary" className="bg-red-400/10 text-red-400 text-[10px]">
                        {session.bidHistory.filter(b => b.result === 'LOST').length} Lost
                      </Badge>
                      <Badge variant="secondary" className="bg-amber-400/10 text-amber-400 text-[10px]">
                        {session.bidHistory.filter(b => b.result === 'PENDING').length} Pending
                      </Badge>
                    </div>
                    <div className="space-y-0">
                      {session.bidHistory.map((entry, i) => (
                        <BidHistoryRow key={i} entry={entry} currencyIcon={auction.currencyIcon} />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Right Column (4 cols) ───────────────────────────── */}
          <div className="lg:col-span-4 space-y-5">

            {/* Budget Intelligence Panel */}
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-md bg-emerald-400/10 flex items-center justify-center">
                  <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Budget</h3>
              </div>

              <BudgetGauge analytics={budgetAnalytics} currencyIcon={auction.currencyIcon} />

              <div className="mt-5 space-y-0 divide-y divide-white/[0.04]">
                <BudgetDetailRow
                  label="Total Budget"
                  value={`${budgetAnalytics.totalBudget.toLocaleString()} ${auction.currencyIcon}`}
                />
                <BudgetDetailRow
                  label="Spent"
                  value={`${budgetAnalytics.spent.toLocaleString()} ${auction.currencyIcon}`}
                  subtitle={`${budgetAnalytics.percentSpent}% of total`}
                />
                <BudgetDetailRow
                  label="Remaining"
                  value={`${budgetAnalytics.remaining.toLocaleString()} ${auction.currencyIcon}`}
                  accent
                />
                <BudgetDetailRow
                  label="Slots Left"
                  value={`${budgetAnalytics.slotsRemaining}`}
                  subtitle={`of ${squadComposition.targetSize} total`}
                />
                <BudgetDetailRow
                  label="Reserved (min fills)"
                  value={`${budgetAnalytics.mandatoryReserve.toLocaleString()} ${auction.currencyIcon}`}
                  subtitle={`${budgetAnalytics.slotsRemaining - 1} slots × min base`}
                />
                <BudgetDetailRow
                  label="Max Single Bid"
                  value={`${budgetAnalytics.maxAllowableBid.toLocaleString()} ${auction.currencyIcon}`}
                  accent
                />
                <BudgetDetailRow
                  label="Avg. per Remaining Slot"
                  value={budgetAnalytics.slotsRemaining > 0
                    ? `${budgetAnalytics.avgRemainingPerSlot.toLocaleString()} ${auction.currencyIcon}`
                    : '—'
                  }
                />
              </div>

              {/* Budget health alert */}
              {budgetAnalytics.budgetHealth !== 'healthy' && budgetAnalytics.slotsRemaining > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    'mt-4 px-3 py-2.5 rounded-lg border text-xs',
                    budgetAnalytics.budgetHealth === 'critical'
                      ? 'bg-red-500/5 border-red-500/20 text-red-400'
                      : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      {budgetAnalytics.budgetHealth === 'critical'
                        ? 'Budget is critically low. You may only be able to bid base prices for remaining slots.'
                        : 'Budget is running low. Consider bidding conservatively on remaining rounds.'
                      }
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Team Identity Card */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div
                className="h-16 flex items-center px-5"
                style={{
                  background: team.primaryColor
                    ? `linear-gradient(135deg, ${team.primaryColor}40, ${team.secondaryColor || team.primaryColor}20)`
                    : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white shadow-lg"
                    style={{
                      background: team.primaryColor
                        ? `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor || team.primaryColor})`
                        : 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                    }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{team.name}</h3>
                    {team.captain && (
                      <div className="flex items-center gap-1 text-[10px] text-white/40">
                        <Crown className="h-2.5 w-2.5 text-amber-400" />
                        {team.captain.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
                    <p className="text-lg font-bold tabular-nums text-white">{team.playerCount}</p>
                    <p className="text-[10px] text-white/30">Players</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-white/[0.02]">
                    <p className="text-lg font-bold tabular-nums text-white">{budgetAnalytics.slotsRemaining}</p>
                    <p className="text-[10px] text-white/30">Slots Left</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Access Info */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Access</span>
              </div>
              <div className="space-y-2 text-xs text-white/50">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3 w-3 text-emerald-400" />
                  <span>
                    {session.accessRole === 'CAPTAIN' && 'Team Captain access'}
                    {session.accessRole === 'VICE_CAPTAIN' && 'Vice Captain access'}
                    {session.accessRole === 'AUCTION_ADMIN' && 'Auction Admin (read + bid)'}
                    {session.accessRole === 'AUCTION_OWNER' && 'Auction Owner (full access)'}
                  </span>
                </div>
                {session.isAdminViewing && (
                  <div className="flex items-center gap-2 text-amber-400/70">
                    <Crown className="h-3 w-3" />
                    <span>Admin viewing captain's dashboard</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3 text-white/30" />
                  <span>Only this team's data is visible</span>
                </div>
                <div className="flex items-center gap-2">
                  <Swords className="h-3 w-3 text-white/30" />
                  <span>Other teams' bids are sealed</span>
                </div>
              </div>
            </div>

            {/* Completed state summary */}
            {isCompleted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center"
              >
                <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Auction Complete</h3>
                <p className="text-xs text-white/40 mb-3">
                  You acquired {squadComposition.total} players for {budgetAnalytics.spent.toLocaleString()} {auction.currencyIcon}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('squad')}
                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/5 text-xs"
                >
                  View Final Squad
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
