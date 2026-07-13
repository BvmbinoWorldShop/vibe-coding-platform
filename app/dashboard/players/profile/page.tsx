'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShotChart } from '@/components/basketball/court'
import { StatCard } from '@/components/basketball/stat-card'
import { useDB, updateDB, statLine, sessionShots, uid } from '@/lib/basketball/store'
import { coachingInsights } from '@/lib/basketball/ai'

export default function PlayerProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <PlayerProfile />
    </Suspense>
  )
}

function PlayerProfile() {
  const db = useDB()
  const router = useRouter()
  const id = useSearchParams().get('id') ?? ''
  const player = db.roster.find((p) => p.id === id)
  const [tab, setTab] = useState<'stats' | 'workouts' | 'recovery'>('stats')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsBusy, setInsightsBusy] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  // workout form
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wType, setWType] = useState('shooting')
  const [wDur, setWDur] = useState('60')
  const [wInt, setWInt] = useState<'low' | 'medium' | 'high'>('medium')
  const [wDesc, setWDesc] = useState('')

  // recovery form
  const [rDate, setRDate] = useState(new Date().toISOString().slice(0, 10))
  const [rSleep, setRSleep] = useState('8')
  const [rScore, setRScore] = useState('85')
  const [rSore, setRSore] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none')
  const [rNotes, setRNotes] = useState('')

  if (!player) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Player not found.</p>
        <Link href="/dashboard/players" className="text-orange-500 hover:underline text-sm">← Back to players</Link>
      </div>
    )
  }

  const played = db.sessions.filter(
    (s) => s.events.some((e) => e.playerId === id) || s.movement[id]
  )
  const totals = statLine(played.flatMap((s) => s.events), id)
  const g = Math.max(played.length, 1)
  const distance = played.reduce((a, s) => a + (s.movement[id]?.distanceM ?? 0), 0)
  const strides = played.reduce((a, s) => a + (s.movement[id]?.strides ?? 0), 0)
  const maxSpeed = Math.max(0, ...played.map((s) => s.movement[id]?.maxSpeedKmh ?? 0))
  const shots = played.flatMap((s) => sessionShots(s, id))
  const myWorkouts = db.workouts.filter((w) => w.playerId === id)
  const myRecovery = db.recovery.filter((r) => r.playerId === id)

  const pct = (m: number, a: number) => (a > 0 ? ((m / a) * 100).toFixed(1) + '%' : '—')

  function addWorkout(e: React.FormEvent) {
    e.preventDefault()
    updateDB((d) => ({
      ...d,
      workouts: [
        { id: uid(), playerId: id, date: wDate, type: wType, duration: Number(wDur) || 60, intensity: wInt, description: wDesc.trim(), completed: false },
        ...d.workouts,
      ],
    }))
    setWDesc('')
  }

  function addRecovery(e: React.FormEvent) {
    e.preventDefault()
    updateDB((d) => ({
      ...d,
      recovery: [
        { id: uid(), playerId: id, date: rDate, sleepHours: Number(rSleep) || 8, recoveryScore: Number(rScore) || 80, soreness: rSore, notes: rNotes.trim() },
        ...d.recovery,
      ],
    }))
    setRNotes('')
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/dashboard/players" className="hover:text-foreground">Players</Link>
        <span>/</span>
        <span className="text-foreground">{player.name}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 flex flex-wrap items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {player.number}
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold text-foreground">{player.name}</h1>
          <p className="text-sm text-muted-foreground">
            #{player.number} · {player.position}
            {player.height ? ` · ${player.height}` : ''} · stride {player.strideLength}m
          </p>
        </div>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="px-3.5 py-2 text-sm rounded-lg border border-border text-red-500 hover:bg-red-500/10">
            Remove player
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              updateDB((d) => ({ ...d, roster: d.roster.filter((p) => p.id !== id) }))
              router.push('/dashboard/players')
            }}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500"
          >
            Confirm remove?
          </button>
        )}
      </div>

      {played.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center mb-5">
          <p className="text-sm text-muted-foreground">
            No recorded data for {player.name} yet — stats appear here after you tag them in a{' '}
            <Link href="/dashboard/live" className="text-orange-500 hover:underline">live game</Link> or{' '}
            <Link href="/dashboard/video" className="text-orange-500 hover:underline">video session</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard label="Games" value={played.length} size="sm" />
          <StatCard label="PPG" value={(totals.points / g).toFixed(1)} size="sm" />
          <StatCard label="FG%" value={pct(totals.fgm, totals.fga)} size="sm" />
          <StatCard label="AST / HCKY" value={`${totals.ast} / ${totals.hast}`} size="sm" />
          <StatCard label="Deflections" value={totals.defl} size="sm" />
          <StatCard label="Distance" value={distance > 0 ? `${distance.toFixed(0)} m` : '—'} subValue={strides > 0 ? `${strides} strides · max ${maxSpeed.toFixed(1)} km/h` : undefined} size="sm" />
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        {([['stats', 'Performance'], ['workouts', `Workouts (${myWorkouts.length})`], ['recovery', `Recovery (${myRecovery.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="space-y-5">
          {played.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="text-lg font-semibold text-foreground">
                  ⚡ AI Coaching Read
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    strengths, weaknesses & workout plan from real recorded stats
                  </span>
                </h2>
                <button
                  type="button"
                  disabled={insightsBusy}
                  onClick={async () => {
                    setInsightsBusy(true)
                    setInsightsError(null)
                    try {
                      const summary = `Player: ${player.name} (#${player.number}, ${player.position})
Games recorded: ${played.length}
Per game: ${(totals.points / g).toFixed(1)} pts, ${(totals.reb / g).toFixed(1)} reb, ${(totals.ast / g).toFixed(1)} ast, ${(totals.defl / g).toFixed(1)} deflections, ${(totals.hast / g).toFixed(1)} hockey assists, ${(totals.stl / g).toFixed(1)} stl, ${(totals.blk / g).toFixed(1)} blk, ${(totals.tov / g).toFixed(1)} tov
Shooting: FG ${totals.fgm}/${totals.fga}, 3PT ${totals.tpm}/${totals.tpa}, FT ${totals.ftm}/${totals.fta}
Hustle totals: ${totals.loose} loose balls, ${totals.boxout} box outs, ${totals.tip} tips, ${totals.cont} contested shots, ${totals.chg} charges drawn
Movement: ${distance.toFixed(0)} m tracked, ${strides} strides, max speed ${maxSpeed.toFixed(1)} km/h`
                      setInsights(
                        await coachingInsights(
                          { cerebrasKey: db.settings.cerebrasKey, mistralKey: db.settings.mistralKey },
                          summary
                        )
                      )
                    } catch (err) {
                      setInsightsError(err instanceof Error ? err.message : 'AI request failed')
                    } finally {
                      setInsightsBusy(false)
                    }
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40"
                >
                  {insightsBusy ? 'Analyzing…' : insights ? 'Regenerate' : 'Generate'}
                </button>
              </div>
              {insightsError && (
                <p className="text-sm text-red-500">
                  {insightsError}{' '}
                  <Link href="/dashboard/settings" className="underline">Settings</Link>
                </p>
              )}
              {insights && (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans bg-muted/30 rounded-lg p-4 mt-2">{insights}</pre>
              )}
              {!insights && !insightsError && !insightsBusy && (
                <p className="text-xs text-muted-foreground">
                  Uses your free Cerebras (or Mistral) key from Settings to turn this player&apos;s real
                  numbers into an actionable workout plan.
                </p>
              )}
            </div>
          )}
          {shots.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-semibold text-foreground mb-3">Shot Chart ({shots.length} recorded shots)</h2>
              <div className="flex justify-center"><ShotChart shots={shots} width={420} height={395} /></div>
              <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />Made</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />Missed</span>
              </div>
            </div>
          )}
          {played.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Game Log</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Date', 'Opponent', 'PTS', 'FG', 'REB', 'AST', 'HCKY', 'DEFL', 'STL', 'BLK', 'DIST'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wide font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {played.map((s) => {
                      const line = statLine(s.events, id)
                      const mv = s.movement[id]
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{s.date}</td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <Link href={`/dashboard/games/view?id=${s.id}`} className="text-orange-500 hover:underline">
                              {s.location === 'away' ? '@' : 'vs'} {s.opponent}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold tabular-nums">{line.points}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.fgm}-{line.fga}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.reb}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.ast}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.hast}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.defl}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.stl}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{line.blk}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{mv ? `${mv.distanceM.toFixed(0)} m` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'workouts' && (
        <div className="space-y-4">
          <form onSubmit={addWorkout} className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <select value={wType} onChange={(e) => setWType(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
                {['shooting', 'strength', 'conditioning', 'agility', 'recovery', 'film'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Minutes</label>
              <input type="number" value={wDur} onChange={(e) => setWDur(e.target.value)} min="5" max="240"
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-20" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Intensity</label>
              <select value={wInt} onChange={(e) => setWInt(e.target.value as typeof wInt)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
                {['low', 'medium', 'high'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-muted-foreground mb-1">Description</label>
              <input value={wDesc} onChange={(e) => setWDesc(e.target.value)} placeholder="e.g. catch-and-shoot 3s, weak-hand finishing"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
            </div>
            <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">Add</button>
          </form>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {myWorkouts.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No workouts logged yet.</p>
            ) : (
              myWorkouts.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground w-24 shrink-0">{w.date}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">{w.type}</span>
                  <span className="text-xs text-muted-foreground">{w.duration} min · {w.intensity}</span>
                  <span className="text-sm text-foreground flex-1 min-w-[120px]">{w.description}</span>
                  <button type="button"
                    onClick={() => updateDB((d) => ({ ...d, workouts: d.workouts.map((x) => x.id === w.id ? { ...x, completed: !x.completed } : x) }))}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${w.completed ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    {w.completed ? 'Completed' : 'Mark done'}
                  </button>
                  <button type="button"
                    onClick={() => updateDB((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }))}
                    className="text-xs text-red-500 hover:underline">remove</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'recovery' && (
        <div className="space-y-4">
          <form onSubmit={addRecovery} className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Sleep (h)</label>
              <input type="number" step="0.5" min="0" max="14" value={rSleep} onChange={(e) => setRSleep(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-20" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Recovery score</label>
              <input type="number" min="0" max="100" value={rScore} onChange={(e) => setRScore(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-20" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Soreness</label>
              <select value={rSore} onChange={(e) => setRSore(e.target.value as typeof rSore)}
                className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
                {['none', 'mild', 'moderate', 'severe'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <input value={rNotes} onChange={(e) => setRNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
            </div>
            <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">Add</button>
          </form>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {myRecovery.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No recovery entries yet.</p>
            ) : (
              myRecovery.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground w-24 shrink-0">{r.date}</span>
                  <span className="text-sm text-foreground">{r.sleepHours}h sleep</span>
                  <span className={`text-sm font-bold tabular-nums ${r.recoveryScore >= 85 ? 'text-green-500' : r.recoveryScore >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {r.recoveryScore}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.soreness === 'none' ? 'bg-green-500/10 text-green-500' :
                    r.soreness === 'mild' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'}`}>
                    {r.soreness}
                  </span>
                  <span className="text-sm text-muted-foreground flex-1 min-w-[120px]">{r.notes}</span>
                  <button type="button"
                    onClick={() => updateDB((d) => ({ ...d, recovery: d.recovery.filter((x) => x.id !== r.id) }))}
                    className="text-xs text-red-500 hover:underline">remove</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
