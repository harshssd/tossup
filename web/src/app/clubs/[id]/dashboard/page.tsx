'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Settings,
  Plus,
  Mail,
  Activity,
  ArrowLeft,
  MoreHorizontal,
  Trophy,
  ExternalLink,
  Edit,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ClubData, OrganizationRole } from '@/lib/types'
import { EventList } from '@/components/events/EventList'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ClubInfo extends ClubData {
  id: string
  ownerId: string
  memberCount: number
  leagueCount: number
  createdAt: Date
  userRole: OrganizationRole
}

interface ClubMember {
  id: string
  name: string
  email: string
  image?: string
  role: OrganizationRole
  joinedAt: Date
}

interface ClubLeague {
  id: string
  name: string
  code: string
  type: string
  auctionCount: number
  createdAt: Date
  isHosted: boolean // true for internal/hosted leagues, false for external/participated leagues
  hostClubName?: string // for external leagues, show which club hosts them
}

export default function ClubsDashboard() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const clubId = params.id as string

  const [club, setClub] = useState<ClubInfo | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [leagues, setLeagues] = useState<ClubLeague[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>('MEMBER')
  const [isInviting, setIsInviting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [clubId])

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }
      setUser(user)

      // Fetch club by id
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', clubId)
        .single()

      if (clubError || !clubData) {
        setIsLoading(false)
        return // Will show "Club not found" UI
      }

      // Fetch members with user info
      const { data: membersData, error: membersError } = await supabase
        .from('club_memberships')
        .select('*, users(id, name, email, image)')
        .eq('club_id', clubData.id)

      if (membersError) throw membersError

      // Fetch leagues hosted by this club
      const { data: hostedLeagues, error: hostedError } = await supabase
        .from('leagues')
        .select('*, auctions(count)')
        .eq('club_id', clubData.id)
        .order('created_at', { ascending: false })

      if (hostedError) throw hostedError

      // Fetch leagues where club members participate (external leagues)
      const { data: participatedLeagues, error: participatedError } = await supabase
        .from('league_memberships')
        .select(`
          leagues!inner(
            id, name, code, type, created_at, club_id,
            clubs(name),
            auctions(count)
          )
        `)
        .in('user_id', (membersData || []).map((m: any) => m.users?.id || m.user_id).filter(Boolean))
        .neq('leagues.club_id', clubData.id) // Exclude leagues hosted by this club

      if (participatedError) throw participatedError

      // Determine current user's role
      const currentMembership = (membersData || []).find(
        (m: any) => m.users?.id === user.id || m.user_id === user.id
      )
      const isOwner = clubData.owner_id === user.id
      const userRole: OrganizationRole = isOwner
        ? 'OWNER'
        : currentMembership?.role || 'MEMBER'

      // If user has no access (not owner and not a member), show not found
      if (!isOwner && !currentMembership && clubData.visibility === 'PRIVATE') {
        setIsLoading(false)
        return
      }

      const clubInfo: ClubInfo = {
        id: clubData.id,
        name: clubData.name,
        description: clubData.description,
        visibility: clubData.visibility,
        ownerId: clubData.owner_id,
        memberCount: membersData?.length || 0,
        leagueCount: (hostedLeagues?.length || 0) + (participatedLeagues?.length || 0),
        createdAt: new Date(clubData.created_at),
        userRole,
      }

      const clubMembers: ClubMember[] = (membersData || []).map((m: any) => ({
        id: m.users?.id || m.user_id,
        name: m.users?.name || 'Unknown',
        email: m.users?.email || '',
        image: m.users?.image,
        role: m.role,
        joinedAt: new Date(m.joined_at),
      }))

      // Combine hosted and participated leagues
      const allLeagues: ClubLeague[] = []

      // Add hosted leagues (internal)
      if (hostedLeagues) {
        hostedLeagues.forEach((l: any) => {
          allLeagues.push({
            id: l.id,
            name: l.name,
            code: l.code,
            type: l.type,
            auctionCount: l.auctions?.[0]?.count ?? 0,
            createdAt: new Date(l.created_at),
            isHosted: true,
          })
        })
      }

      // Add participated leagues (external)
      if (participatedLeagues) {
        // Remove duplicates and group by league
        const uniqueParticipatedLeagues = new Map()
        participatedLeagues.forEach((membership: any) => {
          const league = membership.leagues
          if (league && !uniqueParticipatedLeagues.has(league.id)) {
            uniqueParticipatedLeagues.set(league.id, {
              id: league.id,
              name: league.name,

              type: league.type,
              auctionCount: league.auctions?.[0]?.count ?? 0,
              createdAt: new Date(league.created_at),
              isHosted: false,
              hostClubName: league.clubs?.name || 'Independent',
            })
          }
        })

        uniqueParticipatedLeagues.forEach(league => allLeagues.push(league))
      }

      // Sort by creation date (newest first)
      const clubLeagues = allLeagues.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      setClub(clubInfo)
      setMembers(clubMembers)
      setLeagues(clubLeagues)
    } catch (error) {
      console.error('Failed to load club dashboard:', error)
      toast.error('Failed to load club data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setIsInviting(true)
    try {
      // Generate invite token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const { data, error } = await supabase
        .from('club_invites')
        .insert({
          club_id: club!.id,
          email: inviteEmail,
          role: selectedRole,
          token,
          expires_at: expiresAt.toISOString(),
        })

      if (error) throw error

      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setSelectedRole('MEMBER')
      setShowInviteDialog(false)
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast.error('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleDeleteLeague = async (leagueId: string) => {
    if (!confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId)

      if (error) throw error

      toast.success('League deleted successfully')
      setLeagues(leagues.filter(l => l.id !== leagueId))
    } catch (error) {
      console.error('Failed to delete league:', error)
      toast.error('Failed to delete league')
    }
  }

  const handleDeleteClub = async () => {
    if (!club) return

    if (confirmName !== club.name) {
      toast.error('Club name does not match. Please type the exact club name to confirm.')
      return
    }

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('clubs')
        .delete()
        .eq('id', club.id)

      if (error) throw error

      toast.success('Club deleted successfully')
      router.push('/home')
    } catch (error) {
      console.error('Failed to delete club:', error)
      toast.error('Failed to delete club')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setConfirmName('')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-4">Club not found</h1>
          <Link href="/home">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/home">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold bg-primary text-primary-foreground"
                >
                  {club.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{club.name}</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {club.userRole === 'OWNER' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
              )}
              {club.userRole === 'OWNER' && (
                <Button size="sm" asChild>
                  <Link href={`/leagues/create?club=${clubId}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    New League
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Club Info */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">{club.name}</h2>
                <p className="text-blue-100 mb-4">{club.description}</p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>{club.memberCount} members</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-4 w-4" />
                    <span>{club.leagueCount} leagues</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="mb-2">
                  {club.userRole}
                </Badge>
                <p className="text-sm text-blue-100">
                  Cricket Club
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Auctions */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="h-5 w-5" />
                    <span>Club Leagues</span>
                  </CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/leagues/create?club=${clubId}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      New League
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leagues.length > 0 ? (
                  <div className="space-y-4">
                    {leagues.map((league) => (
                      <div
                        key={league.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{league.name}</h3>
                              {league.isHosted ? (
                                <Badge className="text-xs bg-success/10 text-success">
                                  Internal League
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-info/10 text-info-foreground">
                                  External League
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                              <span>{league.auctionCount} auctions</span>
                              <span>•</span>
                              <Badge variant="secondary" className="text-xs">{league.type}</Badge>
                              {!league.isHosted && league.hostClubName && (
                                <>
                                  <span>•</span>
                                  <span>Hosted by {league.hostClubName}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Created {league.createdAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/leagues/${league.id}/dashboard`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </Button>
                          {club.userRole === 'OWNER' && league.isHosted && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/leagues/${league.id}/settings`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit League
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteLeague(league.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete League
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No leagues yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first league to start organizing auctions
                    </p>
                    <Button asChild>
                      <Link href={`/leagues/create?club=${clubId}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create League
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Club Events */}
            <div className="mt-6">
              <EventList
                clubId={clubId}
                isAdmin={club.userRole === 'OWNER'}
              />
            </div>

            {/* Recent Activity */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Members & Settings */}
          <div className="space-y-6">
            {/* Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Members ({members.length})</span>
                  </CardTitle>
                  {club.userRole === 'OWNER' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInviteDialog(true)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.image} alt={member.name} />
                          <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                  {members.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-sm"
                      onClick={() => setShowMembersDialog(true)}
                    >
                      View all {members.length} members
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Club Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Club Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <Badge variant="secondary">{club.visibility}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{club.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
                {club.userRole === 'OWNER' && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => setShowSettingsDialog(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Settings
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member to {club?.name}</DialogTitle>
            <DialogDescription>
              Send an invitation to join this club. The recipient will receive an email with a link to accept the invitation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as OrganizationRole)}
              >
                <option value="MEMBER">Member</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={isInviting}>
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>All Members ({members.length})</DialogTitle>
            <DialogDescription>
              Manage members of {club?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.image} alt={member.name} />
                      <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {member.joinedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMembersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Club Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Club Settings</DialogTitle>
            <DialogDescription>
              Manage settings for {club?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div>
                <Label>Club Name</Label>
                <Input defaultValue={club?.name} disabled />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea defaultValue={club?.description || 'No description'} disabled rows={3} />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Club Settings</h3>
              <div>
                <Label>Visibility</Label>
                <div className="mt-2">
                  <Badge variant="secondary">{club?.visibility}</Badge>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{club?.memberCount}</div>
                  <div className="text-sm text-muted-foreground">Members</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-success">{club?.leagueCount}</div>
                  <div className="text-sm text-muted-foreground">Leagues</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{leagues.reduce((sum, l) => sum + l.auctionCount, 0)}</div>
                  <div className="text-sm text-muted-foreground">Total Auctions</div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {club?.userRole === 'OWNER' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-destructive">Delete Club</h4>
                      <p className="text-sm text-destructive mt-1">
                        Permanently delete this club and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Club
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Close
            </Button>
            <Button disabled>
              <Edit className="h-4 w-4 mr-2" />
              Edit Settings (Coming Soon)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Club</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete "{club?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-destructive">
                    This action cannot be undone
                  </h3>
                  <div className="mt-2 text-sm text-destructive">
                    <ul className="list-disc list-inside space-y-1">
                      <li>All club members will be removed</li>
                      <li>All leagues in this club will be deleted</li>
                      <li>All auctions in those leagues will be deleted</li>
                      <li>All associated data will be permanently lost</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type <strong>{club?.name}</strong> to confirm:
              </Label>
              <Input
                id="confirm-name"
                placeholder={`Type "${club?.name}" here`}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={isDeleting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClub}
              disabled={isDeleting || confirmName !== club?.name}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Club
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}