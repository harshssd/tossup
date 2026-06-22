'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@supabase/ssr'
import {
  Plus,
  Trophy,
  Users,
  Calendar,
  Settings,
  LogOut,
  Bell,
  Compass,
  Activity,
  Crown,
  Shield,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PageTransition } from '@/components/PageTransition'

interface DashboardData {
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
  stats: {
    ownedAuctions: number
    participatedAuctions: number
    ownedLeagues: number
    ownedClubs: number
    totalMemberships: number
    pendingInvites: number
  }
  recentActivity: Array<{
    id: string
    type: string
    message: string
    timestamp: Date
  }>
}

interface ClubSummary {
  id: string
  name: string
  memberCount: number
  leagueCount: number
  isOwner: boolean
}

interface LeagueSummary {
  id: string
  name: string
  type: string
  memberCount: number
  auctionCount: number
  isOwner: boolean
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [clubs, setClubs] = useState<ClubSummary[]>([])
  const [leagues, setLeagues] = useState<LeagueSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false)
  const router = useRouter()
  const supabase = typeof window !== 'undefined' &&
                   process.env.NEXT_PUBLIC_SUPABASE_URL &&
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                   !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') ?
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ) : null

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      if (!supabase) {
        router.push('/auth/signin')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/signin')
        return
      }

      const { data: ownedClubsData } = await supabase
        .from('clubs')
        .select('*, club_memberships(count), leagues!leagues_club_id_fkey(count)')
        .eq('owner_id', user.id)

      const { data: ownedLeaguesData } = await supabase
        .from('leagues')
        .select('*, league_memberships(count), auctions(count)')
        .eq('owner_id', user.id)

      let ownedAuctions: any[] = []
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        const auctionResponse = await fetch('/api/auctions', { signal: controller.signal })
        clearTimeout(timeoutId)
        if (auctionResponse.ok) {
          const auctionData = await auctionResponse.json()
          ownedAuctions = auctionData.auctions || []
          setHasConnectionIssue(false)
        } else {
          ownedAuctions = []
          setHasConnectionIssue(true)
        }
      } catch (error: any) {
        ownedAuctions = []
        setHasConnectionIssue(true)
      }

      const { data: clubMemberships } = await supabase
        .from('club_memberships')
        .select('id')
        .eq('user_id', user.id)

      const { data: leagueMemberships } = await supabase
        .from('league_memberships')
        .select('id')
        .eq('user_id', user.id)

      const { data: auctionParticipations } = await supabase
        .from('auction_participations')
        .select('id')
        .eq('user_id', user.id)

      const realData: DashboardData = {
        user: {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          image: user.user_metadata?.avatar_url
        },
        stats: {
          ownedAuctions: ownedAuctions?.length || 0,
          participatedAuctions: auctionParticipations?.length || 0,
          ownedLeagues: ownedLeaguesData?.length || 0,
          ownedClubs: ownedClubsData?.length || 0,
          totalMemberships: (clubMemberships?.length || 0) + (leagueMemberships?.length || 0),
          pendingInvites: 0
        },
        recentActivity: []
      }

      const clubsData: ClubSummary[] = (ownedClubsData || []).map((club: any) => ({
        id: club.id,
        name: club.name,
        memberCount: club.club_memberships?.[0]?.count || 0,
        leagueCount: club.leagues?.[0]?.count || 0,
        isOwner: true
      }))

      const leaguesData: LeagueSummary[] = (ownedLeaguesData || []).map((league: any) => ({
        id: league.id,
        name: league.name,
        type: league.type,
        memberCount: league.league_memberships?.[0]?.count || 0,
        auctionCount: league.auctions?.[0]?.count || 0,
        isOwner: true
      }))

      setClubs(clubsData)
      setLeagues(leaguesData)
      setDashboardData(realData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
      router.push('/')
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-muted-foreground">Failed to load dashboard</h1>
          <Button onClick={loadDashboardData} className="mt-4">Try again</Button>
        </div>
      </div>
    )
  }

  const { user, stats } = dashboardData
  const hasNoContent = clubs.length === 0 && leagues.length === 0 && stats.ownedAuctions === 0 && stats.participatedAuctions === 0

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Gradient Accent Bar */}
        <div className="h-1 gradient-accent-bar" />

        {/* Header */}
        <header className="bg-card/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-foreground">TossUp</h1>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/discover">
                    <Compass className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Discover</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex">
                  <Bell className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="flex-shrink-0">
                  <LogOut className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Connection Issue Banner */}
        {hasConnectionIssue && (
          <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-amber-400 shrink-0" />
                <p className="ml-3 text-sm text-amber-300">
                  <span className="font-medium">Connection Issue:</span> Unable to load some auction data. Please refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Welcome back, {user.name}!</span>
            </h1>
            <p className="text-muted-foreground">
              Manage your clubs, organize tournaments, run auctions, and track your cricket activities.
            </p>
          </div>

          {/* Guided onboarding for empty state */}
          {hasNoContent && (
            <Card className="mb-8 border-dashed border-2">
              <CardContent className="py-8">
                <div className="text-center max-w-lg mx-auto">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h2 className="text-xl font-bold mb-2">Welcome to TossUp</h2>
                  <p className="text-muted-foreground mb-6">Get started in two steps:</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild variant="outline">
                      <Link href="/clubs/create">1. Create Club</Link>
                    </Button>
                    <Button asChild className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500">
                      <Link href="/leagues/create">2. Start League</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[
              { href: '/clubs/create', color: 'border-purple-500', shadowColor: 'hover:shadow-purple-500/10', icon: Users, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10', title: 'Create Club', desc: 'Manage members, facilities, and organize club activities' },
              { href: '/leagues/create', color: 'border-emerald-500', shadowColor: 'hover:shadow-emerald-500/10', icon: Trophy, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10', title: 'Create League', desc: 'Organize a tournament or seasonal league' },
            ].map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.href} href={action.href}>
                  <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                    <Card className={`h-full border-t-2 ${action.color} hover:shadow-lg ${action.shadowColor} transition-all cursor-pointer`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`p-2 ${action.iconBg} rounded-lg`}>
                            <Icon className={`h-5 w-5 ${action.iconColor}`} />
                          </div>
                          <CardTitle className="text-lg">{action.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{action.desc}</CardDescription>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Stats Overview — simplified */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Your Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Primary numbers */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Clubs', value: stats.ownedClubs, color: 'text-purple-400', bgFrom: 'from-purple-500/15', bgTo: 'to-purple-600/5', border: 'border-purple-500/20', href: '/clubs' },
                      { label: 'Leagues', value: stats.ownedLeagues, color: 'text-emerald-400', bgFrom: 'from-emerald-500/15', bgTo: 'to-emerald-600/5', border: 'border-emerald-500/20', href: '/leagues' },
                      { label: 'Auctions', value: stats.ownedAuctions + stats.participatedAuctions, color: 'text-blue-400', bgFrom: 'from-blue-500/15', bgTo: 'to-blue-600/5', border: 'border-blue-500/20', href: '/auctions' },
                      { label: 'Memberships', value: stats.totalMemberships, color: 'text-cyan-400', bgFrom: 'from-cyan-500/15', bgTo: 'to-cyan-600/5', border: 'border-cyan-500/20', href: undefined },
                    ].map((item) => {
                      const content = (
                        <div key={item.label} className={`text-center p-5 bg-gradient-to-br ${item.bgFrom} ${item.bgTo} border ${item.border} rounded-xl ${item.href ? 'hover:brightness-110 transition-all cursor-pointer' : ''}`}>
                          <div className={`text-3xl font-bold tabular-nums ${item.color}`}>{item.value}</div>
                          <div className="text-sm text-muted-foreground">{item.label}</div>
                        </div>
                      )
                      return item.href ? <Link key={item.label} href={item.href}>{content}</Link> : <div key={item.label}>{content}</div>
                    })
                  }
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              {dashboardData.recentActivity.length > 0 ? (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                              <Calendar className="h-4 w-4 text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{activity.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-6">
                  <CardContent className="text-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No recent activity</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by creating your first club, league, or auction to begin managing your cricket activities
                    </p>
                    <Link href="/clubs/create">
                      <Button className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500">Create Your First Club</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Profile & Organizations */}
            <div className="space-y-6">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.image} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>Profile</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Name</div>
                      <div className="text-sm text-foreground">{user.name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Email</div>
                      <div className="text-sm text-foreground">{user.email}</div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile (Coming Soon)
                  </Button>
                </CardContent>
              </Card>

              {/* My Clubs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-purple-400" />
                      <span>My Clubs ({clubs.length})</span>
                    </CardTitle>
                    <Link href="/clubs/create">
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {clubs.length > 0 ? (
                    <div className="space-y-3">
                      {clubs.slice(0, 3).map((club) => (
                        <div key={club.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-primary text-primary-foreground"
                            >
                              {club.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{club.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {club.memberCount} members • {club.leagueCount} leagues
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/clubs/${club.id}/dashboard`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                      {clubs.length > 3 && (
                        <div className="pt-2 border-t">
                          <Link href="/clubs">
                            <Button variant="ghost" className="w-full text-sm">
                              View all {clubs.length} clubs
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    !hasNoContent && (
                      <div className="text-center py-6">
                        <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">No clubs yet</p>
                        <Link href="/clubs/create">
                          <Button size="sm">Create Your First Club</Button>
                        </Link>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

              {/* My Leagues */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Trophy className="h-5 w-5 text-emerald-400" />
                      <span>My Leagues ({leagues.length})</span>
                    </CardTitle>
                    <Link href="/leagues/create">
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {leagues.length > 0 ? (
                    <div className="space-y-3">
                      {leagues.slice(0, 3).map((league) => (
                        <div key={league.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-primary text-primary-foreground"
                            >
                              {league.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{league.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {league.memberCount} members • {league.auctionCount} auctions
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/leagues/${league.id}/dashboard`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                      {leagues.length > 3 && (
                        <div className="pt-2 border-t">
                          <Link href="/leagues">
                            <Button variant="ghost" className="w-full text-sm">
                              View all {leagues.length} leagues
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    !hasNoContent && (
                      <div className="text-center py-6">
                        <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">No leagues yet</p>
                        <Link href="/leagues/create">
                          <Button size="sm">Create Your First League</Button>
                        </Link>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  )
}
