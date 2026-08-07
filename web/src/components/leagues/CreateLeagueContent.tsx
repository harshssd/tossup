'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Calendar,
  Users,
  Settings,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { LeagueType, LeagueData, Visibility } from '@/lib/types'

interface LeagueFormData extends LeagueData {
  // Additional form-specific fields
  inviteEmails: string[]
}

const LEAGUE_TYPES: Array<{ value: LeagueType; label: string; description: string; icon: typeof Trophy }> = [
  {
    value: 'TOURNAMENT',
    label: 'Tournament',
    description: 'Single elimination or round-robin tournament format',
    icon: Trophy
  },
  {
    value: 'LEAGUE',
    label: 'League',
    description: 'Regular season with multiple matches and ongoing competition',
    icon: Calendar
  }
]

const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; description: string }> = [
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Anyone can find and join your league'
  },
  {
    value: 'PRIVATE',
    label: 'Private',
    description: 'Only invited members can join'
  }
]

export default function CreateLeagueContent() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [availableClubs, setAvailableClubs] = useState<Array<{id: string, name: string, slug: string}>>([])
  const [preSelectedClub, setPreSelectedClub] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [formData, setFormData] = useState<LeagueFormData>({
    name: '',
    description: '',
    type: 'TOURNAMENT',
    visibility: 'PUBLIC',
    inviteEmails: [],
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/signin')
      return
    }
    setUser(user)

    // Load available clubs where user has permission to create leagues
    await loadAvailableClubs(user.id)

    // Check for pre-selected club from URL
    const clubParam = searchParams.get('club')
    if (clubParam) {
      setPreSelectedClub(clubParam)
      // Find club by slug and set clubId in form data
      const club = await findClubBySlug(clubParam)
      if (club) {
        handleInputChange('clubId', club.id)
      }
    }
  }

  const loadAvailableClubs = async (userId: string) => {
    try {
      // Get clubs where user is owner or admin
      const { data: ownedClubs } = await supabase
        .from('clubs')
        .select('id, name, slug')
        .eq('owner_id', userId)

      const { data: memberClubs } = await supabase
        .from('club_memberships')
        .select('clubs(id, name, slug)')
        .eq('user_id', userId)
        .in('role', ['OWNER', 'MEMBER'])

      const allClubs = [
        ...(ownedClubs || []),
        ...(memberClubs || []).map((m: any) => m.clubs).filter(Boolean)
      ]

      // Remove duplicates
      const uniqueClubs = allClubs.filter((club, index, self) =>
        club && index === self.findIndex((c) => c && c.id === club.id)
      )

      setAvailableClubs(uniqueClubs)
    } catch (error) {
      console.error('Failed to load clubs:', error)
    }
  }

  const findClubBySlug = async (slug: string) => {
    const { data: club } = await supabase
      .from('clubs')
      .select('id, name, slug')
      .eq('slug', slug.toUpperCase())
      .single()

    return club
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name?.trim()) {
          setError('League name is required')
          return false
        }
        if (!formData.type) {
          setError('League type is required')
          return false
        }
        break
      case 2:
        if (!formData.visibility) {
          setError('Visibility setting is required')
          return false
        }
        break
    }
    setError('')
    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  const generateLeagueCode = (name: string): string => {
    const prefix = name
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4)
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${prefix}-${suffix}`
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return
    if (!user) return

    setIsLoading(true)
    setError('')

    try {
      // Insert league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          name: formData.name,
          description: formData.description || null,
          code: generateLeagueCode(formData.name),
          type: formData.type,
          owner_id: user.id,
          club_id: formData.clubId || null,
          visibility: formData.visibility,
          start_date: formData.startDate?.toISOString() || null,
          end_date: formData.endDate?.toISOString() || null,
        })
        .select()
        .single()

      if (leagueError) throw leagueError

      // Add owner as a member with OWNER role
      const { error: memberError } = await supabase
        .from('league_memberships')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'OWNER',
        })

      if (memberError) throw memberError

      // Insert invites if any
      if (formData.inviteEmails.length > 0) {
        const invites = formData.inviteEmails.map(email => ({
          league_id: league.id,
          email,
          role: 'MEMBER' as const,
          token: crypto.randomUUID(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }))

        const { error: inviteError } = await supabase
          .from('league_invites')
          .insert(invites)

        if (inviteError) console.error('Failed to create invites:', inviteError)
      }

      setSuccess('League created successfully!')
      toast.success('League created successfully!')

      // Redirect to league dashboard
      setTimeout(() => {
        router.push(`/leagues/${league.id}/dashboard`)
      }, 1000)
    } catch (error: any) {
      console.error('League creation error:', error)
      if (error?.code === '23505') {
        setError('A league with this name already exists. Please choose a different name.')
      } else {
        setError('Failed to create league. Please try again.')
      }
      toast.error('Failed to create league')
    } finally {
      setIsLoading(false)
    }
  }

  const addInviteEmail = (email: string) => {
    if (email && !formData.inviteEmails.includes(email)) {
      setFormData(prev => ({
        ...prev,
        inviteEmails: [...prev.inviteEmails, email]
      }))
    }
  }

  const removeInviteEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      inviteEmails: prev.inviteEmails.filter(e => e !== email)
    }))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const steps = [
    { number: 1, title: 'Basic Info', description: 'League name and type' },
    { number: 2, title: 'Configuration', description: 'Visibility and schedule' },
    { number: 3, title: 'Invitations', description: 'Invite members' }
  ]

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
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Create League</h1>
            </div>
            <div className="flex items-center space-x-2">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${currentStep >= step.number
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    {currentStep > step.number ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-12 h-0.5 mx-2
                      ${currentStep > step.number ? 'bg-primary' : 'bg-muted'}
                    `} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Step {currentStep}: {steps[currentStep - 1].title}
            </h2>
            <p className="text-muted-foreground">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-base font-medium">
                    League Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Premier Cricket League"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">League Type *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {LEAGUE_TYPES.map((type) => {
                      const IconComponent = type.icon
                      return (
                        <div
                          key={type.value}
                          className={`
                            p-4 border-2 rounded-lg cursor-pointer transition-all
                            ${formData.type === type.value
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-ring'
                            }
                          `}
                          onClick={() => handleInputChange('type', type.value)}
                        >
                          <div className="flex items-center space-x-3">
                            <IconComponent className="h-5 w-5 text-primary" />
                            <div>
                              <h3 className="font-medium">{type.label}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-base font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Tell people what your league is about..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Visibility *</Label>
                  <div className="grid grid-cols-1 gap-4 mt-3">
                    {VISIBILITY_OPTIONS.map((visibility) => (
                      <div
                        key={visibility.value}
                        className={`
                          p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${formData.visibility === visibility.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-ring'
                          }
                        `}
                        onClick={() => handleInputChange('visibility', visibility.value)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{visibility.label}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{visibility.description}</p>
                          </div>
                          {formData.visibility === visibility.value && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="startDate" className="text-base font-medium">
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => handleInputChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endDate" className="text-base font-medium">
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate ? formData.endDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => handleInputChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Invitations */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Invite Members</h3>
                  <p className="text-muted-foreground">
                    Invite people to join your league. You can always add more members later.
                  </p>
                </div>

                <div>
                  <Label htmlFor="inviteEmail" className="text-base font-medium">
                    Email Invitations
                  </Label>
                  <div className="mt-2">
                    <div className="flex space-x-2">
                      <Input
                        id="inviteEmail"
                        type="email"
                        placeholder="Enter email address"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const email = (e.target as HTMLInputElement).value
                            if (email) {
                              addInviteEmail(email)
                              ;(e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('inviteEmail') as HTMLInputElement
                          const email = input.value
                          if (email) {
                            addInviteEmail(email)
                            input.value = ''
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Press Enter or click Add to include an email
                    </p>
                  </div>

                  {formData.inviteEmails.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Invited Members ({formData.inviteEmails.length})
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.inviteEmails.map((email) => (
                          <Badge
                            key={email}
                            variant="secondary"
                            className="px-3 py-1 flex items-center space-x-2"
                          >
                            <span>{email}</span>
                            <button
                              onClick={() => removeInviteEmail(email)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-info/10 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Settings className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium text-info-foreground">Skip for now?</h4>
                      <p className="text-sm text-info-foreground mt-1">
                        You can create the league without inviting anyone and add members later
                        from the league dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-6 border-success/30 bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription className="text-success-foreground">{success}</AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-8 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex space-x-3">
                {currentStep < 3 && (
                  <Button onClick={nextStep}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {currentStep === 3 && (
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className=""
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Creating League...
                      </>
                    ) : (
                      <>
                        Create League
                        <Trophy className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}