'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BasketballCourt } from '@/components/basketball/court'
import {
  useDB,
  updateDB,
  uid,
  statLine,
  tagByType,
  TAGS,
  TAG_GROUPS,
  type SessionEvent,
} from '@/lib/basketball/store'

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function LiveRecorderPage() {
  const db = useDB()
  const router = useRouter()

  const [recording, setRecording] = useState(false)
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState<'home' | 'away'>('home')
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [oppScore, setOppScore] = useState(0)
  const [activePlayer, setActivePlayer] = useState('')
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [clock, setClock] = useState(0)
  const startRef = useRef(0)
  const courtRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!recording) return
    const idInt = setInterval(() => setClock((Date.now() - startRef.current) / 1000), 1000)
    return () => clearInterval(idInt)
  }, [recording])

  const teamScore = statLine(events).points

  function start() {
    if (!opponent.trim()) return
    startRef.current = Date.now()
    setEvents([])
    setOppScore(0)
    setClock(0)
    setRecording(true)
    if (!activePlayer && db.roster[0]) setActivePlayer(db.roster[0].id)
  }

  function addTag(type: string) {
    if (!recording || !activePlayer) return
    const t = (Date.now() - startRef.current) / 1000
    const ev: SessionEvent = { id: uid(), t, playerId: activePlayer, type }
    setEvents((prev) => [...prev, ev])
    const tag = tagByType[type]
    const p = db.roster.find((r) => r.id === activePlayer)
    setFlash(`${tag?.label} — ${p?.name.split(' ').slice(-1)[0] ?? ''}`)
    setTimeout(() => setFlash(null), 900)
    if (tag?.shot) setPendingShot(ev.id)
  }

  function markShot(e: React.MouseEvent) {
    if (!pendingShot || !courtRef.current) return
    const rect = courtRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setEvents((prev) => prev.map((ev) => (ev.id === pendingShot ? { ...ev, shot: { x, y } } : ev)))
    setPendingShot(null)
  }

  function finish() {
    const session = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      opponent: opponent.trim(),
      location,
      source: 'live' as const,
      events,
      movement: {},
      teamScore,
      oppScore,
      durationS: (Date.now() - startRef.current) / 1000,
    }
    updateDB((d) => ({ ...d, sessions: [...d.sessions, session] }))
    setRecording(false)
    setEvents([])
    router.push(`/dashboard/games/view?id=${session.id}`)
  }

  // Keyboard: letters tag, digits pick player.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!recording) return
      const digit = '1234567890'.indexOf(e.key)
      if (digit >= 0 && db.roster[digit]) {
        setActivePlayer(db.roster[digit].id)
        return
      }
      const tag = TAGS.find((t) => t.key === e.key.toLowerCase())
      if (tag) {
        e.preventDefault()
        addTag(tag.type)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, activePlayer, db.roster])

  if (db.roster.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-[900px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Live Recorder</h1>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center mt-6">
          <p className="text-foreground font-semibold mb-1">Add your roster first</p>
          <p className="text-sm text-muted-foreground mb-4">
            The live recorder tags real stats per player — you need at least one player.
          </p>
          <Link href="/dashboard/players"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">
            Add players
          </Link>
        </div>
      </div>
    )
  }

  if (!recording) {
    return (
      <div className="p-4 md:p-8 max-w-[700px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Live Recorder</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Courtside stat tracking. Tag every play as it happens — the box score builds itself.
        </p>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-muted-foreground mb-1">Opponent *</label>
              <input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Metro Hawks"
                className="w-full px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value as 'home' | 'away')}
                className="px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground">
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={start} disabled={!opponent.trim()}
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40">
            ● Start recording
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      {/* Scoreboard */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5 flex flex-wrap items-center justify-center gap-6 sticky top-0 md:static z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{db.settings.teamName}</p>
          <p className="text-4xl font-bold tabular-nums text-foreground">{teamScore}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">{fmtClock(clock)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{opponent}</p>
          <p className="text-4xl font-bold tabular-nums text-foreground">{oppScore}</p>
          <div className="flex gap-1 mt-1 justify-center">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => setOppScore((s) => s + n)}
                className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground">
                +{n}
              </button>
            ))}
            <button type="button" onClick={() => setOppScore((s) => Math.max(0, s - 1))}
              className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground">
              −1
            </button>
          </div>
        </div>
        <button type="button" onClick={finish}
          className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500">
          Finish & save
        </button>
      </div>

      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-orange-600 text-white text-sm font-semibold shadow-lg">
          {flash}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active player <span className="text-xs text-muted-foreground font-normal">(keys 1–0)</span>
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {db.roster.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setActivePlayer(p.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left truncate ${
                    activePlayer === p.id
                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  <span className="opacity-60 mr-1">{(i + 1) % 10}</span>#{p.number} {p.name.split(' ').slice(-1)[0]}
                </button>
              ))}
            </div>
          </div>

          {pendingShot ? (
            <div className="bg-card border-2 border-orange-500 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-orange-500 mb-2">Tap the shot location</h2>
              <div className="relative cursor-crosshair" onClick={markShot}>
                <BasketballCourt width={400} height={376} />
                <svg ref={courtRef} viewBox="0 0 100 100" preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full" />
              </div>
              <button type="button" onClick={() => setPendingShot(null)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground">
                Skip location
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Tag pad</h2>
              {TAG_GROUPS.map((g) => (
                <div key={g} className="mb-3 last:mb-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TAGS.filter((t) => t.group === g).map((t) => (
                      <button key={t.type} type="button" onClick={() => addTag(t.type)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-orange-500 hover:text-orange-500">
                        <kbd className="opacity-50 mr-1 uppercase">{t.key}</kbd>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Live box score</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Player', 'PTS', 'REB', 'AST', 'DEFL', 'STL', 'BLK', 'TOV'].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs uppercase font-medium text-muted-foreground text-center first:text-left first:px-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {db.roster
                    .filter((p) => events.some((e) => e.playerId === p.id))
                    .map((p) => {
                      const l = statLine(events, p.id)
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">#{p.number} {p.name.split(' ').slice(-1)[0]}</td>
                          <td className="px-3 py-2 text-center font-bold tabular-nums">{l.points}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.reb}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.ast}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.defl}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.stl}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.blk}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{l.tov}</td>
                        </tr>
                      )
                    })}
                  {events.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground text-sm">Tag the first play…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Event feed ({events.length})</h2>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {[...events].reverse().map((e) => {
                const p = db.roster.find((r) => r.id === e.playerId)
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-0">
                    <span className="text-muted-foreground tabular-nums w-12 shrink-0">{fmtClock(e.t)}</span>
                    <span className="font-medium text-foreground truncate">#{p?.number} {p?.name.split(' ').slice(-1)[0]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 ml-auto shrink-0">
                      {tagByType[e.type]?.label}
                    </span>
                    <button type="button"
                      onClick={() => setEvents((prev) => prev.filter((x) => x.id !== e.id))}
                      className="text-xs text-red-500 hover:underline shrink-0">
                      undo
                    </button>
                  </div>
                )
              })}
              {events.length === 0 && <p className="p-5 text-sm text-muted-foreground text-center">No events yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
