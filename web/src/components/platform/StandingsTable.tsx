import type { Standing } from '@/lib/platform/queries'

export function sortStandings(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) =>
      (b.points ?? 0) - (a.points ?? 0) ||
      (b.won ?? 0) - (a.won ?? 0) ||
      ((b.runs_for ?? 0) - (b.runs_against ?? 0)) - ((a.runs_for ?? 0) - (a.runs_against ?? 0))
  )
}

export function StandingsTable({ rows }: { rows: Standing[] }) {
  const sorted = sortStandings(rows)
  if (sorted.length === 0) {
    return <p className="text-sm text-[#8a877d]">No teams yet.</p>
  }
  return (
    <div className="cy-score overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8a877d]">
            <th className="px-3 py-2.5 text-left font-bold">#</th>
            <th className="px-3 py-2.5 text-left font-bold">Team</th>
            <th className="px-2 py-2.5 text-center font-bold">P</th>
            <th className="px-2 py-2.5 text-center font-bold">W</th>
            <th className="px-2 py-2.5 text-center font-bold">L</th>
            <th className="px-2 py-2.5 text-center font-bold">T</th>
            <th className="px-2 py-2.5 text-center font-bold">NR</th>
            <th className="px-3 py-2.5 text-center font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.team_id} className="border-t border-[#ece9e1]">
              <td className="px-3 py-3">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-black"
                  style={
                    i === 0
                      ? { color: '#1a1407', background: '#f4c430' }
                      : { color: '#9a978d' }
                  }
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-3 font-bold text-[#16150f]">{r.name}</td>
              <td className="px-2 py-3 text-center text-[#8a877d]">{r.played}</td>
              <td className="px-2 py-3 text-center text-[#16150f]">{r.won}</td>
              <td className="px-2 py-3 text-center text-[#6f6c63]">{r.lost}</td>
              <td className="px-2 py-3 text-center text-[#6f6c63]">{r.tied}</td>
              <td className="px-2 py-3 text-center text-[#6f6c63]">{r.no_result}</td>
              <td className="cy-digit px-3 py-3 text-center text-base font-black">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
