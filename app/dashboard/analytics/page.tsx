'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useDB, teamsOf } from '@/lib/basketball/store'
import { playerAnalytics, teamAnalytics, lineups, seasonsOf } from '@/lib/basketball/analytics'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export default function AnalyticsPage() {
  const db = useDB()
  const seasons = useMemo(() => seasonsOf(db.sessions), [db.sessions])
  const teams = useMemo(() => teamsOf(db.roster), [db.roster])
  const [season, setSeason] = useState('All')
  const [team, setTeam] = useState(teams[0] ?? 'My Team')

  const sessions = useMemo(
    () => (season === 'All' ? db.sessions : db.sessions.filter((s) => s.date.slice(0, 4) === season)),
    [db.sessions, season]
  )

  const players = useMemo(
    () =>
      db.roster
        .filter((p) => p.team === team)
        .map((p) => playerAnalytics(sessions, p))
        .filter((a) => a.games > 0)
        .sort((a, b) => b.totals.points - a.totals.points),
    [db.roster, sessions, team]
  )
  const teamStats = useMemo(() => teamAnalytics(sessions, team, db.roster), [sessions, team, db.roster])
  const lineupRows = useMemo(() => lineups(sessions, db.roster, team).slice(0, 8), [sessions, db.roster, team])

  if (db.sessions.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-[900px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Advanced Analytics</h1>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center mt-6">
          <p className="text-foreground font-semibold mb-1">No games recorded yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Analytics are computed from real recorded sessions. Record a game to unlock shot quality,
            expected assists, defensive impact, tendencies and lineup analysis.
          </p>
          <Link href="/dashboard/live-ai" className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">
            Track a game
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Advanced Analytics</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Every metric is computed from your real recorded events. Estimates derived from tracked plays
        are marked “est.”
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Team</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
            {teams.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Season</label>
          <select value={season} onChange={(e) => setSeason(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
            <option>All</option>
            {seasons.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Team tendencies */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Team Tendencies — {team}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          {[
            ['Games', teamStats.games],
            ['PPG', teamStats.ppg.toFixed(1)],
            ['Opp PPG', teamStats.oppPpg.toFixed(1)],
            ['Net /G', (teamStats.netPerGame >= 0 ? '+' : '') + teamStats.netPerGame.toFixed(1)],
            ['eFG%', pct(teamStats.efg)],
            ['Pace (est.)', teamStats.paceEst.toFixed(1)],
          ].map(([l, v]) => (
            <div key={l} className="bg-background border border-border rounded-lg p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
              <p className="text-xl font-bold text-foreground tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-1.5">Points by source</p>
        {(() => {
          const pf = teamStats.pointsFrom
          const total = Math.max(pf.paint + pf.mid + pf.three + pf.ft, 1)
          const seg = [
            ['Paint', pf.paint, 'bg-orange-500'],
            ['Mid', pf.mid, 'bg-yellow-500'],
            ['Three', pf.three, 'bg-blue-500'],
            ['FT', pf.ft, 'bg-green-500'],
          ] as const
          return (
            <>
              <div className="flex h-4 rounded-full overflow-hidden">
                {seg.map(([l, v, c]) => (
                  <div key={l} className={c} style={{ width: `${(v / total) * 100}%` }} title={`${l}: ${v}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                {seg.map(([l, v, c]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${c}`} />{l} {v}</span>
                ))}
              </div>
            </>
          )
        })()}
      </div>

      {/* Player advanced table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Player Advanced Metrics</h2>
        </div>
        {players.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No recorded stats for {team} in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Player', 'G', 'PTS/G', 'eFG%', 'TS%', 'PPSA', '3PA rate', 'AST/TO', 'Creation (est.)', 'Def activity/G', 'Stocks/G', 'Hustle/G', 'Max spd'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wide font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((a) => (
                  <tr key={a.player.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                      <Link href={`/dashboard/players/profile?id=${a.player.id}`} className="hover:text-orange-500">#{a.player.number} {a.player.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.games}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold">{(a.totals.points / a.games).toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{pct(a.efg)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{pct(a.ts)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.ppsa.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{pct(a.threeRate)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.astToTov.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.creationEst.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.defActivity.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.stocks.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.hustle.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{a.maxSpeedKmh > 0 ? `${a.maxSpeedKmh.toFixed(1)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shot tendencies per player */}
      {players.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Shot Tendencies (share of attempts)</h2>
          <div className="space-y-2.5">
            {players.map((a) => (
              <div key={a.player.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm text-foreground truncate">#{a.player.number} {a.player.name}</span>
                <div className="flex h-4 rounded-full overflow-hidden flex-1">
                  <div className="bg-orange-500" style={{ width: `${a.paintShare * 100}%` }} title={`Paint ${pct(a.paintShare)}`} />
                  <div className="bg-yellow-500" style={{ width: `${a.midShare * 100}%` }} title={`Mid ${pct(a.midShare)}`} />
                  <div className="bg-blue-500" style={{ width: `${a.threeShare * 100}%` }} title={`Three ${pct(a.threeShare)}`} />
                </div>
                <span className="w-28 shrink-0 text-xs text-muted-foreground text-right tabular-nums">
                  {(a.paintShare * 100).toFixed(0)}/{(a.midShare * 100).toFixed(0)}/{(a.threeShare * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Paint</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />Mid-range</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Three</span>
          </div>
        </div>
      )}

      {/* Lineup analytics */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Lineup Analytics</h2>
          <p className="text-xs text-muted-foreground">Players who appeared together per game, ranked by that game&apos;s net result.</p>
        </div>
        {lineupRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No lineup data yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {lineupRows.map((r) => (
              <div key={r.sessionId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`px-2 py-0.5 rounded font-semibold text-xs shrink-0 ${r.net > 0 ? 'bg-green-500/10 text-green-500' : r.net < 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                  {r.net > 0 ? '+' : ''}{r.net}
                </span>
                <span className="text-sm text-muted-foreground w-24 shrink-0">{r.date}</span>
                <span className="text-sm text-foreground flex-1 min-w-[160px] truncate">
                  {r.players.map((p) => `#${p.number}`).join(' · ')} <span className="text-muted-foreground">vs {r.opponent}</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">{r.teamScore}–{r.oppScore}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
