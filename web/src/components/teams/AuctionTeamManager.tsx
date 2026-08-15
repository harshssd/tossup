'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Plus, Users, Crown, Trash2, UserPlus, X, Lock,
  Shield, ChevronRight, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface User {
  id: string
  name: string
  email: string
  image?: string
}

interface PlayerInfo {
  id: string
  name: string
  image?: string
  playingRole: string
  tier?: { name: string; color: string }
}

interface Team {
  id: string
  name: string
  description?: string
  primaryColor: string
  secondaryColor: string
  logo?: string
  captainId?: string
  captainPlayerId?: string
  budgetRemaining?: number
  captain?: User
  captainPlayer?: { id: string; name: string; image?: string; playingRole: string }
  players: PlayerInfo[]
  _count: {
    players: number
    members: number
  }
}

interface AuctionTeamManagerProps {
  auctionId: string
  auctionName?: string
  availableMembers?: User[]
  onTeamChange?: () => void
}

const TEAM_COLORS = [
  '#3B82F6', '#EF4444', '#22C55E', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

export function AuctionTeamManager({
  auctionId,
  auctionName,
  availableMembers = [],
  onTeamChange,
}: AuctionTeamManagerProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [auctionStatus, setAuctionStatus] = useState<string>('DRAFT')
  const [budgetPerTeam, setBudgetPerTeam] = useState<number>(1000)
  const [loading, setLoading] = useState(false)
  const [updatingBudget, setUpdatingBudget] = useState(false)
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)

  // Inline edit state per team
  const [editingNames, setEditingNames] = useState<Record<string, string>>({})

  // Captain picker state
  const [allPlayers, setAllPlayers] = useState<PlayerInfo[]>([])
  const [loadingAllPlayers, setLoadingAllPlayers] = useState(false)
  const [captainSearch, setCaptainSearch] = useState('')
  const [assigningCaptain, setAssigningCaptain] = useState(false)
  const [showCaptainPicker, setShowCaptainPicker] = useState(false)

  // Player assignment state
  const [availablePlayers, setAvailablePlayers] = useState<PlayerInfo[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [playerSearch, setPlayerSearch] = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditable = auctionStatus === 'DRAFT' || auctionStatus === 'LOBBY'

  // ── Data fetching ──────────────────────────────────────────────

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/auctions/${auctionId}/teams`)
      const data = await response.json()
      if (data.teams) {
        setTeams(data.teams)
        if (data.auctionStatus) setAuctionStatus(data.auctionStatus)
        if (data.budgetPerTeam) setBudgetPerTeam(data.budgetPerTeam)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const fetchAvailablePlayers = async () => {
    try {
      setLoadingPlayers(true)
      const response = await fetch(`/api/auctions/${auctionId}/players/import`)
      const data = await response.json()
      if (data.players) {
        const unassigned = data.players.filter((p: any) => !p.assignedTeam && !p.assigned_team)
        setAvailablePlayers(unassigned.map((p: any) => ({
          id: p.id,
          name: p.name,
          image: p.image,
          playingRole: p.playing_role || p.playingRole,
          tier: p.tier ? { name: p.tier.name, color: p.tier.color } : undefined,
        })))
      }
    } catch (error) {
      console.error('Failed to fetch players:', error)
    } finally {
      setLoadingPlayers(false)
    }
  }

  const fetchAllPlayers = async () => {
    try {
      setLoadingAllPlayers(true)
      const response = await fetch(`/api/auctions/${auctionId}/players/import`)
      const data = await response.json()
      if (data.players) {
        setAllPlayers(data.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          image: p.image,
          playingRole: p.playing_role || p.playingRole,
          tier: p.tier ? { name: p.tier.name, color: p.tier.color } : undefined,
        })))
      }
    } catch (error) {
      console.error('Failed to fetch players:', error)
    } finally {
      setLoadingAllPlayers(false)
    }
  }

  // ── Team CRUD ──────────────────────────────────────────────────

  const handleCreate = async () => {
    const newName = `Team ${teams.length + 1}`
    const color = TEAM_COLORS[teams.length % TEAM_COLORS.length]

    try {
      setLoading(true)
      const response = await fetch(`/api/auctions/${auctionId}/teams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams: [
            ...teams.map(t => ({ id: t.id, name: t.name, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor })),
            {
              name: newName,
              primaryColor: color,
              secondaryColor: '#1B2A4A',
              budgetRemaining: budgetPerTeam,
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create team')
      }

      const result = await response.json()
      const newTeams = result.teams || []
      setTeams(newTeams)

      // Find the newly created team and expand it
      const newTeam = newTeams.find((t: Team) => !teams.some(existing => existing.id === t.id))
      if (newTeam) {
        setExpandedTeamId(newTeam.id)
        setEditingNames(prev => ({ ...prev, [newTeam.id]: newTeam.name }))
        // Focus name input after a short delay for animation
        setTimeout(() => nameInputRef.current?.select(), 200)
      }

      toast.success(`Team created`)
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveName = async (team: Team) => {
    const newName = editingNames[team.id]?.trim()
    if (!newName || newName === team.name) {
      // Reset to original
      setEditingNames(prev => { const n = { ...prev }; delete n[team.id]; return n })
      return
    }

    try {
      const response = await fetch(`/api/auctions/${auctionId}/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update team')
      }

      setTeams(prev => prev.map(t => t.id === team.id ? { ...t, name: newName } : t))
      setEditingNames(prev => { const n = { ...prev }; delete n[team.id]; return n })
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update team')
    }
  }

  const handleDelete = async (team: Team) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/auctions/${auctionId}/teams/${team.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete team')
      }

      toast.success(`Team "${team.name}" deleted`)
      setDeletingTeamId(null)
      setExpandedTeamId(null)
      await fetchTeams()
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete team')
    } finally {
      setLoading(false)
    }
  }

  // ── Captain assignment ─────────────────────────────────────────

  const handleAssignCaptain = async (teamId: string, playerId: string) => {
    try {
      setAssigningCaptain(true)
      const response = await fetch(`/api/auctions/${auctionId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captainPlayerId: playerId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign captain')
      }

      toast.success('Captain assigned')
      setShowCaptainPicker(false)
      setCaptainSearch('')
      await fetchTeams()
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign captain')
    } finally {
      setAssigningCaptain(false)
    }
  }

  const handleRemoveCaptain = async (teamId: string) => {
    try {
      setAssigningCaptain(true)
      const response = await fetch(`/api/auctions/${auctionId}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captainPlayerId: null })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove captain')
      }

      toast.success('Captain removed')
      await fetchTeams()
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove captain')
    } finally {
      setAssigningCaptain(false)
    }
  }

  // ── Player assignment ──────────────────────────────────────────

  const handleAssignPlayer = async (teamId: string, playerId: string) => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/teams/${teamId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: [playerId] })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign player')
      }

      setAvailablePlayers(prev => prev.filter(p => p.id !== playerId))
      await fetchTeams()
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign player')
    }
  }

  const handleRemovePlayer = async (teamId: string, playerId: string) => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/teams/${teamId}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: [playerId] })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove player')
      }

      await fetchTeams()
      // Re-fetch available players if picker is open
      if (showPlayerPicker) fetchAvailablePlayers()
      onTeamChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove player')
    }
  }

  // ── Budget ─────────────────────────────────────────────────────

  const handleBudgetUpdate = async (newBudget: number) => {
    try {
      setUpdatingBudget(true)
      const response = await fetch(`/api/auctions/${auctionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetPerTeam: newBudget })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update budget')
      }

      setBudgetPerTeam(newBudget)
      await fetchTeams()
      onTeamChange?.()
      toast.success(`Budget updated to ${newBudget} coins per team`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update budget')
    } finally {
      setUpdatingBudget(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  const toggleExpand = (teamId: string) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null)
      setShowCaptainPicker(false)
      setShowPlayerPicker(false)
    } else {
      setExpandedTeamId(teamId)
      setShowCaptainPicker(false)
      setShowPlayerPicker(false)
      setDeletingTeamId(null)
    }
  }

  const openCaptainPicker = () => {
    setShowCaptainPicker(true)
    setShowPlayerPicker(false)
    setCaptainSearch('')
    fetchAllPlayers()
  }

  const openPlayerPicker = () => {
    setShowPlayerPicker(true)
    setShowCaptainPicker(false)
    setPlayerSearch('')
    fetchAvailablePlayers()
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Teams</h3>
          <p className="text-sm text-muted-foreground">
            {teams.length} team{teams.length !== 1 ? 's' : ''} configured
            {!isEditable && (
              <span className="inline-flex items-center gap-1 ml-2 text-amber-600">
                <Lock className="w-3 h-3" /> Editing locked
              </span>
            )}
          </p>
        </div>
        {isEditable && (
          <Button onClick={handleCreate} disabled={loading} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Team
          </Button>
        )}
      </div>

      {/* Team Cards */}
      {loading && teams.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No teams yet</p>
          {isEditable && <p className="text-sm mt-1">Click &quot;Add Team&quot; to get started</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {teams.map((team, index) => {
              const isExpanded = expandedTeamId === team.id
              const isDeleting = deletingTeamId === team.id
              const captainName = team.captainPlayer?.name || team.captain?.name

              return (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <div className={`border rounded-lg overflow-hidden transition-colors ${
                    isExpanded ? 'border-primary/40 shadow-sm' : 'hover:border-muted-foreground/30'
                  }`}>
                    {/* Collapsed row — always visible */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(team.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                      <span className="font-medium text-sm flex-1 truncate">{team.name}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Captain: {captainName || '—'}
                      </span>
                      <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                        {team.players?.length || 0} player{(team.players?.length || 0) !== 1 ? 's' : ''}
                      </Badge>
                      {team.budgetRemaining != null && (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {team.budgetRemaining}
                        </span>
                      )}
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </motion.div>
                    </button>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
                            <div className="pt-3" />

                            {/* Team Name */}
                            {isEditable && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                                <Input
                                  ref={nameInputRef}
                                  value={editingNames[team.id] ?? team.name}
                                  onChange={(e) => setEditingNames(prev => ({ ...prev, [team.id]: e.target.value }))}
                                  onBlur={() => handleSaveName(team)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveName(team)
                                    if (e.key === 'Escape') {
                                      setEditingNames(prev => { const n = { ...prev }; delete n[team.id]; return n })
                                    }
                                  }}
                                  className="h-9"
                                />
                              </div>
                            )}

                            {/* Captain */}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Captain</label>
                              {team.captainPlayer ? (
                                <div className="flex items-center gap-2 p-2 rounded-md border bg-yellow-500/5 border-yellow-500/20">
                                  <Avatar className="w-6 h-6">
                                    <AvatarImage src={team.captainPlayer.image} />
                                    <AvatarFallback className="text-xs">
                                      {team.captainPlayer.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium flex-1">{team.captainPlayer.name}</span>
                                  <Crown className="w-3.5 h-3.5 text-yellow-600" />
                                  {isEditable && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRemoveCaptain(team.id)}
                                      disabled={assigningCaptain}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ) : team.captain ? (
                                <div className="flex items-center gap-2 p-2 rounded-md border bg-yellow-500/5 border-yellow-500/20">
                                  <Avatar className="w-6 h-6">
                                    <AvatarImage src={team.captain.image} />
                                    <AvatarFallback className="text-xs">
                                      {team.captain.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium flex-1">{team.captain.name}</span>
                                  <Crown className="w-3.5 h-3.5 text-yellow-600" />
                                </div>
                              ) : isEditable ? (
                                !showCaptainPicker ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={openCaptainPicker}
                                  >
                                    <Crown className="w-3 h-3 mr-1.5" />
                                    Select a captain from player pool
                                  </Button>
                                ) : null
                              ) : (
                                <p className="text-xs text-muted-foreground italic">No captain assigned</p>
                              )}

                              {/* Inline captain picker */}
                              {isEditable && showCaptainPicker && expandedTeamId === team.id && (
                                <div className="mt-2 border rounded-md p-2 bg-card space-y-2">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Search players..."
                                      value={captainSearch}
                                      onChange={(e) => setCaptainSearch(e.target.value)}
                                      className="h-8 pl-8 text-xs"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                                    {loadingAllPlayers ? (
                                      <div className="flex justify-center py-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                                      </div>
                                    ) : (() => {
                                      const filtered = allPlayers.filter(p =>
                                        p.name.toLowerCase().includes(captainSearch.toLowerCase()) ||
                                        p.playingRole.toLowerCase().includes(captainSearch.toLowerCase())
                                      )
                                      return filtered.length > 0 ? (
                                        filtered.map(player => (
                                          <button
                                            key={player.id}
                                            type="button"
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-muted transition-colors"
                                            onClick={() => handleAssignCaptain(team.id, player.id)}
                                            disabled={assigningCaptain}
                                          >
                                            <Avatar className="w-5 h-5">
                                              <AvatarImage src={player.image} />
                                              <AvatarFallback className="text-[9px]">
                                                {player.name.charAt(0).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 truncate text-xs">{player.name}</span>
                                            {player.tier && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: player.tier.color, color: player.tier.color }}>
                                                {player.tier.name}
                                              </span>
                                            )}
                                          </button>
                                        ))
                                      ) : (
                                        <p className="text-xs text-muted-foreground text-center py-3">
                                          {captainSearch ? 'No players match' : 'No players in pool'}
                                        </p>
                                      )
                                    })()}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-7 text-xs"
                                    onClick={() => setShowCaptainPicker(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Pre-assigned Players */}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Pre-assigned Players (optional)
                              </label>
                              {team.players && team.players.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {team.players.map(player => (
                                    <div
                                      key={player.id}
                                      className="flex items-center gap-2 px-2 py-1 rounded border bg-card text-sm"
                                    >
                                      <span className="flex-1 truncate">{player.name}</span>
                                      {player.tier && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: player.tier.color, color: player.tier.color }}>
                                          {player.tier.name}
                                        </span>
                                      )}
                                      {isEditable && (
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-destructive transition-colors"
                                          onClick={() => handleRemovePlayer(team.id, player.id)}
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isEditable && !showPlayerPicker && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={openPlayerPicker}
                                >
                                  <UserPlus className="w-3 h-3 mr-1.5" />
                                  Add player from pool
                                </Button>
                              )}

                              {/* Inline player picker */}
                              {isEditable && showPlayerPicker && expandedTeamId === team.id && (
                                <div className="mt-2 border rounded-md p-2 bg-card space-y-2">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Search unassigned players..."
                                      value={playerSearch}
                                      onChange={(e) => setPlayerSearch(e.target.value)}
                                      className="h-8 pl-8 text-xs"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                                    {loadingPlayers ? (
                                      <div className="flex justify-center py-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                                      </div>
                                    ) : (() => {
                                      const filtered = availablePlayers.filter(p =>
                                        p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
                                        p.playingRole.toLowerCase().includes(playerSearch.toLowerCase())
                                      )
                                      return filtered.length > 0 ? (
                                        filtered.map(player => (
                                          <button
                                            key={player.id}
                                            type="button"
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-muted transition-colors"
                                            onClick={() => handleAssignPlayer(team.id, player.id)}
                                          >
                                            <span className="flex-1 truncate text-xs">{player.name}</span>
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                              {player.playingRole?.replace('_', ' ')}
                                            </Badge>
                                            {player.tier && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: player.tier.color, color: player.tier.color }}>
                                                {player.tier.name}
                                              </span>
                                            )}
                                            <Plus className="w-3 h-3 text-muted-foreground" />
                                          </button>
                                        ))
                                      ) : (
                                        <p className="text-xs text-muted-foreground text-center py-3">
                                          {playerSearch ? 'No players match' : 'No unassigned players. Import players first.'}
                                        </p>
                                      )
                                    })()}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-7 text-xs"
                                    onClick={() => setShowPlayerPicker(false)}
                                  >
                                    Done
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Actions row */}
                            {isEditable && (
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => window.open(`/admin/auctions/${auctionId}/teams/${team.id}/admins`, '_blank')}
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admins
                                </Button>
                                <div className="flex-1" />
                                {isDeleting ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-destructive">Delete this team?</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => setDeletingTeamId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleDelete(team)}
                                      disabled={loading}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Delete
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeletingTeamId(team.id)}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Budget Configuration */}
      {isEditable && (
        <Card className="bg-info/10 border-info/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-info-foreground text-sm">Budget per Team</h4>
                <p className="text-xs text-info-foreground">
                  How many coins each team starts with
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={budgetPerTeam}
                  onChange={(e) => setBudgetPerTeam(parseInt(e.target.value) || 0)}
                  min="100"
                  max="10000"
                  step="50"
                  className="w-24 h-8 text-center tabular-nums"
                  disabled={updatingBudget}
                />
                <span className="text-xs text-info-foreground">coins</span>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => handleBudgetUpdate(budgetPerTeam)}
                  disabled={updatingBudget || budgetPerTeam < 100 || budgetPerTeam > 10000}
                >
                  {updatingBudget ? 'Saving...' : 'Update'}
                </Button>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[600, 1000, 1500].map(val => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  onClick={() => setBudgetPerTeam(val)}
                  className="text-xs h-7"
                  disabled={updatingBudget}
                >
                  {val}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
