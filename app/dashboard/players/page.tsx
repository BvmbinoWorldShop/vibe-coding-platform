'use client'

import Link from 'next/link'
import { players, games, restRecords, workouts } from '@/lib/basketball/mock-data'

export default function PlayersPage() {
  const getLatestRest = (playerId: string) => restRecords.find((r) => r.playerId === playerId)
  const getUpcomingWorkouts = (playerId: string) => workouts.filter((w) => w.playerId === playerId && !w.completed).length

  const getPlayerAvgStats = (playerId: string) => {
    let totalPts = 0, totalReb = 0, totalAst = 0, totalMin = 0, gp = 0
    for (const game of games) {
      const stat = game.playerStats.find((s) => s.playerId === playerId)
      if (stat && stat.minutes > 0) {
        totalPts += stat.points
        totalReb += stat.totalRebounds
        totalAst += stat.assists
        totalMin += stat.minutes
        gp++
      }
    }
    if (gp === 0) return { ppg: 0, rpg: 0, apg: 0, mpg: 0, gp: 0 }
    return {
      ppg: (totalPts / gp).toFixed(1),
      rpg: (totalReb / gp).toFixed(1),
      apg: (totalAst / gp).toFixed(1),
      mpg: (totalMin / gp).toFixed(1),
      gp,
    }
  }

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Players & CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Player profiles, workouts, nutrition, and recovery tracking</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-500">
            {players.filter((p) => p.status === 'active').length} Active
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500">
            {players.filter((p) => p.status === 'injured').length} Injured
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500">
            {players.filter((p) => p.status === 'rest').length} Rest
          </span>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {players.map((player) => {
          const avg = getPlayerAvgStats(player.id)
          const rest = getLatestRest(player.id)
          const pendingWorkouts = getUpcomingWorkouts(player.id)

          return (
            <Link
              key={player.id}
              href={`/dashboard/players/${player.id}`}
              className="bg-card border border-border rounded-xl p-6 hover:border-ring transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {player.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{player.firstName} {player.lastName}</h3>
                      <p className="text-sm text-muted-foreground">{player.position} | {player.height} | {player.weight} lbs</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
                      player.status === 'active' ? 'bg-green-500/10 text-green-500' :
                      player.status === 'injured' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {player.status}
                    </span>
                  </div>

                  {/* Season Averages */}
                  <div className="flex gap-4 mt-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{avg.ppg}</p>
                      <p className="text-xs text-muted-foreground">PPG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{avg.rpg}</p>
                      <p className="text-xs text-muted-foreground">RPG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{avg.apg}</p>
                      <p className="text-xs text-muted-foreground">APG</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{avg.mpg}</p>
                      <p className="text-xs text-muted-foreground">MPG</p>
                    </div>
                  </div>

                  {/* CRM Quick Status */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    {rest && (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          rest.recoveryScore >= 85 ? 'bg-green-500' :
                          rest.recoveryScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-muted-foreground">Recovery: {rest.recoveryScore}</span>
                      </div>
                    )}
                    {pendingWorkouts > 0 && (
                      <span className="text-xs text-muted-foreground">{pendingWorkouts} workouts pending</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Stride: {player.strideLength}m</span>
                    </div>
                  </div>

                  {/* Physical Measurements */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">WS: {player.wingspan}</span>
                    <span className="text-xs text-muted-foreground">Reach: {player.standingReach}</span>
                    <span className="text-xs text-muted-foreground">Vert: {player.verticalLeap}&quot;</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
