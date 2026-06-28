'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { StatCard, ProgressBar } from '@/components/basketball/stat-card'
import { ShotChart } from '@/components/basketball/court'
import { players, games, workouts, mealPlans, restRecords } from '@/lib/basketball/mock-data'

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [activeTab, setActiveTab] = useState<'stats' | 'workouts' | 'nutrition' | 'recovery'>('stats')

  const player = players.find((p) => p.id === id)
  if (!player) {
    return <div className="p-8"><p className="text-muted-foreground">Player not found</p></div>
  }

  const playerWorkouts = workouts.filter((w) => w.playerId === id)
  const playerMeals = mealPlans.filter((m) => m.playerId === id)
  const playerRest = restRecords.filter((r) => r.playerId === id)

  const gameStats = games.map((game) => {
    const stat = game.playerStats.find((s) => s.playerId === id)
    return { game, stat }
  }).filter((g) => g.stat && g.stat.minutes > 0)

  const avgStats = gameStats.length > 0 ? {
    ppg: (gameStats.reduce((a, g) => a + (g.stat?.points || 0), 0) / gameStats.length).toFixed(1),
    rpg: (gameStats.reduce((a, g) => a + (g.stat?.totalRebounds || 0), 0) / gameStats.length).toFixed(1),
    apg: (gameStats.reduce((a, g) => a + (g.stat?.assists || 0), 0) / gameStats.length).toFixed(1),
    spg: (gameStats.reduce((a, g) => a + (g.stat?.steals || 0), 0) / gameStats.length).toFixed(1),
    bpg: (gameStats.reduce((a, g) => a + (g.stat?.blocks || 0), 0) / gameStats.length).toFixed(1),
    mpg: (gameStats.reduce((a, g) => a + (g.stat?.minutes || 0), 0) / gameStats.length).toFixed(1),
    fgPct: ((gameStats.reduce((a, g) => a + (g.stat?.fgMade || 0), 0) / Math.max(gameStats.reduce((a, g) => a + (g.stat?.fgAttempted || 0), 0), 1)) * 100).toFixed(1),
    threePct: ((gameStats.reduce((a, g) => a + (g.stat?.threePtMade || 0), 0) / Math.max(gameStats.reduce((a, g) => a + (g.stat?.threePtAttempted || 0), 0), 1)) * 100).toFixed(1),
    deflPg: (gameStats.reduce((a, g) => a + (g.stat?.deflections || 0), 0) / gameStats.length).toFixed(1),
    milesPg: (gameStats.reduce((a, g) => a + (g.stat?.milesRun || 0), 0) / gameStats.length).toFixed(1),
  } : null

  const allPlayerShots = games.flatMap((game) => game.shots.filter((s) => s.playerId === id))

  const tabs = [
    { key: 'stats' as const, label: 'Performance' },
    { key: 'workouts' as const, label: 'Workouts' },
    { key: 'nutrition' as const, label: 'Nutrition' },
    { key: 'recovery' as const, label: 'Recovery' },
  ]

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/dashboard/players" className="hover:text-foreground">Players</Link>
        <span>/</span>
        <span className="text-foreground">{player.firstName} {player.lastName}</span>
      </div>

      {/* Player Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shrink-0">
            {player.number}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{player.firstName} {player.lastName}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full ${
                player.status === 'active' ? 'bg-green-500/10 text-green-500' :
                player.status === 'injured' ? 'bg-red-500/10 text-red-500' :
                'bg-yellow-500/10 text-yellow-500'
              }`}>
                {player.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">#{player.number} | {player.position} | {player.height} | {player.weight} lbs | Age {player.age}</p>
            <p className="text-sm text-muted-foreground mt-2 italic">{player.notes}</p>

            {/* Physical Measurements */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Wingspan</p>
                <p className="text-sm font-bold text-foreground">{player.wingspan}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Standing Reach</p>
                <p className="text-sm font-bold text-foreground">{player.standingReach}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vertical Leap</p>
                <p className="text-sm font-bold text-foreground">{player.verticalLeap}&quot;</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stride Length</p>
                <p className="text-sm font-bold text-foreground">{player.strideLength}m</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="text-sm font-bold text-foreground">{player.weight} lbs</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Season Averages */}
      {avgStats && (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
          <StatCard label="PPG" value={avgStats.ppg} size="sm" />
          <StatCard label="RPG" value={avgStats.rpg} size="sm" />
          <StatCard label="APG" value={avgStats.apg} size="sm" />
          <StatCard label="SPG" value={avgStats.spg} size="sm" />
          <StatCard label="BPG" value={avgStats.bpg} size="sm" />
          <StatCard label="MPG" value={avgStats.mpg} size="sm" />
          <StatCard label="FG%" value={`${avgStats.fgPct}%`} size="sm" />
          <StatCard label="3PT%" value={`${avgStats.threePct}%`} size="sm" />
          <StatCard label="DEFL/G" value={avgStats.deflPg} size="sm" />
          <StatCard label="MILES/G" value={avgStats.milesPg} size="sm" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Performance Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Shot Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Season Shot Chart</h2>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex justify-center">
                <ShotChart shots={allPlayerShots} width={420} height={395} />
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Shot Zones</h3>
                {(() => {
                  const zones = ['Paint', 'Mid Left', 'Mid Right', 'Mid Top', '3PT Left Corner', '3PT Right Corner', '3PT Left Wing', '3PT Right Wing', '3PT Top']
                  return zones.map((zone) => {
                    const zoneShots = allPlayerShots.filter((s) => s.shotZone === zone)
                    const made = zoneShots.filter((s) => s.made).length
                    return zoneShots.length > 0 ? (
                      <ProgressBar key={zone} label={zone} value={made} max={zoneShots.length} color={made / zoneShots.length > 0.45 ? 'bg-green-500' : 'bg-red-400'} showPercent={false} />
                    ) : null
                  })
                })()}
                <div className="flex gap-4 mt-3">
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

          {/* Game Log */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Game Log</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Opponent</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">MIN</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">PTS</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">REB</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">AST</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">STL</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">BLK</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">DEFL</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">MILES</th>
                    <th className="px-3 py-3 font-medium text-muted-foreground text-center">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {gameStats.map(({ game, stat }) => (
                    <tr key={game.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{game.date}</td>
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/games/${game.id}`} className="text-blue-500 hover:underline">
                          {game.location === 'away' ? '@' : 'vs'} {game.opponent}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center">{stat!.minutes}</td>
                      <td className="px-3 py-3 text-center font-bold">{stat!.points}</td>
                      <td className="px-3 py-3 text-center">{stat!.totalRebounds}</td>
                      <td className="px-3 py-3 text-center">{stat!.assists}</td>
                      <td className="px-3 py-3 text-center">{stat!.steals}</td>
                      <td className="px-3 py-3 text-center">{stat!.blocks}</td>
                      <td className="px-3 py-3 text-center">{stat!.deflections}</td>
                      <td className="px-3 py-3 text-center">{stat!.milesRun}</td>
                      <td className={`px-3 py-3 text-center font-medium ${stat!.plusMinus > 0 ? 'text-green-500' : stat!.plusMinus < 0 ? 'text-red-500' : ''}`}>
                        {stat!.plusMinus > 0 ? '+' : ''}{stat!.plusMinus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Workouts Tab */}
      {activeTab === 'workouts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Workouts" value={playerWorkouts.length} size="sm" />
            <StatCard label="Completed" value={playerWorkouts.filter((w) => w.completed).length} size="sm" />
            <StatCard label="Total Hours" value={`${(playerWorkouts.reduce((a, w) => a + w.duration, 0) / 60).toFixed(1)}h`} size="sm" />
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Duration</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Intensity</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {playerWorkouts.map((w) => (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{w.date}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        w.type === 'shooting' ? 'bg-blue-500/10 text-blue-500' :
                        w.type === 'strength' ? 'bg-red-500/10 text-red-500' :
                        w.type === 'conditioning' ? 'bg-orange-500/10 text-orange-500' :
                        w.type === 'agility' ? 'bg-purple-500/10 text-purple-500' :
                        w.type === 'recovery' ? 'bg-green-500/10 text-green-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {w.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{w.duration} min</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        w.intensity === 'high' ? 'bg-red-500/10 text-red-500' :
                        w.intensity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-green-500/10 text-green-500'
                      }`}>
                        {w.intensity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{w.description}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium ${w.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {w.completed ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nutrition Tab */}
      {activeTab === 'nutrition' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Avg Calories" value={playerMeals.length > 0 ? Math.round(playerMeals.reduce((a, m) => a + m.calories, 0) / playerMeals.length) : 0} subValue="per meal" size="sm" />
            <StatCard label="Avg Protein" value={playerMeals.length > 0 ? `${Math.round(playerMeals.reduce((a, m) => a + m.protein, 0) / playerMeals.length)}g` : '0g'} subValue="per meal" size="sm" />
            <StatCard label="Avg Carbs" value={playerMeals.length > 0 ? `${Math.round(playerMeals.reduce((a, m) => a + m.carbs, 0) / playerMeals.length)}g` : '0g'} subValue="per meal" size="sm" />
            <StatCard label="Daily Total" value={`${playerMeals.reduce((a, m) => a + m.calories, 0)}`} subValue="calories today" size="sm" />
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Meal</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Calories</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Protein</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Carbs</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Fat</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {playerMeals.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 capitalize">{m.meal}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-medium">{m.calories}</td>
                    <td className="px-3 py-3 text-center">{m.protein}g</td>
                    <td className="px-3 py-3 text-center">{m.carbs}g</td>
                    <td className="px-3 py-3 text-center">{m.fat}g</td>
                    <td className="px-3 py-3 text-muted-foreground">{m.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Macro Breakdown Visual */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Daily Macro Breakdown</h3>
            <div className="space-y-3">
              <ProgressBar
                label="Protein"
                value={playerMeals.reduce((a, m) => a + m.protein, 0)}
                max={250}
                color="bg-blue-500"
                showPercent={false}
              />
              <ProgressBar
                label="Carbohydrates"
                value={playerMeals.reduce((a, m) => a + m.carbs, 0)}
                max={400}
                color="bg-yellow-500"
                showPercent={false}
              />
              <ProgressBar
                label="Fat"
                value={playerMeals.reduce((a, m) => a + m.fat, 0)}
                max={120}
                color="bg-red-400"
                showPercent={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recovery Tab */}
      {activeTab === 'recovery' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Latest Recovery"
              value={playerRest[0]?.recoveryScore || 'N/A'}
              subValue={playerRest[0]?.date}
              size="sm"
            />
            <StatCard
              label="Avg Sleep"
              value={playerRest.length > 0 ? `${(playerRest.reduce((a, r) => a + r.sleepHours, 0) / playerRest.length).toFixed(1)}h` : 'N/A'}
              size="sm"
            />
            <StatCard
              label="Avg Sleep Quality"
              value={playerRest.length > 0 ? `${(playerRest.reduce((a, r) => a + r.sleepQuality, 0) / playerRest.length).toFixed(1)}/5` : 'N/A'}
              size="sm"
            />
            <StatCard
              label="Soreness Status"
              value={playerRest[0]?.soreness || 'N/A'}
              size="sm"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Sleep Hours</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Sleep Quality</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Recovery Score</th>
                  <th className="px-3 py-3 font-medium text-muted-foreground text-center">Soreness</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {playerRest.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                    <td className="px-3 py-3 text-center">{r.sleepHours}h</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={star <= r.sleepQuality ? 'text-yellow-400' : 'text-muted'}>&#9733;</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-bold ${
                        r.recoveryScore >= 85 ? 'text-green-500' :
                        r.recoveryScore >= 70 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {r.recoveryScore}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.soreness === 'none' ? 'bg-green-500/10 text-green-500' :
                        r.soreness === 'mild' ? 'bg-yellow-500/10 text-yellow-500' :
                        r.soreness === 'moderate' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {r.soreness}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recovery Trend */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recovery Trend</h3>
            <div className="flex items-end gap-2 h-32">
              {playerRest.map((r) => (
                <div key={r.id} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${
                      r.recoveryScore >= 85 ? 'bg-green-500' :
                      r.recoveryScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${r.recoveryScore}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{r.recoveryScore}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
