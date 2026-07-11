'use client'

import { useState, useEffect, useCallback } from 'react'
import { LiveCourt } from '@/components/basketball/court'
import { StatCard } from '@/components/basketball/stat-card'
import { players, liveGameState as initialState } from '@/lib/basketball/mock-data'
import type { LiveGameState, PlayByPlay, PlayerGameStats } from '@/lib/basketball/types'

const actionOptions = [
  'FG_MADE', 'FG_MISS', '3PT_MADE', '3PT_MISS', 'FT_MADE', 'FT_MISS',
  'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'PF',
  'DEFLECTION', 'TIP', 'CHARGE_DRAWN', 'SCREEN_AST', 'HOCKEY_AST',
  'LOOSE_BALL', 'BOX_OUT', 'CONTESTED_SHOT',
] as const

function initStats(): Record<string, PlayerGameStats> {
  const stats: Record<string, PlayerGameStats> = {}
  for (const p of players.slice(0, 5)) {
    stats[p.id] = {
      playerId: p.id, minutes: 0, points: 0, fgMade: 0, fgAttempted: 0,
      threePtMade: 0, threePtAttempted: 0, ftMade: 0, ftAttempted: 0,
      offRebounds: 0, defRebounds: 0, totalRebounds: 0, assists: 0,
      steals: 0, blocks: 0, turnovers: 0, personalFouls: 0, plusMinus: 0,
      deflections: 0, tips: 0, chargesDrawn: 0, screenAssists: 0,
      hockeyAssists: 0, looseBalls: 0, boxOuts: 0, contestedShots: 0,
      milesRun: 0, avgSpeed: 0, maxSpeed: 0, touches: 0,
      passesLeadingToAssist: 0, pointsInPaint: 0, fastBreakPoints: 0,
      secondChancePoints: 0,
    }
  }
  return stats
}

export default function LiveTrackingPage() {
  const [gameState, setGameState] = useState<LiveGameState>(initialState)
  const [plays, setPlays] = useState<PlayByPlay[]>([])
  const [liveStats, setLiveStats] = useState<Record<string, PlayerGameStats>>(initStats)
  const [selectedPlayer, setSelectedPlayer] = useState<string>('p1')
  const [selectedAction, setSelectedAction] = useState<string>('FG_MADE')

  const getPlayer = useCallback((id: string) => players.find((p) => p.id === id), [])

  useEffect(() => {
    const interval = setInterval(() => {
      setGameState((prev) => {
        const newPositions = prev.playerPositions.map((pos) => ({
          ...pos,
          x: Math.max(5, Math.min(95, pos.x + (Math.random() - 0.5) * 6)),
          y: Math.max(5, Math.min(95, pos.y + (Math.random() - 0.5) * 6)),
        }))
        const ballCarrier = newPositions.find((p) => p.hasBall)
        return {
          ...prev,
          playerPositions: newPositions,
          ballPosition: ballCarrier ? { x: ballCarrier.x, y: ballCarrier.y } : prev.ballPosition,
        }
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const recordAction = () => {
    const pl = getPlayer(selectedPlayer)
    if (!pl) return

    const newPlay: PlayByPlay = {
      id: `live-${Date.now()}`,
      gameId: gameState.gameId,
      quarter: gameState.quarter,
      timeRemaining: gameState.timeRemaining,
      playerId: selectedPlayer,
      action: selectedAction as PlayByPlay['action'],
      details: selectedAction.replace(/_/g, ' ').toLowerCase(),
      points: selectedAction === '3PT_MADE' ? 3 :
              selectedAction === 'FG_MADE' ? 2 :
              selectedAction === 'FT_MADE' ? 1 : undefined,
    }

    setPlays((prev) => [newPlay, ...prev])

    setLiveStats((prev) => {
      const stat = { ...prev[selectedPlayer] }
      switch (selectedAction) {
        case 'FG_MADE': stat.fgMade++; stat.fgAttempted++; stat.points += 2; break
        case 'FG_MISS': stat.fgAttempted++; break
        case '3PT_MADE': stat.threePtMade++; stat.threePtAttempted++; stat.fgMade++; stat.fgAttempted++; stat.points += 3; break
        case '3PT_MISS': stat.threePtAttempted++; stat.fgAttempted++; break
        case 'FT_MADE': stat.ftMade++; stat.ftAttempted++; stat.points += 1; break
        case 'FT_MISS': stat.ftAttempted++; break
        case 'OREB': stat.offRebounds++; stat.totalRebounds++; break
        case 'DREB': stat.defRebounds++; stat.totalRebounds++; break
        case 'AST': stat.assists++; break
        case 'STL': stat.steals++; break
        case 'BLK': stat.blocks++; break
        case 'TOV': stat.turnovers++; break
        case 'PF': stat.personalFouls++; break
        case 'DEFLECTION': stat.deflections++; break
        case 'TIP': stat.tips++; break
        case 'CHARGE_DRAWN': stat.chargesDrawn++; break
        case 'SCREEN_AST': stat.screenAssists++; break
        case 'HOCKEY_AST': stat.hockeyAssists++; break
        case 'LOOSE_BALL': stat.looseBalls++; break
        case 'BOX_OUT': stat.boxOuts++; break
        case 'CONTESTED_SHOT': stat.contestedShots++; break
      }
      return { ...prev, [selectedPlayer]: stat }
    })

    if (newPlay.points) {
      setGameState((prev) => ({
        ...prev,
        teamScore: prev.teamScore + (newPlay.points || 0),
      }))
    }
  }

  const starters = players.slice(0, 5)

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live Game Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time court view and stat recording</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
          <span className="text-sm text-muted-foreground">Q{gameState.quarter} | {gameState.timeRemaining}</span>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="text-center">
            <p className="text-4xl font-bold text-foreground">{gameState.teamScore}</p>
            <p className="text-sm text-muted-foreground">Our Team</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Q{gameState.quarter}</p>
            <p className="text-2xl font-bold font-mono text-foreground">{gameState.timeRemaining}</p>
            <p className="text-xs text-muted-foreground">Shot Clock: {gameState.shotClock}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-foreground">{gameState.opponentScore}</p>
            <p className="text-sm text-muted-foreground">Opponent</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Court */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-y-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">LIVE COURT</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" /> Ball Handler
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> Player
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-orange-500" /> Ball
                </div>
              </div>
            </div>
            <LiveCourt
              playerPositions={gameState.playerPositions.map((pos) => ({
                ...pos,
                label: `#${getPlayer(pos.playerId)?.number}`,
              }))}
              ballPosition={gameState.ballPosition}
            />
          </div>

          {/* Quick Action Recording */}
          <div className="bg-card border border-border rounded-xl p-6 mt-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Record Action</h2>
            <div className="space-y-4">
              {/* Player Selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select Player</p>
                <div className="flex gap-2 flex-wrap">
                  {starters.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayer(p.id)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        selectedPlayer === p.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="font-bold">#{p.number}</span>
                      <span>{p.lastName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select Action</p>
                <div className="flex gap-1.5 flex-wrap">
                  {actionOptions.map((action) => {
                    const isScoring = action.includes('MADE') || action.includes('MISS')
                    const isDefense = ['STL', 'BLK', 'DEFLECTION', 'CHARGE_DRAWN', 'CONTESTED_SHOT', 'BOX_OUT'].includes(action)
                    return (
                      <button
                        key={action}
                        onClick={() => setSelectedAction(action)}
                        className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                          selectedAction === action
                            ? 'bg-blue-500 text-white'
                            : isScoring
                              ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                              : isDefense
                                ? 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {action.replace(/_/g, ' ')}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={recordAction}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Record: #{getPlayer(selectedPlayer)?.number} {getPlayer(selectedPlayer)?.lastName} - {selectedAction.replace(/_/g, ' ')}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Live Stats & Feed */}
        <div className="space-y-4">
          {/* On-Court Players Stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">On Court - Live Stats</h2>
            <div className="space-y-3">
              {starters.map((p) => {
                const stat = liveStats[p.id]
                return (
                  <div key={p.id} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {p.number}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.lastName}</p>
                          <p className="text-xs text-muted-foreground">{p.position}</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-foreground">{stat?.points || 0}</p>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center text-xs">
                      <div>
                        <p className="font-medium text-foreground">{stat?.totalRebounds || 0}</p>
                        <p className="text-muted-foreground">REB</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.assists || 0}</p>
                        <p className="text-muted-foreground">AST</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.steals || 0}</p>
                        <p className="text-muted-foreground">STL</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.deflections || 0}</p>
                        <p className="text-muted-foreground">DEFL</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.blocks || 0}</p>
                        <p className="text-muted-foreground">BLK</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-xs mt-1">
                      <div>
                        <p className="font-medium text-foreground">{stat?.hockeyAssists || 0}</p>
                        <p className="text-muted-foreground">HKY</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.tips || 0}</p>
                        <p className="text-muted-foreground">TIPS</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.looseBalls || 0}</p>
                        <p className="text-muted-foreground">LB</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stat?.contestedShots || 0}</p>
                        <p className="text-muted-foreground">CONT</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live Play Feed */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Live Play Feed</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {plays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No actions recorded yet. Use the controls to record plays.</p>
              ) : (
                plays.map((play) => {
                  const pl = getPlayer(play.playerId)
                  return (
                    <div key={play.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0 text-sm">
                      <span className="text-xs text-muted-foreground font-mono w-10">{play.timeRemaining}</span>
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {pl?.number}
                      </span>
                      <span className="text-xs">
                        <span className="font-medium text-foreground">{pl?.lastName}</span>{' '}
                        <span className={play.points ? 'text-green-500' : 'text-muted-foreground'}>
                          {play.action.replace(/_/g, ' ')}
                        </span>
                        {play.points && <span className="text-green-500 font-bold ml-1">+{play.points}</span>}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Team Hustle Stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Team Hustle Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Deflections"
                value={Object.values(liveStats).reduce((a, s) => a + s.deflections, 0)}
                size="sm"
              />
              <StatCard
                label="Loose Balls"
                value={Object.values(liveStats).reduce((a, s) => a + s.looseBalls, 0)}
                size="sm"
              />
              <StatCard
                label="Box Outs"
                value={Object.values(liveStats).reduce((a, s) => a + s.boxOuts, 0)}
                size="sm"
              />
              <StatCard
                label="Charges Drawn"
                value={Object.values(liveStats).reduce((a, s) => a + s.chargesDrawn, 0)}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
