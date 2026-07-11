import type { Fixture } from '@/lib/platform/queries'
import { ShareButton } from './ShareButton'
import { ShareImageButton } from './ShareImageButton'
import { fixtureCardImagePath, shareCardFilename, formatCricketScore } from '@/lib/platform/share'

const STATUS: Record<string, { label: string; cls: string; live?: boolean }> = {
  LIVE: { label: 'Live', cls: 'bg-[#fdeee4] text-[#c0431a]', live: true },
  COMPLETED: { label: 'Result', cls: 'bg-[#e7f4ec] text-[#0f5a30]' },
  SCHEDULED: { label: 'Upcoming', cls: 'bg-[#fcf3d6] text-[#9a6b09]' },
  ABANDONED: { label: 'Abandoned', cls: 'bg-[#efede6] text-[#6f6c63]' },
}

export function MatchCard({ fixture: fx, index = 0 }: { fixture: Fixture; index?: number }) {
  const st = STATUS[fx.status] ?? STATUS.SCHEDULED
  const aWin = fx.winner_team_id && fx.winner_team_id === fx.team_a_id
  const bWin = fx.winner_team_id && fx.winner_team_id === fx.team_b_id
  const aScore = formatCricketScore(fx.team_a_runs, fx.team_a_wickets, fx.team_a_overs)
  const bScore = formatCricketScore(fx.team_b_runs, fx.team_b_wickets, fx.team_b_overs)

  const shareTitle = `${fx.team_a_name ?? 'TBD'} vs ${fx.team_b_name ?? 'TBD'} — result on TossUp`
  const shareText = [
    `${fx.team_a_name ?? 'TBD'} ${aScore ?? ''} vs ${fx.team_b_name ?? 'TBD'} ${bScore ?? ''}`.replace(/\s+/g, ' ').trim(),
    fx.result_note,
  ]
    .filter(Boolean)
    .join(' — ')

  return (
    <div
      className="cy-card cy-shine cy-panel cy-rise relative overflow-hidden rounded-2xl p-4"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a978d]">
          {fx.round_label || (fx.match_number ? `Match ${fx.match_number}` : 'Match')}
        </span>
        <span className="flex items-center gap-1">
          <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>
            {st.live && <span className="cy-pulse h-1.5 w-1.5 rounded-full bg-[#c0431a]" />}
            {st.label}
          </span>
          {fx.status === 'COMPLETED' && (
            <>
              <ShareImageButton
                variant="icon"
                imagePath={fixtureCardImagePath(fx.id)}
                filename={shareCardFilename(fx.team_a_name, fx.team_b_name)}
                title={shareTitle}
                text={shareText}
              />
              <ShareButton variant="icon" title={shareTitle} text={shareText} path={`/tournaments/${fx.league_id}`} />
            </>
          )}
        </span>
      </div>
      <div className="space-y-2">
        <MatchTeamRow name={fx.team_a_name} sc={aScore} win={!!aWin} />
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-[#ece9e1]" />
          <span className="cy-vs">VS</span>
          <span className="h-px flex-1 bg-[#ece9e1]" />
        </div>
        <MatchTeamRow name={fx.team_b_name} sc={bScore} win={!!bWin} />
      </div>
      {fx.result_note && (
        <p className="mt-3 text-center text-xs font-bold text-[#0f5a30]">{fx.result_note}</p>
      )}
      {fx.venue && <p className="mt-1 text-center text-[11px] text-[#9a978d]">{fx.venue}</p>}
    </div>
  )
}

function MatchTeamRow({ name, sc, win }: { name: string | null; sc: string | null; win: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`flex items-center gap-2 truncate text-sm font-bold ${win ? 'text-[#16150f]' : 'text-[#8a877d]'}`}>
        {win && <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d57]" />}
        {name || '—'}
      </span>
      <span className={`cy-team-score text-base font-extrabold ${win ? 'text-[#1f9d57]' : 'text-[#9a978d]'}`}>
        {sc ?? '—'}
      </span>
    </div>
  )
}
