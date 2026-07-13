'use client'

import Link from 'next/link'
import { StatCard } from '@/components/basketball/stat-card'
import { useDB, statLine, playerSeason } from '@/lib/basketball/store'

export default function DashboardPage() {
  const db = useDB()
  const sessions = [...db.sessions].sort((a, b) => (a.date < b.date ? 1 : -1))
  const wins = sessions.filter((s) => s.teamScore > s.oppScore).length
  const losses = sessions.filter((s) => s.teamScore < s.oppScore).length
  const g = Math.max(sessions.length, 1)
  const allEvents = sessions.flatMap((s) => s.events)
  const team = statLine(allEvents)
  const totalDistance = sessions.reduce(
    (a, s) => a + Object.values(s.movement).reduce((x, m) => x + m.distanceM, 0),
    0
  )

  const leaders = db.roster
    .map((p) => ({ p, s: playerSeason(db.sessions, p.id) }))
    .filter((x) => x.s.played > 0)
    .sort((a, b) => b.s.totals.points - a.s.totals.points)
    .slice(0, 5)

  const empty = sessions.length === 0

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">{db.settings.teamName}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {empty
          ? 'Real stats only — everything below fills in as you record games.'
          : `${sessions.length} recorded games · all stats measured, nothing simulated`}
      </p>

      {empty ? (
        <div className="bg-card border border-border rounded-xl p-8 md:p-12 text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M4.93 4.93c4.08 4.08 10.06 4.08 14.14 0M4.93 19.07c4.08-4.08 10.06-4.08 14.14 0M12 2v20" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Start tracking real basketball</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Build your roster, then record a game courtside or break down film with AI-assisted video
            analysis. Every number on this platform comes from what you actually track.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/dashboard/players"
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">
              1 · Add roster
            </Link>
            <Link href="/dashboard/live"
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50">
              2 · Record live game
            </Link>
            <Link href="/dashboard/video"
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50">
              3 · Analyze video with AI
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard label="Record" value={`${wins}–${losses}`} size="sm" />
            <StatCard label="PPG" value={(sessions.reduce((a, s) => a + s.teamScore, 0) / g).toFixed(1)} size="sm" />
            <StatCard label="Opp PPG" value={(sessions.reduce((a, s) => a + s.oppScore, 0) / g).toFixed(1)} size="sm" />
            <StatCard label="Deflections" value={team.defl} subValue={`${(team.defl / g).toFixed(1)} per game`} size="sm" />
            <StatCard label="Hockey Assists" value={team.hast} subValue={`${(team.hast / g).toFixed(1)} per game`} size="sm" />
            <StatCard label="Distance Tracked" value={totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : '—'} size="sm" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2 mb-8">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Recent Games</h2>
                <Link href="/dashboard/games" className="text-xs text-orange-500 hover:underline">All games →</Link>
              </div>
              {sessions.slice(0, 5).map((s) => {
                const r = s.teamScore > s.oppScore ? 'W' : s.teamScore < s.oppScore ? 'L' : '—'
                return (
                  <Link key={s.id} href={`/dashboard/games/view?id=${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      r === 'W' ? 'bg-green-500/10 text-green-500' : r === 'L' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
                    }`}>{r}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.location === 'away' ? '@' : 'vs'} {s.opponent}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.date}</p>
                    </div>
                    <span className="font-bold tabular-nums text-foreground">{s.teamScore}–{s.oppScore}</span>
                  </Link>
                )
              })}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Scoring Leaders</h2>
                <Link href="/dashboard/players" className="text-xs text-orange-500 hover:underline">All players →</Link>
              </div>
              {leaders.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">No player stats yet.</p>
              ) : (
                leaders.map(({ p, s }) => (
                  <Link key={p.id} href={`/dashboard/players/profile?id=${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {p.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.played} games · {s.totals.defl} defl · {s.totals.hast} hcky ast
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-foreground">
                      {(s.totals.points / Math.max(s.played, 1)).toFixed(1)} <span className="text-xs text-muted-foreground font-normal">ppg</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/live" className="bg-card border border-border rounded-xl p-5 hover:border-orange-500 transition-colors">
          <p className="font-semibold text-foreground mb-1">🔴 Live Recorder</p>
          <p className="text-xs text-muted-foreground">Tag stats courtside as the game happens — score builds itself.</p>
        </Link>
        <Link href="/dashboard/live-ai" className="bg-card border border-border rounded-xl p-5 hover:border-orange-500 transition-colors">
          <p className="font-semibold text-foreground mb-1">🧠 Live AI Tracker</p>
          <p className="text-xs text-muted-foreground">On-device AI detects players and the ball live, auto-tracks movement.</p>
        </Link>
        <Link href="/dashboard/video" className="bg-card border border-border rounded-xl p-5 hover:border-orange-500 transition-colors">
          <p className="font-semibold text-foreground mb-1">🎥 Video Analysis</p>
          <p className="text-xs text-muted-foreground">Upload film. AI proposes events from the clip; you confirm.</p>
        </Link>
        <Link href="/dashboard/pro" className="bg-card border border-border rounded-xl p-5 hover:border-orange-500 transition-colors">
          <p className="font-semibold text-foreground mb-1">🌍 Pro Leagues</p>
          <p className="text-xs text-muted-foreground">Live results from 13 world leagues + pro player scouting search.</p>
        </Link>
      </div>
    </div>
  )
}
