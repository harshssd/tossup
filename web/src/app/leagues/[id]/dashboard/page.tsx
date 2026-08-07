'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Trophy,
  Users,
  Settings,
  Plus,
  Mail,
  Activity,
  ArrowLeft,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { LeagueData, OrganizationRole } from '@/lib/types'
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

interface LeagueInfo extends LeagueData {
  id: string
  ownerId: string
  memberCount: number
  auctionCount: number
  createdAt: Date
  userRole: OrganizationRole
  club?: {
    id: string
    name: string
    slug: string
  }
}

interface LeagueMember {
  id: string
  name: string
  email: string
  image?: string
  role: OrganizationRole
  joinedAt: Date
}

interface LeagueAuction {
  id: string
  name: string
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'COMPLETED'
  scheduledFor?: Date
  teamCount: number
  createdAt: Date
}

export default function LeaguesDashboard() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const leagueId = params.id as string

  const [league, setLeague] = useState<LeagueInfo | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [auctions, setAuctions] = useState<LeagueAuction[]>([])
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
  }, [leagueId])

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }
      setUser(user)

      // Fetch league by id
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*, clubs(id, name, slug)')
        .eq('id', leagueId)
        .single()

      if (leagueError || !leagueData) {
        setIsLoading(false)
        return // Will show "League not found" UI
      }

      // Fetch members with user info
      const { data: membersData, error: membersError } = await supabase
        .from('league_memberships')
        .select('*, users(id, name, email, image)')
        .eq('league_id', leagueData.id)

      if (membersError) throw membersError

      // Fetch auctions for this league
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select('*, teams(count)')
        .eq('league_id', leagueData.id)
        .order('created_at', { ascending: false })

      if (auctionsError) throw auctionsError

      // Determine current user's role
      const currentMembership = (membersData || []).find(
        (m: any) => m.users?.id === user.id || m.user_id === user.id
      )
      const isOwner = leagueData.owner_id === user.id
      const userRole: OrganizationRole = isOwner
        ? 'OWNER'
        : currentMembership?.role || 'MEMBER'

      // If user has no access (not owner and not a member), show not found
      if (!isOwner && !currentMembership && leagueData.visibility === 'PRIVATE') {
        setIsLoading(false)
        return
      }

      const leagueInfo: LeagueInfo = {
        id: leagueData.id,
        name: leagueData.name,
        description: leagueData.description,
        type: leagueData.type,
        visibility: leagueData.visibility,
        startDate: leagueData.start_date ? new Date(leagueData.start_date) : undefined,
        endDate: leagueData.end_date ? new Date(leagueData.end_date) : undefined,
        clubId: leagueData.club_id,
        ownerId: leagueData.owner_id,
        memberCount: membersData?.length || 0,
        auctionCount: auctionsData?.length || 0,
        createdAt: new Date(leagueData.created_at),
        userRole,
        club: leagueData.clubs ? {
          id: leagueData.clubs.id,
          name: leagueData.clubs.name,
          slug: leagueData.clubs.slug
        } : undefined,
      }

      const leagueMembers: LeagueMember[] = (membersData || []).map((m: any) => ({
        id: m.users?.id || m.user_id,
        name: m.users?.name || 'Unknown',
        email: m.users?.email || '',
        image: m.users?.image,
        role: m.role,
        joinedAt: new Date(m.joined_at),
      }))

      const leagueAuctions: LeagueAuction[] = (auctionsData || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        scheduledFor: a.scheduled_at ? new Date(a.scheduled_at) : undefined,
        teamCount: a.teams?.[0]?.count ?? 0,
        createdAt: new Date(a.created_at),
      }))

      setLeague(leagueInfo)
      setMembers(leagueMembers)
      setAuctions(leagueAuctions)
    } catch (error) {
      console.error('Failed to load league dashboard:', error)
      toast.error('Failed to load league data')
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
        .from('league_invites')
        .insert({
          league_id: league!.id,
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

  const handleDeleteAuction = async (auctionId: string) => {
    if (!confirm('Are you sure you want to delete this auction? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId)

      if (error) throw error

      toast.success('Auction deleted successfully')
      setAuctions(auctions.filter(a => a.id !== auctionId))
    } catch (error) {
      console.error('Failed to delete auction:', error)
      toast.error('Failed to delete auction')
    }
  }

  const handleDeleteLeague = async () => {
    if (!league) return

    if (confirmName !== league.name) {
      toast.error('League name does not match. Please type the exact league name to confirm.')
      return
    }

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', league.id)

      if (error) throw error

      toast.success('League deleted successfully')
      router.push('/home')
    } catch (error) {
      console.error('Failed to delete league:', error)
      toast.error('Failed to delete league')
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

  if (!league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-4">League not found</h1>
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
                  {league.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{league.name}</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {league.userRole === 'OWNER' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
              )}
              {league.userRole === 'OWNER' && (
                <Button size="sm" asChild>
                  <Link href={`/auction/create?league=${league.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Auction
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* League Info */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">{league.name}</h2>
                <p className="text-blue-100 mb-4">{league.description}</p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>{league.memberCount} members</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-4 w-4" />
                    <span>{league.auctionCount} auctions</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="mb-2">
                  {league.userRole}
                </Badge>
                <p className="text-sm text-blue-100">
                  {league.type.charAt(0) + league.type.slice(1).toLowerCase()} League
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
                    <span>Auctions</span>
                  </CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/auction/create?league=${league.id}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Auction
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {auctions.length > 0 ? (
                  <div className="space-y-4">
                    {auctions.map((auction) => (
                      <div
                        key={auction.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">{auction.name}</h3>
                            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                              <span>{auction.teamCount} teams</span>
                              <span>•</span>
                              <span>Created {auction.createdAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary">{auction.status}</Badge>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/auction/${auction.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </Button>
                          {league.userRole === 'OWNER' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/auction/${auction.id}/settings`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Auction
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteAuction(auction.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Auction
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
                    <h3 className="text-lg font-medium text-foreground mb-2">No auctions yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first auction to get started
                    </p>
                    <Button asChild>
                      <Link href={`/auction/create?league=${league.id}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Auction
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                  {league.userRole === 'OWNER' && (
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

            {/* League Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>League Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <Badge variant="secondary">{league.visibility}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span>{league.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{league.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
                {league.userRole === 'OWNER' && (
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
            <DialogTitle>Invite Member to {league?.name}</DialogTitle>
            <DialogDescription>
              Send an invitation to join this league. The recipient will receive an email with a link to accept the invitation.
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
              Manage members of {league?.name}
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

      {/* League Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>League Settings</DialogTitle>
            <DialogDescription>
              Manage settings for {league?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>League Name</Label>
                  <Input defaultValue={league?.name} disabled />
                </div>
                <div>
                  <Label>League Type</Label>
                  <Input defaultValue={league?.type} disabled />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea defaultValue={league?.description || 'No description'} disabled rows={3} />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">League Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Visibility</Label>
                  <div className="mt-2">
                    <Badge variant="secondary">{league?.visibility}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{league?.memberCount}</div>
                  <div className="text-sm text-muted-foreground">Members</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-success">{league?.auctionCount}</div>
                  <div className="text-sm text-muted-foreground">Auctions</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{auctions.reduce((sum, a) => sum + a.teamCount, 0)}</div>
                  <div className="text-sm text-muted-foreground">Total Teams</div>
                </div>
              </div>
            </div>

            {/* Hosting Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Hosting Information</h3>
              {league?.club ? (
                <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-success-foreground">
                        Hosted by {league.club.name}
                      </p>
                      <p className="text-sm text-success-foreground">
                        This league is part of {league.club.name} club
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-info/10 rounded-lg border border-info/30">
                  <div className="flex items-center space-x-3">
                    <Trophy className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-info-foreground">
                        Hosted Independently
                      </p>
                      <p className="text-sm text-info-foreground">
                        This league is managed independently and not associated with any club
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            {league?.userRole === 'OWNER' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-destructive">Delete League</h4>
                      <p className="text-sm text-destructive mt-1">
                        Permanently delete this league and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete League
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
            <DialogTitle>Delete League</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete "{league?.name}"?
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
                      <li>All league members will be removed</li>
                      <li>All auctions in this league will be deleted</li>
                      <li>All teams and players in those auctions will be deleted</li>
                      <li>All associated data will be permanently lost</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type <strong>{league?.name}</strong> to confirm:
              </Label>
              <Input
                id="confirm-name"
                placeholder={`Type "${league?.name}" here`}
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
              onClick={handleDeleteLeague}
              disabled={isDeleting || confirmName !== league?.name}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete League
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}