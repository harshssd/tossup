import { reputationTier, formatSignals, type ReputationSignals } from '@/lib/platform/reputation-signals'
import { RecomputeReputationButton } from './RecomputeReputationButton'

/** Surfaces the reputation breakdown (v2 signals) for a club or player. Renders
 *  nothing until there's at least one non-zero signal, so brand-new profiles
 *  don't show an empty card. Presentational — safe in a server component. When
 *  `canRecompute` is set (a club admin viewing their own page), it shows an
 *  in-place "recompute now" control so a refresh re-renders THIS card. */
export function ReputationCard({
  score,
  signals,
  canRecompute = false,
}: {
  score: number
  signals: ReputationSignals | null
  canRecompute?: boolean
}) {
  const rows = formatSignals(signals)
  if (rows.length === 0) return null
  const tier = reputationTier(score)

  return (
    <section className="cy-panel mt-6 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="cy-display text-lg font-semibold text-[#16150f]">Reputation</h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${tier.tone}1a`, color: tier.text }}
          >
            {tier.label}
          </span>
        </div>
        {canRecompute && <RecomputeReputationButton />}
      </div>
      <p className="mt-1 text-xs text-[#9a978d]">Built from activity on TossUp — updated nightly.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-[#e7e4db] bg-[#f6f5f1] px-3 py-2">
            <p className="text-lg font-bold text-[#16150f]">{r.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a978d]">{r.label}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
