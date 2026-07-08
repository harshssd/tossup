'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StandingsTable } from '@/components/platform/StandingsTable'
import { Pavilion } from '@/components/platform/Pavilion'
import { PlatformShell } from '@/components/platform/PlatformShell'
import {
  approveRegistration,
  concludeTournament,
  getHostTournament,
  getRegistrations,
  getTournamentAdminState,
  hostAddTeam,
  hostCreateFixture,
  hostSaveFixtureResult,
  rejectRegistration,
} from '@/lib/platform/tournament-host'
import {
  type Fixture,
  type League,
  type Registration,
  type Standing,
  type TournamentTeam,
} from '@/lib/platform/queries'

const inputCls = 'h-9'
const selCls = 'h-9 rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]'

export default function ManageTournamentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<TournamentTeam[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  // Admin gate: only the tournament's owner/admins may manage it.
  const [access, setAccess] = useState<'checking' | 'guest' | 'denied' | 'ok'>('checking')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getTournamentAdminState(id)
      .then(({ signedIn, isAdmin }) => {
        if (cancelled) return
        setAccess(!signedIn ? 'guest' : isAdmin ? 'ok' : 'denied')
      })
      .catch(() => {
        // Fail closed: a failed admin check must not unlock management.
        if (!cancelled) setAccess('denied')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const load = useCallback(async () => {
    if (!id) return
    const [t, regs] = await Promise.all([getHostTournament(id), getRegistrations(id).catch(() => [])])
    setLeague(t.league)
    setTeams(t.teams)
    setFixtures(t.fixtures)
    setStandings(t.standings)
    setRegistrations(regs)
    setLoading(false)
  }, [id])

  async function onApprove(regId: string) {
    try {
      await approveRegistration(regId)
      toast.success('Registration approved')
      load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function onReject(regId: string) {
    try {
      await rejectRegistration(regId)
      toast.success('Registration rejected')
      load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  useEffect(() => {
    if (access === 'ok') load()
  }, [load, access])

  async function onAddTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name') || '').trim()
    if (!name) return
    try {
      await hostAddTeam({
        league_id: id,
        name,
        captain_name: String(f.get('captain') || '').trim() || null,
        contact_phone: String(f.get('contact') || '').trim() || null,
      })
      e.currentTarget.reset()
      toast.success('Team added')
      load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function onAddFixture(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const aId = String(f.get('team_a') || '')
    const bId = String(f.get('team_b') || '')
    if (!aId || !bId || aId === bId) {
      toast.error('Pick two different teams')
      return
    }
    try {
      await hostCreateFixture({
        league_id: id,
        team_a_id: aId,
        team_b_id: bId,
        team_a_name: teams.find((t) => t.id === aId)?.name ?? null,
        team_b_name: teams.find((t) => t.id === bId)?.name ?? null,
        match_number: f.get('match_number') ? Number(f.get('match_number')) : null,
        venue: String(f.get('venue') || '').trim() || null,
        scheduled_at: f.get('scheduled_at') ? new Date(String(f.get('scheduled_at'))).toISOString() : null,
      })
      e.currentTarget.reset()
      toast.success('Fixture added')
      load()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (access === 'checking') return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Checking access…</div>
  if (access === 'guest') {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Sign in to manage</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">Only the tournament&apos;s hosts can manage it.</p>
          <Button
            className="mt-5"
            onClick={() => router.push(`/account/sign-in?redirect=/tournaments/${id}/manage`)}
          >
            Sign in
          </Button>
        </div>
      </PlatformShell>
    )
  }
  if (access === 'denied') {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Not a host</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">You don&apos;t have permission to manage this tournament.</p>
          <Link href={`/tournaments/${id}`} className="mt-5 inline-block">
            <Button variant="outline">View tournament</Button>
          </Link>
        </div>
      </PlatformShell>
    )
  }
  if (loading) return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
  if (!league) return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Not found.</div>

  return (
    <PlatformShell>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/tournaments/${id}`} className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]">
        ← {league.name}
      </Link>
      <h1 className="cy-display mt-2 text-3xl font-semibold text-[#16150f] sm:text-4xl">Manage tournament</h1>

      {/* Pavilion — host communications */}
      <section className="mt-6">
        <Pavilion key={id} leagueId={id} mode="host" />
      </section>

      {/* Registrations */}
      {(() => {
        const pending = registrations.filter((r) => r.status === 'PENDING')
        if (registrations.length === 0) return null
        return (
          <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
            <h2 className="cy-display text-xl font-semibold text-[#16150f]">
              Registrations <span className="text-[#9a978d]">({pending.length} pending)</span>
            </h2>
            <div className="mt-3 space-y-2">
              {registrations.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#16150f]">{r.team_name}</p>
                    <p className="text-xs text-[#9a978d]">
                      {[r.contact_name, r.contact_phone, r.contact_email].filter(Boolean).join(' · ') || 'No contact info'}
                    </p>
                  </div>
                  {r.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]" onClick={() => onApprove(r.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onReject(r.id)}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        r.status === 'APPROVED' ? 'bg-[#dff3e4] text-[#0f5a30]' : 'bg-[#f7dcdc] text-[#8a2a2a]'
                      }`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Teams */}
      <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
        <h2 className="cy-display text-xl font-semibold text-[#16150f]">
          Teams <span className="text-[#9a978d]">({teams.length})</span>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {teams.length === 0 && <span className="text-sm text-[#9a978d]">No teams yet — add some below.</span>}
          {teams.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-[#e7e4db] bg-[#f6f5f1] px-3 py-1 text-xs font-semibold text-[#16150f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d57]" /> {t.name}
            </span>
          ))}
        </div>
        <form onSubmit={onAddTeam} className="mt-4 flex flex-wrap gap-2">
          <Input name="name" placeholder="Team name" className={`${inputCls} w-40`} />
          <Input name="captain" placeholder="Captain" className={`${inputCls} w-32`} />
          <Input name="contact" placeholder="Contact" className={`${inputCls} w-32`} />
          <Button type="submit" size="sm" className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">Add team</Button>
        </form>
      </section>

      {/* Fixtures */}
      <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
        <h2 className="cy-display text-xl font-semibold text-[#16150f]">Fixtures</h2>
        <form onSubmit={onAddFixture} className="mt-3 flex flex-wrap items-center gap-2">
          <select name="team_a" className={selCls} required defaultValue="">
            <option value="" disabled>Team A</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="text-xs font-bold uppercase text-[#9a978d]">vs</span>
          <select name="team_b" className={selCls} required defaultValue="">
            <option value="" disabled>Team B</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Input name="match_number" type="number" placeholder="#" className={`${inputCls} w-16`} />
          <Input name="venue" placeholder="Venue" className={`${inputCls} w-28`} />
          <Input name="scheduled_at" type="datetime-local" className={`${inputCls} w-44`} />
          <Button type="submit" size="sm" disabled={teams.length < 2} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">Add fixture</Button>
        </form>

        <div className="mt-4 space-y-2.5">
          {fixtures.length === 0 && <p className="text-sm text-[#9a978d]">No fixtures yet.</p>}
          {fixtures.map((fx) => (
            <div key={fx.id} className="rounded-xl border border-[#e7e4db] bg-[#eef0ea] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5 text-sm font-bold text-[#16150f]">
                  {fx.team_a_name}
                  <span className="cy-vs" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.5rem' }}>VS</span>
                  {fx.team_b_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#e7e4db] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6f6c63]">{fx.status}</span>
                  <Button size="sm" variant="ghost" className="text-[#0f5a30] hover:text-[#16150f]" onClick={() => setEditing(editing === fx.id ? null : fx.id)}>
                    {fx.status === 'COMPLETED' ? 'Edit' : 'Enter result'}
                  </Button>
                </div>
              </div>
              {fx.result_note && <p className="mt-1.5 text-xs font-semibold text-[#0f5a30]">{fx.result_note}</p>}
              {editing === fx.id && (
                <ResultForm fixture={fx} onSaved={() => { setEditing(null); load() }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Standings */}
      <section className="mt-6">
        <h2 className="cy-display text-xl font-semibold text-[#16150f]">
          Standings <span className="text-[#9a978d]">(auto)</span>
        </h2>
        <div className="mt-3">
          <StandingsTable rows={standings} />
        </div>
      </section>

      {/* Conclude → verified honors */}
      <ConcludeSection league={league} teams={teams} standings={standings} onDone={load} />
    </div>
    </PlatformShell>
  )
}

function ConcludeSection({
  league, teams, standings, onDone,
}: {
  league: League; teams: TournamentTeam[]; standings: Standing[]; onDone: () => void
}) {
  // Default the champion to the standings leader (first row of the auto table).
  const leaderId = standings.find((s) => s.team_id)?.team_id ?? ''
  const [champion, setChampion] = useState<string>(league.champion_team_id ?? leaderId)
  const [runnerUp, setRunnerUp] = useState<string>(league.runner_up_team_id ?? '')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const teamName = (tid: string | null) => teams.find((t) => t.id === tid)?.name ?? '—'

  async function save() {
    if (!champion) {
      toast.error('Pick a champion')
      return
    }
    if (runnerUp && runnerUp === champion) {
      toast.error('Runner-up must differ from the champion')
      return
    }
    setSaving(true)
    try {
      await concludeTournament(league.id, champion, runnerUp || null)
      toast.success('Tournament concluded — verified honors updated')
      setOpen(false)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
      <h2 className="cy-display text-xl font-semibold text-[#16150f]">Conclude tournament</h2>
      {league.concluded_at ? (
        <div className="mt-2 rounded-xl border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2 text-sm text-[#3a382f]">
          <p>
            <span className="font-semibold text-[#0f5a30]">Champions:</span> {teamName(league.champion_team_id)}
            {league.runner_up_team_id && (
              <>
                {' · '}
                <span className="text-[#9a978d]">Runners-up:</span> {teamName(league.runner_up_team_id)}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-[#9a978d]">
            Verified honors were written to the winning clubs&apos; cabinets (clubs that registered on TossUp).
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-[#6f6c63]">
          Name the winners. TossUp writes a verified trophy into each winning club&apos;s cabinet.
        </p>
      )}

      {teams.length === 0 ? (
        <p className="mt-3 text-sm text-[#9a978d]">Add teams first.</p>
      ) : !open ? (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          {league.concluded_at ? 'Change result' : 'Conclude tournament'}
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#9a978d]">
            Champion
            <select value={champion} onChange={(e) => setChampion(e.target.value)} className={selCls}>
              <option value="" disabled>Pick champion</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#9a978d]">
            Runner-up (optional)
            <select value={runnerUp} onChange={(e) => setRunnerUp(e.target.value)} className={selCls}>
              <option value="">None</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <Button size="sm" onClick={save} disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
            {saving ? 'Saving…' : 'Save result'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      )}
    </section>
  )
}

function ResultForm({ fixture, onSaved }: { fixture: Fixture; onSaved: () => void }) {
  const [aR, setAR] = useState(fixture.team_a_runs ?? 0)
  const [aW, setAW] = useState(fixture.team_a_wickets ?? 0)
  const [aO, setAO] = useState(fixture.team_a_overs ?? 0)
  const [bR, setBR] = useState(fixture.team_b_runs ?? 0)
  const [bW, setBW] = useState(fixture.team_b_wickets ?? 0)
  const [bO, setBO] = useState(fixture.team_b_overs ?? 0)
  const [resultType, setResultType] = useState(fixture.result_type ?? 'WIN')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (resultType === 'WIN' && aR === bR) {
      toast.error('Scores are level — pick "Tie", or set a winning score.')
      return
    }
    setSaving(true)
    let winner_team_id: string | null = null
    let note = ''
    if (resultType === 'WIN') {
      winner_team_id = aR > bR ? fixture.team_a_id : fixture.team_b_id
      const winName = aR > bR ? fixture.team_a_name : fixture.team_b_name
      const margin = Math.abs(aR - bR)
      note = `${winName} won by ${margin} run${margin === 1 ? '' : 's'}`
    } else if (resultType === 'TIE') {
      note = 'Match tied'
    } else if (resultType === 'NO_RESULT') {
      note = 'No result'
    } else {
      note = 'Abandoned'
    }
    try {
      await hostSaveFixtureResult(fixture.id, {
        team_a_runs: aR, team_a_wickets: aW, team_a_overs: aO,
        team_b_runs: bR, team_b_wickets: bW, team_b_overs: bO,
        result_type: resultType,
        winner_team_id,
        result_note: note,
        status: resultType === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED',
      })
      toast.success('Result saved')
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  const cell = 'h-8 w-16 rounded border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm'
  return (
    <div className="mt-3 space-y-2 rounded-md border border-[#e7e4db] p-3">
      <ScoreRow label={fixture.team_a_name ?? 'Team A'} r={aR} w={aW} o={aO} setR={setAR} setW={setAW} setO={setAO} cls={cell} />
      <ScoreRow label={fixture.team_b_name ?? 'Team B'} r={bR} w={bW} o={bO} setR={setBR} setW={setBW} setO={setBO} cls={cell} />
      <div className="flex items-center gap-2">
        <select value={resultType} onChange={(e) => setResultType(e.target.value)} className="h-8 rounded border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm">
          <option value="WIN">Win/Loss</option>
          <option value="TIE">Tie</option>
          <option value="NO_RESULT">No result</option>
          <option value="ABANDONED">Abandoned</option>
        </select>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save result'}</Button>
      </div>
    </div>
  )
}

function ScoreRow({
  label, r, w, o, setR, setW, setO, cls,
}: {
  label: string; r: number; w: number; o: number
  setR: (n: number) => void; setW: (n: number) => void; setO: (n: number) => void; cls: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 truncate text-sm">{label}</span>
      <input type="number" value={r} onChange={(e) => setR(Number(e.target.value))} className={cls} placeholder="Runs" />
      <input type="number" value={w} onChange={(e) => setW(Number(e.target.value))} className={cls} placeholder="Wkts" />
      <input type="number" step="0.1" value={o} onChange={(e) => setO(Number(e.target.value))} className={cls} placeholder="Overs" />
    </div>
  )
}
