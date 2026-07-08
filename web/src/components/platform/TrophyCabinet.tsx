import Link from 'next/link'
import { Trophy, BadgeCheck } from 'lucide-react'
import type { HonorView } from '@/lib/platform/honors'

// Result → medal styling. Champion gold matches the recognition gold (#f4c430).
const RESULT_META: Record<string, { label: string; dot: string; ring: string }> = {
  CHAMPION: { label: 'Champions', dot: '#f4c430', ring: '#f8e6a6' },
  RUNNER_UP: { label: 'Runners-up', dot: '#c0c5cc', ring: '#e2e5ea' },
  THIRD: { label: 'Third place', dot: '#cd7f32', ring: '#e8cdb0' },
  SPECIAL: { label: 'Honour', dot: '#1f9d57', ring: '#bfe3cc' },
}

function meta(result: string) {
  return RESULT_META[result] ?? RESULT_META.SPECIAL
}

/** Read-only trophy cabinet: honors newest-year first, champions highlighted,
 *  captain + squad shown as links to their player profiles. Renders nothing
 *  when the club has no honors (caller decides whether to show an empty state). */
export function TrophyCabinet({ honors }: { honors: HonorView[] }) {
  if (honors.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="cy-display flex items-center gap-2 text-lg font-semibold text-[#16150f]">
        <Trophy className="h-5 w-5 text-[#c99a1e]" /> Honours
        <span className="text-[#9a978d]">({honors.length})</span>
      </h2>
      <div className="mt-3 space-y-2.5">
        {honors.map((h) => {
          const m = meta(h.result)
          return (
            <div
              key={h.id}
              className="cy-panel overflow-hidden rounded-2xl border border-[#e7e4db] bg-white"
              style={{ borderLeft: `4px solid ${m.dot}` }}
            >
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: m.ring, color: '#5b4a12' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.dot }} /> {m.label}
                  </span>
                  {(h.year || h.season_label) && (
                    <span className="text-xs font-semibold text-[#6f6c63]">{h.season_label || h.year}</span>
                  )}
                  {h.source === 'TOSSUP_VERIFIED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f5a30]">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>

                <p className="mt-2 text-base font-semibold text-[#16150f]">{h.title}</p>
                {h.notes && <p className="mt-1 text-sm leading-relaxed text-[#6f6c63]">{h.notes}</p>}

                {h.captainName && (
                  <p className="mt-2 text-sm text-[#3a382f]">
                    <span className="text-[#9a978d]">Captain:</span>{' '}
                    {h.captain_person_id ? (
                      <Link href={`/player/${h.captain_person_id}`} className="font-semibold text-[#2257b3] hover:underline">
                        {h.captainName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{h.captainName}</span>
                    )}
                  </p>
                )}

                {h.squad.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {h.squad.map((s) => (
                      <Link
                        key={s.personId}
                        href={`/player/${s.personId}`}
                        className="rounded-full border border-[#e7e4db] bg-[#f6f5f1] px-2.5 py-0.5 text-xs font-medium text-[#3a382f] transition-colors hover:border-[#1f9d57] hover:text-[#0f5a30]"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
