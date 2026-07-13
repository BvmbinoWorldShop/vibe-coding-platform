'use client'

import Link from 'next/link'
import { useDB } from '@/lib/basketball/store'

export default function GamesPage() {
  const db = useDB()
  const sessions = [...db.sessions].sort((a, b) => (a.date < b.date ? 1 : -1))
  const wins = sessions.filter((s) => s.teamScore > s.oppScore).length
  const losses = sessions.filter((s) => s.teamScore < s.oppScore).length

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Games</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {sessions.length === 0
          ? 'Every game you record — live or from video — appears here with its real box score.'
          : `${sessions.length} recorded · ${wins}W ${losses}L`}
      </p>

      {sessions.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <p className="text-foreground font-semibold mb-1">No games recorded yet</p>
          <p className="text-sm text-muted-foreground mb-5">
            Record a game courtside with the live recorder, or break down film with the video studio.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/dashboard/live"
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">
              Record live game
            </Link>
            <Link href="/dashboard/video"
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50">
              Analyze video
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const result = s.teamScore > s.oppScore ? 'W' : s.teamScore < s.oppScore ? 'L' : '—'
            return (
              <Link key={s.id} href={`/dashboard/games/view?id=${s.id}`}
                className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-4 hover:border-orange-500 transition-colors">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                  result === 'W' ? 'bg-green-500/10 text-green-500' :
                  result === 'L' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {result}
                </span>
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-foreground">
                    {s.location === 'away' ? '@' : 'vs'} {s.opponent}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.date} · {s.events.length} tagged events
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  s.source === 'live' ? 'bg-red-500/10 text-red-500' :
                  s.source === 'ai' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {s.source === 'live' ? 'Live recorded' : s.source === 'ai' ? 'AI tracked' : 'Video analysis'}
                </span>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {s.teamScore}–{s.oppScore}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
