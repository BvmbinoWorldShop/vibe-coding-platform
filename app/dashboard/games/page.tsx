'use client'

import Link from 'next/link'
import { games, players } from '@/lib/basketball/mock-data'

export default function GamesPage() {
  const getPlayer = (id: string) => players.find((p) => p.id === id)

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Games</h1>
        <p className="text-sm text-muted-foreground mt-1">Game history with full statistical breakdowns</p>
      </div>

      {/* Games List */}
      <div className="space-y-4">
        {games.map((game) => {
          const topScorer = game.playerStats.reduce((a, b) => (a.points > b.points ? a : b))
          const topRebounder = game.playerStats.reduce((a, b) => (a.totalRebounds > b.totalRebounds ? a : b))
          const topAssists = game.playerStats.reduce((a, b) => (a.assists > b.assists ? a : b))
          const totalDeflections = game.playerStats.reduce((a, b) => a + b.deflections, 0)
          const totalMilesRun = game.playerStats.reduce((a, b) => a + b.milesRun, 0).toFixed(1)
          const fgPct = game.playerStats.reduce((a, b) => a + b.fgMade, 0) / Math.max(game.playerStats.reduce((a, b) => a + b.fgAttempted, 0), 1) * 100

          return (
            <Link
              key={game.id}
              href={`/dashboard/games/${game.id}`}
              className="block bg-card border border-border rounded-xl p-6 hover:border-ring transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xs text-muted-foreground">{game.date}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{game.location === 'home' ? 'HOME' : 'AWAY'}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{game.teamScore}</p>
                      <p className="text-xs text-muted-foreground">Our Team</p>
                    </div>
                    <span className={`text-sm font-bold px-2.5 py-1 rounded ${
                      game.result === 'W' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {game.result === 'W' ? 'W' : 'L'}
                    </span>
                    <div>
                      <p className="text-xl font-bold text-foreground">{game.opponentScore}</p>
                      <p className="text-xs text-muted-foreground">{game.opponent}</p>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Top Scorer</p>
                    <p className="text-sm font-medium text-foreground">
                      {getPlayer(topScorer.playerId)?.lastName} {topScorer.points}pts
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Top Reb</p>
                    <p className="text-sm font-medium text-foreground">
                      {getPlayer(topRebounder.playerId)?.lastName} {topRebounder.totalRebounds}reb
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Top Ast</p>
                    <p className="text-sm font-medium text-foreground">
                      {getPlayer(topAssists.playerId)?.lastName} {topAssists.assists}ast
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">FG%</p>
                    <p className="text-sm font-medium text-foreground">{fgPct.toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Deflections</p>
                    <p className="text-sm font-medium text-foreground">{totalDeflections}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Miles Run</p>
                    <p className="text-sm font-medium text-foreground">{totalMilesRun}</p>
                  </div>
                </div>

                <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              {/* Quarter breakdown */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {game.quarterScores.map((q) => (
                  <div key={q.quarter} className="bg-muted/30 rounded px-3 py-1.5 text-center">
                    <span className="text-xs text-muted-foreground">Q{q.quarter}: </span>
                    <span className={`text-xs font-medium ${q.teamScore > q.opponentScore ? 'text-green-500' : q.teamScore < q.opponentScore ? 'text-red-500' : 'text-foreground'}`}>
                      {q.teamScore}-{q.opponentScore}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
