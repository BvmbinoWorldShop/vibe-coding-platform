'use client'

import Link from 'next/link'
import { StatCard } from '@/components/basketball/stat-card'
import { ShotChart } from '@/components/basketball/court'
import { games, players, teamSeasonStats, restRecords, workouts } from '@/lib/basketball/mock-data'

export default function DashboardOverview() {
  const lastGame = games[0]
  const todayWorkouts = workouts.filter((w) => w.date === '2026-06-28')
  const todayRest = restRecords.filter((r) => r.date === '2026-06-28')
  const avgRecovery = todayRest.length > 0
    ? Math.round(todayRest.reduce((a, r) => a + r.recoveryScore, 0) / todayRest.length)
    : 0

  const topScorer = lastGame.playerStats.reduce((a, b) => (a.points > b.points ? a : b))
  const topRebounder = lastGame.playerStats.reduce((a, b) => (a.totalRebounds > b.totalRebounds ? a : b))
  const topAssists = lastGame.playerStats.reduce((a, b) => (a.assists > b.assists ? a : b))
  const getPlayer = (id: string) => players.find((p) => p.id === id)

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Season overview and recent activity</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Season Active
        </div>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Record" value={`${teamSeasonStats.wins}-${teamSeasonStats.losses}`} subValue=".704 Win %" />
        <StatCard label="PPG" value={teamSeasonStats.pointsPerGame} trend="up" trendValue="2.1" />
        <StatCard label="OPP PPG" value={teamSeasonStats.oppPointsPerGame} trend="down" trendValue="1.3" />
        <StatCard label="FG%" value={`${teamSeasonStats.fgPercentage}%`} trend="up" trendValue="0.8" />
        <StatCard label="3PT%" value={`${teamSeasonStats.threePtPercentage}%`} trend="up" trendValue="1.2" />
        <StatCard label="RPG" value={teamSeasonStats.reboundsPerGame} trend="neutral" trendValue="0.2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Last Game Summary */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Last Game</h2>
            <Link href={`/dashboard/games/${lastGame.id}`} className="text-sm text-blue-500 hover:underline">
              Full Details
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{lastGame.teamScore}</p>
              <p className="text-sm text-muted-foreground mt-1">Our Team</p>
            </div>
            <div className="px-4">
              <span className={`text-lg font-bold px-3 py-1 rounded ${lastGame.result === 'W' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {lastGame.result === 'W' ? 'WIN' : 'LOSS'}
              </span>
              <p className="text-xs text-muted-foreground text-center mt-2">{lastGame.date}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{lastGame.opponentScore}</p>
              <p className="text-sm text-muted-foreground mt-1">{lastGame.opponent}</p>
            </div>
          </div>

          {/* Quarter scores */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {lastGame.quarterScores.map((q) => (
              <div key={q.quarter} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Q{q.quarter}</p>
                <p className="text-sm font-bold text-foreground">{q.teamScore}-{q.opponentScore}</p>
                <p className="text-xs text-muted-foreground">{q.fgPercentage}% FG</p>
              </div>
            ))}
          </div>

          {/* Top performers */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Top Scorer</p>
              <p className="text-sm font-bold text-foreground">{getPlayer(topScorer.playerId)?.firstName} {getPlayer(topScorer.playerId)?.lastName}</p>
              <p className="text-lg font-bold text-foreground">{topScorer.points} PTS</p>
              <p className="text-xs text-muted-foreground">{topScorer.fgMade}/{topScorer.fgAttempted} FG</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Top Rebounder</p>
              <p className="text-sm font-bold text-foreground">{getPlayer(topRebounder.playerId)?.firstName} {getPlayer(topRebounder.playerId)?.lastName}</p>
              <p className="text-lg font-bold text-foreground">{topRebounder.totalRebounds} REB</p>
              <p className="text-xs text-muted-foreground">{topRebounder.offRebounds} OFF / {topRebounder.defRebounds} DEF</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Top Assists</p>
              <p className="text-sm font-bold text-foreground">{getPlayer(topAssists.playerId)?.firstName} {getPlayer(topAssists.playerId)?.lastName}</p>
              <p className="text-lg font-bold text-foreground">{topAssists.assists} AST</p>
              <p className="text-xs text-muted-foreground">{topAssists.hockeyAssists} Hockey AST</p>
            </div>
          </div>
        </div>

        {/* Shot Chart Preview */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Shot Chart</h2>
            <Link href={`/dashboard/games/${lastGame.id}`} className="text-sm text-blue-500 hover:underline">
              View Full
            </Link>
          </div>
          <div className="flex justify-center">
            <ShotChart shots={lastGame.shots} width={350} height={330} />
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-full bg-green-500" /> Made
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Missed
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Team Recovery Status */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Team Recovery Status</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center">
              <span className="text-xl font-bold text-foreground">{avgRecovery}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Avg Recovery Score</p>
              <p className="text-xs text-muted-foreground">{todayRest.length} players reported today</p>
            </div>
          </div>
          <div className="space-y-3">
            {todayRest.map((r) => {
              const pl = getPlayer(r.playerId)
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {pl?.number}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{pl?.firstName} {pl?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{r.sleepHours}h sleep</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.soreness === 'none' ? 'bg-green-500/10 text-green-500' :
                      r.soreness === 'mild' ? 'bg-yellow-500/10 text-yellow-500' :
                      r.soreness === 'moderate' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {r.soreness}
                    </span>
                    <span className="text-sm font-bold text-foreground w-8 text-right">{r.recoveryScore}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Workouts */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Today&apos;s Workouts</h2>
          <div className="space-y-3">
            {todayWorkouts.map((w) => {
              const pl = getPlayer(w.playerId)
              return (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${w.completed ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{pl?.firstName} {pl?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{w.type} - {w.duration} min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      w.intensity === 'high' ? 'bg-red-500/10 text-red-500' :
                      w.intensity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-green-500/10 text-green-500'
                    }`}>
                      {w.intensity}
                    </span>
                    <span className={`text-xs font-medium ${w.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {w.completed ? 'Done' : 'Pending'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Roster Quick View */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Roster</h2>
          <Link href="/dashboard/players" className="text-sm text-blue-500 hover:underline">
            Manage Players
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {players.slice(0, 10).map((p) => (
            <Link key={p.id} href={`/dashboard/players/${p.id}`} className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {p.number}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.firstName} {p.lastName.charAt(0)}.</p>
                  <p className="text-xs text-muted-foreground">{p.position} | {p.height}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  p.status === 'injured' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
