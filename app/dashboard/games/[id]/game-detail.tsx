'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShotChart } from '@/components/basketball/court'
import { StatCard, ProgressBar } from '@/components/basketball/stat-card'
import { games, players } from '@/lib/basketball/mock-data'

export function GameDetail({ id }: { id: string }) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'box' | 'advanced' | 'plays' | 'shots'>('box')

  const game = games.find((g) => g.id === id)
  if (!game) {
    return <div className="p-8"><p className="text-muted-foreground">Game not found</p></div>
  }

  const getPlayer = (pid: string) => players.find((p) => p.id === pid)
  const teamFGM = game.playerStats.reduce((a, s) => a + s.fgMade, 0)
  const teamFGA = game.playerStats.reduce((a, s) => a + s.fgAttempted, 0)
  const team3PM = game.playerStats.reduce((a, s) => a + s.threePtMade, 0)
  const team3PA = game.playerStats.reduce((a, s) => a + s.threePtAttempted, 0)
  const teamDeflections = game.playerStats.reduce((a, s) => a + s.deflections, 0)
  const teamMiles = game.playerStats.reduce((a, s) => a + s.milesRun, 0)
  const teamReb = game.playerStats.reduce((a, s) => a + s.totalRebounds, 0)
  const teamAst = game.playerStats.reduce((a, s) => a + s.assists, 0)
  const teamTov = game.playerStats.reduce((a, s) => a + s.turnovers, 0)

  const tabs = [
    { key: 'box' as const, label: 'Box Score' },
    { key: 'advanced' as const, label: 'Advanced Stats' },
    { key: 'shots' as const, label: 'Shot Chart' },
    { key: 'plays' as const, label: 'Play-by-Play' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/dashboard/games" className="hover:text-foreground">Games</Link>
        <span>/</span>
        <span className="text-foreground">vs {game.opponent}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            vs {game.opponent}
            <span className={`ml-3 text-lg ${game.result === 'W' ? 'text-green-500' : 'text-red-500'}`}>
              {game.result === 'W' ? 'WIN' : 'LOSS'}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{game.date} | {game.location === 'home' ? 'Home' : 'Away'}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-foreground">{game.teamScore} - {game.opponentScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <StatCard label="FG%" value={`${((teamFGM / Math.max(teamFGA, 1)) * 100).toFixed(1)}%`} subValue={`${teamFGM}/${teamFGA}`} size="sm" />
        <StatCard label="3PT%" value={`${((team3PM / Math.max(team3PA, 1)) * 100).toFixed(1)}%`} subValue={`${team3PM}/${team3PA}`} size="sm" />
        <StatCard label="Rebounds" value={teamReb} size="sm" />
        <StatCard label="Assists" value={teamAst} size="sm" />
        <StatCard label="Deflections" value={teamDeflections} size="sm" />
        <StatCard label="Miles Run" value={teamMiles.toFixed(1)} size="sm" />
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Quarter Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {game.quarterScores.map((q) => (
            <div key={q.quarter} className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quarter {q.quarter}</p>
              <p className={`text-xl font-bold ${q.teamScore > q.opponentScore ? 'text-green-500' : 'text-red-500'}`}>
                {q.teamScore}-{q.opponentScore}
              </p>
              <div className="mt-3 space-y-2">
                <ProgressBar label="FG%" value={q.fgPercentage} max={100} color="bg-blue-500" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>AST: {q.assists}</span>
                  <span>REB: {q.rebounds}</span>
                  <span>TOV: {q.turnovers}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Paint: {q.pointsInPaint}</span>
                  <span>FB: {q.fastBreakPoints}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'box' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/30">Player</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">MIN</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">PTS</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">FG</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">3PT</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">FT</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">OREB</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">DREB</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">REB</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">AST</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">STL</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">BLK</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">TOV</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">PF</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">+/-</th>
                </tr>
              </thead>
              <tbody>
                {game.playerStats.sort((a, b) => b.minutes - a.minutes).map((stat) => {
                  const pl = getPlayer(stat.playerId)
                  return (
                    <tr key={stat.playerId} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 sticky left-0 bg-card">
                        <Link href={`/dashboard/players/${stat.playerId}`} className="flex items-center gap-2 hover:text-blue-500">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{pl?.number}</span>
                          <span className="font-medium">{pl?.firstName} {pl?.lastName}</span>
                          <span className="text-xs text-muted-foreground">{pl?.position}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center">{stat.minutes}</td>
                      <td className="px-3 py-3 text-center font-bold">{stat.points}</td>
                      <td className="px-3 py-3 text-center">{stat.fgMade}-{stat.fgAttempted}</td>
                      <td className="px-3 py-3 text-center">{stat.threePtMade}-{stat.threePtAttempted}</td>
                      <td className="px-3 py-3 text-center">{stat.ftMade}-{stat.ftAttempted}</td>
                      <td className="px-3 py-3 text-center">{stat.offRebounds}</td>
                      <td className="px-3 py-3 text-center">{stat.defRebounds}</td>
                      <td className="px-3 py-3 text-center font-medium">{stat.totalRebounds}</td>
                      <td className="px-3 py-3 text-center">{stat.assists}</td>
                      <td className="px-3 py-3 text-center">{stat.steals}</td>
                      <td className="px-3 py-3 text-center">{stat.blocks}</td>
                      <td className="px-3 py-3 text-center">{stat.turnovers}</td>
                      <td className="px-3 py-3 text-center">{stat.personalFouls}</td>
                      <td className={`px-3 py-3 text-center font-medium ${stat.plusMinus > 0 ? 'text-green-500' : stat.plusMinus < 0 ? 'text-red-500' : ''}`}>
                        {stat.plusMinus > 0 ? '+' : ''}{stat.plusMinus}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/30">Player</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">DEFL</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">TIPS</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">CHG DRN</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">SCR AST</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">HCKY AST</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">LOOSE</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">BOX OUT</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">CONTEST</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">MILES</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">AVG SPD</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">MAX SPD</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">TCHS</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">PAINT PTS</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">FB PTS</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">2ND CH</th>
                </tr>
              </thead>
              <tbody>
                {game.playerStats.sort((a, b) => b.minutes - a.minutes).map((stat) => {
                  const pl = getPlayer(stat.playerId)
                  return (
                    <tr key={stat.playerId} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 sticky left-0 bg-card">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{pl?.number}</span>
                          <span className="font-medium">{pl?.firstName} {pl?.lastName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">{stat.deflections}</td>
                      <td className="px-3 py-3 text-center">{stat.tips}</td>
                      <td className="px-3 py-3 text-center">{stat.chargesDrawn}</td>
                      <td className="px-3 py-3 text-center">{stat.screenAssists}</td>
                      <td className="px-3 py-3 text-center">{stat.hockeyAssists}</td>
                      <td className="px-3 py-3 text-center">{stat.looseBalls}</td>
                      <td className="px-3 py-3 text-center">{stat.boxOuts}</td>
                      <td className="px-3 py-3 text-center">{stat.contestedShots}</td>
                      <td className="px-3 py-3 text-center font-medium">{stat.milesRun}</td>
                      <td className="px-3 py-3 text-center">{stat.avgSpeed} mph</td>
                      <td className="px-3 py-3 text-center">{stat.maxSpeed} mph</td>
                      <td className="px-3 py-3 text-center">{stat.touches}</td>
                      <td className="px-3 py-3 text-center">{stat.pointsInPaint}</td>
                      <td className="px-3 py-3 text-center">{stat.fastBreakPoints}</td>
                      <td className="px-3 py-3 text-center">{stat.secondChancePoints}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shots' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedPlayer(null)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!selectedPlayer ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              All Players
            </button>
            {game.playerStats.sort((a, b) => b.minutes - a.minutes).slice(0, 8).map((stat) => {
              const pl = getPlayer(stat.playerId)
              return (
                <button
                  key={stat.playerId}
                  onClick={() => setSelectedPlayer(stat.playerId)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedPlayer === stat.playerId ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  #{pl?.number} {pl?.lastName}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex justify-center">
              <ShotChart shots={game.shots} selectedPlayer={selectedPlayer} width={480} height={450} />
            </div>
            <div className="flex-1 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Shot Distribution</h3>
              {(() => {
                const filteredShots = selectedPlayer ? game.shots.filter((s) => s.playerId === selectedPlayer) : game.shots
                const twoMade = filteredShots.filter((s) => s.shotType === '2PT' && s.made).length
                const twoAttempted = filteredShots.filter((s) => s.shotType === '2PT').length
                const threeMade = filteredShots.filter((s) => s.shotType === '3PT' && s.made).length
                const threeAttempted = filteredShots.filter((s) => s.shotType === '3PT').length
                const contested = filteredShots.filter((s) => s.contested).length
                const contestedMade = filteredShots.filter((s) => s.contested && s.made).length
                const assisted = filteredShots.filter((s) => s.assisted).length
                return (
                  <div className="space-y-3">
                    <ProgressBar label="2PT Field Goals" value={twoMade} max={twoAttempted} color="bg-blue-500" showPercent={false} />
                    <ProgressBar label="3PT Field Goals" value={threeMade} max={threeAttempted} color="bg-purple-500" showPercent={false} />
                    <ProgressBar label="Contested Shots Made" value={contestedMade} max={contested} color="bg-orange-500" showPercent={false} />
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{assisted}</p>
                        <p className="text-xs text-muted-foreground">Assisted FGs</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{filteredShots.filter((s) => s.made).length - assisted}</p>
                        <p className="text-xs text-muted-foreground">Unassisted FGs</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {filteredShots.length > 0 ? (filteredShots.reduce((a, s) => a + s.shotDistance, 0) / filteredShots.length).toFixed(1) : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Shot Dist (ft)</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{filteredShots.length}</p>
                        <p className="text-xs text-muted-foreground">Total Attempts</p>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Made
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> Missed
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plays' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="space-y-0">
            {[1, 2, 3, 4].map((quarter) => (
              <div key={quarter}>
                <div className="sticky top-0 bg-card py-2 border-b border-border">
                  <h3 className="text-sm font-bold text-foreground">Quarter {quarter}</h3>
                </div>
                <div className="space-y-0">
                  {game.plays.filter((p) => p.quarter === quarter).map((play) => {
                    const pl = getPlayer(play.playerId)
                    const actionColors: Record<string, string> = {
                      FG_MADE: 'text-green-500', '3PT_MADE': 'text-green-500', FT_MADE: 'text-green-500',
                      FG_MISS: 'text-red-400', '3PT_MISS': 'text-red-400', FT_MISS: 'text-red-400',
                      TOV: 'text-red-500', PF: 'text-yellow-500',
                      STL: 'text-blue-500', BLK: 'text-blue-500', DEFLECTION: 'text-blue-400',
                      AST: 'text-purple-500', HOCKEY_AST: 'text-purple-400',
                    }
                    return (
                      <div key={play.id} className="flex items-center gap-4 py-2 border-b border-border/50 text-sm">
                        <span className="text-xs text-muted-foreground w-12 text-right font-mono">{play.timeRemaining}</span>
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">{pl?.number}</span>
                        <span className="font-medium text-foreground">{pl?.lastName}</span>
                        <span className={`text-xs font-medium ${actionColors[play.action] || 'text-muted-foreground'}`}>
                          {play.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">{play.details}</span>
                        {play.points && <span className="text-xs font-bold text-green-500 ml-auto">+{play.points}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Team Efficiency Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{(teamAst / Math.max(teamTov, 1)).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">AST/TOV Ratio</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{teamMiles.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Total Miles Run</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{teamDeflections}</p>
            <p className="text-xs text-muted-foreground">Total Deflections</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{game.playerStats.reduce((a, s) => a + s.contestedShots, 0)}</p>
            <p className="text-xs text-muted-foreground">Contested Shots</p>
          </div>
        </div>
      </div>
    </div>
  )
}
