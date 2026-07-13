'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShotChart } from '@/components/basketball/court'
import { useDB, updateDB, statLine, sessionShots, tagByType } from '@/lib/basketball/store'

export default function GameViewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <GameView />
    </Suspense>
  )
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function GameView() {
  const db = useDB()
  const router = useRouter()
  const id = useSearchParams().get('id') ?? ''
  const session = db.sessions.find((s) => s.id === id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!session) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Game not found.</p>
        <Link href="/dashboard/games" className="text-orange-500 hover:underline text-sm">← Back to games</Link>
      </div>
    )
  }

  const participants = db.roster.filter(
    (p) => session.events.some((e) => e.playerId === p.id) || session.movement[p.id]
  )
  const shots = sessionShots(session)
  const result = session.teamScore > session.oppScore ? 'W' : session.teamScore < session.oppScore ? 'L' : '—'

  return (
    <div className="p-4 md:p-8 max-w-[1300px]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/dashboard/games" className="hover:text-foreground">Games</Link>
        <span>/</span>
        <span className="text-foreground">{session.opponent}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${
          result === 'W' ? 'bg-green-500/10 text-green-500' :
          result === 'L' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
        }`}>
          {result}
        </span>
        <div className="flex-1 min-w-[160px]">
          <h1 className="text-2xl font-bold text-foreground">
            {session.location === 'away' ? '@' : 'vs'} {session.opponent}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.date} · {session.source === 'live' ? 'Live recorded' : session.source === 'ai' ? 'AI tracked' : 'Video analysis'} ·{' '}
            {fmtClock(session.durationS)} tracked
          </p>
        </div>
        <span className="text-3xl font-bold text-foreground tabular-nums">
          {session.teamScore}–{session.oppScore}
        </span>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="px-3.5 py-2 text-sm rounded-lg border border-border text-red-500 hover:bg-red-500/10">
            Delete
          </button>
        ) : (
          <button type="button"
            onClick={() => {
              updateDB((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }))
              router.push('/dashboard/games')
            }}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500">
            Confirm delete?
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Box Score</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Player', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'HCKY', 'PASS', 'DRV', 'DEFL', 'STL', 'BLK', 'TIP', 'LOOSE', 'BOX', 'TOV', 'DIST', 'STRIDES', 'MAX SPD'].map((h) => (
                  <th key={h} className="px-3 py-3 text-xs uppercase tracking-wide font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const l = statLine(session.events, p.id)
                const mv = session.movement[p.id]
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                      <Link href={`/dashboard/players/profile?id=${p.id}`} className="hover:text-orange-500">
                        #{p.number} {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums">{l.points}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.fgm}-{l.fga}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.tpm}-{l.tpa}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.ftm}-{l.fta}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.reb}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.ast}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.hast}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.pass}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.drive}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.defl}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.stl}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.blk}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.tip}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.loose}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.boxout}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{l.tov}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{mv ? `${mv.distanceM.toFixed(0)} m` : '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{mv?.strides || '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{mv ? `${mv.maxSpeedKmh.toFixed(1)} km/h` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {shots.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-3">Shot Chart ({shots.length})</h2>
            <div className="flex justify-center"><ShotChart shots={shots} width={420} height={395} /></div>
            <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
              <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />Made</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />Missed</span>
            </div>
          </div>
        )}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Event Timeline ({session.events.length})</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {session.events.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No events tagged.</p>
            ) : (
              [...session.events].reverse().map((e) => {
                const p = db.roster.find((r) => r.id === e.playerId)
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-0">
                    <span className="text-muted-foreground tabular-nums w-12 shrink-0">{fmtClock(e.t)}</span>
                    <span className="font-medium text-foreground truncate">
                      {p ? `#${p.number} ${p.name}` : 'Unknown'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 ml-auto shrink-0">
                      {tagByType[e.type]?.label ?? e.type}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
