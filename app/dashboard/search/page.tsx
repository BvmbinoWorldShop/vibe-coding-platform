'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useDB, tagByType, TAGS, type SessionEvent } from '@/lib/basketball/store'

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

interface Hit {
  sessionId: string
  date: string
  opponent: string
  event: SessionEvent
  playerName: string
  playerNumber: number
}

export default function SearchPage() {
  const db = useDB()
  const [playerId, setPlayerId] = useState('all')
  const [eventType, setEventType] = useState('all')

  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = []
    for (const s of db.sessions) {
      for (const e of s.events) {
        if (playerId !== 'all' && e.playerId !== playerId) continue
        if (eventType !== 'all' && e.type !== eventType) continue
        const p = db.roster.find((r) => r.id === e.playerId)
        out.push({
          sessionId: s.id,
          date: s.date,
          opponent: s.opponent,
          event: e,
          playerName: p?.name ?? 'Unknown',
          playerNumber: p?.number ?? 0,
        })
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.event.t - a.event.t))
  }, [db.sessions, db.roster, playerId, eventType])

  // Count by type for the current player filter (event-search summary).
  const summary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const h of hits) counts[h.event.type] = (counts[h.event.type] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [hits])

  return (
    <div className="p-4 md:p-8 max-w-[1200px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Search</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Find every recorded play across all your games — by player, by event, or both.
      </p>

      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Player</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
            <option value="all">All players</option>
            {db.roster.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Event</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
            <option value="all">All events</option>
            {TAGS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {summary.map(([type, n]) => (
            <button key={type} type="button" onClick={() => setEventType(type)}
              className={`px-2.5 py-1 text-xs rounded-full border ${eventType === type ? 'border-orange-500 text-orange-500' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {tagByType[type]?.label ?? type} · {n}
            </button>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{hits.length} result{hits.length === 1 ? '' : 's'}</h2>
        </div>
        {hits.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No matching plays recorded yet.</p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {hits.map((h) => (
              <Link key={h.event.id} href={`/dashboard/games/view?id=${h.sessionId}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/20">
                <span className="text-muted-foreground tabular-nums w-14 shrink-0">{fmtClock(h.event.t)}</span>
                <span className="font-medium text-foreground truncate w-40 shrink-0">#{h.playerNumber} {h.playerName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 shrink-0">{tagByType[h.event.type]?.label ?? h.event.type}</span>
                <span className="text-muted-foreground text-xs ml-auto shrink-0">{h.date} · vs {h.opponent}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
