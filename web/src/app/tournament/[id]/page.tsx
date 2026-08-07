import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { FixtureList } from '@/components/tournament/FixtureList'
import { RegistrationForm } from '@/components/tournament/RegistrationForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Trophy,
  MapPin,
  Calendar,
  ArrowLeft,
  Globe,
  FileText,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface TournamentPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('leagues')
    .select('name, description, venue')
    .eq('id', id)
    .eq('visibility', 'PUBLIC')
    .maybeSingle()

  if (!tournament) {
    return { title: 'Tournament Not Found | TossUp' }
  }

  const description = tournament.description || `${tournament.name} cricket tournament on TossUp`

  return {
    title: `${tournament.name} | TossUp`,
    description,
    openGraph: {
      title: `${tournament.name} | TossUp`,
      description,
    },
  }
}

const registrationStatusColors: Record<string, string> = {
  OPEN: 'bg-green-500/10 text-green-400',
  CLOSED: 'bg-red-500/10 text-red-400',
  UPCOMING: 'bg-yellow-500/10 text-yellow-400',
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser()

  const { data: tournament, error } = await supabase
    .from('leagues')
    .select(`
      id, name, description, type, visibility, logo, banner, primary_color,
      season, start_date, end_date, max_teams,
      registration_url, rules_text, social_links, format, venue,
      contact_info, registration_status, standings,
      owner:users!owner_id(id, name),
      fixtures(id, match_number, team_a_name, team_b_name, venue, scheduled_at, result, winner, notes),
      tournament_registrations(count)
    `)
    .eq('id', id)
    .eq('visibility', 'PUBLIC')
    .maybeSingle()

  if (error || !tournament) {
    notFound()
  }

  const fixtures = (tournament.fixtures || []) as Array<{
    id: string
    match_number: number
    team_a_name: string
    team_b_name: string
    venue: string | null
    scheduled_at: string | null
    result: string | null
    winner: string | null
    notes: string | null
  }>

  const registrationCount = (tournament.tournament_registrations as unknown as { count: number }[])?.[0]?.count ?? 0
  const socialLinks = (tournament.social_links || {}) as Record<string, string>
  const contactInfo = (tournament.contact_info || {}) as Record<string, string>
  const regStatus = tournament.registration_status || 'UPCOMING'

  const completedFixtures = fixtures.filter(f => f.result)
  const upcomingFixtures = fixtures.filter(f => !f.result)

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/discover">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Discover
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tournament Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs">{tournament.type}</Badge>
            <Badge className={`text-xs ${registrationStatusColors[regStatus]}`}>
              Registration {regStatus.toLowerCase()}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-muted-foreground max-w-2xl">{tournament.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
            {tournament.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {tournament.venue}
              </span>
            )}
            {tournament.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(tournament.start_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {tournament.end_date && (
                  <> - {new Date(tournament.end_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}</>
                )}
              </span>
            )}
            {tournament.format && (
              <span className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {tournament.format}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {registrationCount} teams registered
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Fixtures */}
            {upcomingFixtures.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming Fixtures</h2>
                <FixtureList fixtures={upcomingFixtures} />
              </div>
            )}

            {/* Completed Fixtures */}
            {completedFixtures.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Completed Matches</h2>
                <FixtureList fixtures={completedFixtures} />
              </div>
            )}

            {/* No fixtures */}
            {fixtures.length === 0 && (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-8 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Fixtures Coming Soon</h3>
                  <p className="text-muted-foreground">
                    The tournament schedule will be announced soon.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Rules */}
            {tournament.rules_text && (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Rules & Format
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">
                    {tournament.rules_text}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration */}
            <RegistrationForm
              leagueId={tournament.id}
              isAuthenticated={!!user}
              registrationOpen={regStatus === 'OPEN'}
            />

            {/* Contact & Links */}
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader>
                <CardTitle className="text-base">Contact & Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(contactInfo).map(([key, value]) => (
                  value && (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground capitalize">{key}: </span>
                      <span className="text-foreground">{value}</span>
                    </div>
                  )
                ))}
                {Object.entries(socialLinks).map(([platform, url]) => (
                  url && (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors capitalize"
                    >
                      <Globe className="h-4 w-4" />
                      {platform}
                    </a>
                  )
                ))}
                {tournament.registration_url && (
                  <a
                    href={tournament.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    External Registration
                  </a>
                )}
                {Object.keys(contactInfo).length === 0 &&
                  Object.keys(socialLinks).length === 0 &&
                  !tournament.registration_url && (
                  <p className="text-sm text-muted-foreground">No contact information available.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="secondary">{tournament.type}</Badge>
                </div>
                {tournament.max_teams && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Teams</span>
                    <span className="text-foreground">{tournament.max_teams}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered</span>
                  <span className="text-foreground">{registrationCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixtures</span>
                  <span className="text-foreground">{fixtures.length}</span>
                </div>
                {tournament.season && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Season</span>
                    <span className="text-foreground">{tournament.season}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
