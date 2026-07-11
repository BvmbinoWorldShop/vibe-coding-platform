'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { players as roster } from '@/lib/basketball/mock-data'

// A tracked court position, in coordinates relative to the video box (0..1).
type TrackPoint = { t: number; x: number; y: number }
type TagEvent = { id: number; t: number; playerId: string; type: string }
type Mode = 'tag' | 'track' | 'calibrate'

const TAGS: { key: string; label: string; type: string; pts?: number; group: string }[] = [
  { key: 'q', label: '2PT Made', type: 'fg2m', pts: 2, group: 'Scoring' },
  { key: 'w', label: '2PT Miss', type: 'fg2x', group: 'Scoring' },
  { key: 'e', label: '3PT Made', type: 'fg3m', pts: 3, group: 'Scoring' },
  { key: 'r', label: '3PT Miss', type: 'fg3x', group: 'Scoring' },
  { key: 't', label: 'FT Made', type: 'ftm', pts: 1, group: 'Scoring' },
  { key: 'y', label: 'FT Miss', type: 'ftx', group: 'Scoring' },
  { key: 'a', label: 'Assist', type: 'ast', group: 'Playmaking' },
  { key: 's', label: 'Hockey Assist', type: 'hast', group: 'Playmaking' },
  { key: 'v', label: 'Screen Assist', type: 'sast', group: 'Playmaking' },
  { key: 'u', label: 'Turnover', type: 'tov', group: 'Playmaking' },
  { key: 'd', label: 'Deflection', type: 'defl', group: 'Defense' },
  { key: 'f', label: 'Steal', type: 'stl', group: 'Defense' },
  { key: 'g', label: 'Block', type: 'blk', group: 'Defense' },
  { key: 'm', label: 'Contested Shot', type: 'cont', group: 'Defense' },
  { key: 'o', label: 'Charge Drawn', type: 'chg', group: 'Defense' },
  { key: 'z', label: 'Off Rebound', type: 'oreb', group: 'Hustle' },
  { key: 'x', label: 'Def Rebound', type: 'dreb', group: 'Hustle' },
  { key: 'c', label: 'Tip', type: 'tip', group: 'Hustle' },
  { key: 'b', label: 'Loose Ball', type: 'loose', group: 'Hustle' },
  { key: 'n', label: 'Box Out', type: 'boxout', group: 'Hustle' },
  { key: 'i', label: 'Foul', type: 'pf', group: 'Hustle' },
]
const TAG_GROUPS = ['Scoring', 'Playmaking', 'Defense', 'Hustle']
const tagByType = Object.fromEntries(TAGS.map((t) => [t.type, t]))

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function VideoAnalysisPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const camStartRef = useRef<number>(0)
  const eventIdRef = useRef(1)

  const [source, setSource] = useState<'none' | 'file' | 'camera'>('none')
  const [fileName, setFileName] = useState('')
  const [camError, setCamError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('tag')
  const [activePlayer, setActivePlayer] = useState(roster[0].id)
  const [events, setEvents] = useState<TagEvent[]>([])
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({})
  const [calPoints, setCalPoints] = useState<{ x: number; y: number }[]>([])
  const [calMeters, setCalMeters] = useState(28) // full court length by default
  const [metersPerUnit, setMetersPerUnit] = useState<number | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [clock, setClock] = useState(0)

  // Current position on the session timeline (video time or camera elapsed).
  const now = useCallback((): number => {
    if (source === 'camera') return (Date.now() - camStartRef.current) / 1000
    return videoRef.current?.currentTime ?? 0
  }, [source])

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 500)
    return () => clearInterval(id)
  }, [now])

  // Distance between two relative points, in meters (uses the current box
  // aspect so horizontal and vertical pixels weigh correctly).
  const relDistMeters = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }): number | null => {
      const box = boxRef.current
      if (!box || !metersPerUnit) return null
      const dx = (a.x - b.x) * box.clientWidth
      const dy = (a.y - b.y) * box.clientHeight
      return Math.sqrt(dx * dx + dy * dy) * metersPerUnit
    },
    [metersPerUnit]
  )

  function loadFile(file: File) {
    stopCamera()
    setSource('file')
    setFileName(file.name)
    const v = videoRef.current
    if (v) {
      v.srcObject = null
      v.src = URL.createObjectURL(file)
      v.play().catch(() => {})
    }
  }

  async function startCamera() {
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      })
      const v = videoRef.current
      if (v) {
        v.src = ''
        v.srcObject = stream
        v.play().catch(() => {})
      }
      camStartRef.current = Date.now()
      setSource('camera')
      setFileName('Live camera')
    } catch {
      setCamError('Camera access denied or unavailable. Allow camera permission and retry.')
    }
  }

  function stopCamera() {
    const v = videoRef.current
    const stream = v?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (v) v.srcObject = null
  }
  useEffect(() => stopCamera, [])

  const addTag = useCallback(
    (type: string) => {
      if (source === 'none') return
      const tag = tagByType[type]
      setEvents((prev) => [...prev, { id: eventIdRef.current++, t: now(), playerId: activePlayer, type }])
      setFlash(`${tag.label} — ${roster.find((p) => p.id === activePlayer)?.lastName}`)
      setTimeout(() => setFlash(null), 900)
    },
    [source, activePlayer, now]
  )

  // Keyboard shortcuts: letters tag stats, digits switch player, space pauses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const digit = '1234567890'.indexOf(e.key)
      if (digit >= 0 && roster[digit]) {
        setActivePlayer(roster[digit].id)
        return
      }
      const tag = TAGS.find((t) => t.key === e.key.toLowerCase())
      if (tag) {
        e.preventDefault()
        addTag(tag.type)
      }
      if (e.key === ' ' && source === 'file') {
        e.preventDefault()
        const v = videoRef.current
        if (v) (v.paused ? v.play() : Promise.resolve(v.pause())).catch?.(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addTag, source])

  function onOverlayClick(e: React.MouseEvent) {
    const box = boxRef.current
    if (!box || source === 'none') return
    const rect = box.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (mode === 'calibrate') {
      setCalPoints((prev) => {
        const next = [...prev, { x, y }].slice(-2)
        if (next.length === 2) {
          const dx = (next[0].x - next[1].x) * rect.width
          const dy = (next[0].y - next[1].y) * rect.height
          const px = Math.sqrt(dx * dx + dy * dy)
          if (px > 4) setMetersPerUnit(calMeters / px)
        }
        return next
      })
    } else if (mode === 'track') {
      setTracks((prev) => ({
        ...prev,
        [activePlayer]: [...(prev[activePlayer] ?? []), { t: now(), x, y }],
      }))
    }
  }

  // Per-player movement + tagged stats.
  const sheet = useMemo(() => {
    return roster.map((p) => {
      const pts = tracks[p.id] ?? []
      let dist = 0
      let maxSpeed = 0
      for (let i = 1; i < pts.length; i++) {
        const d = relDistMeters(pts[i - 1], pts[i])
        const dt = pts[i].t - pts[i - 1].t
        if (d == null || dt <= 0.2 || dt > 60) continue
        dist += d
        maxSpeed = Math.max(maxSpeed, d / dt)
      }
      const mine = events.filter((e) => e.playerId === p.id)
      const count = (type: string) => mine.filter((e) => e.type === type).length
      const points = mine.reduce((a, e) => a + (tagByType[e.type]?.pts ?? 0), 0)
      const strides = dist > 0 ? Math.round(dist / p.strideLength) : 0
      return {
        player: p,
        points,
        fg: `${count('fg2m') + count('fg3m')}-${count('fg2m') + count('fg3m') + count('fg2x') + count('fg3x')}`,
        ast: count('ast'),
        hast: count('hast'),
        defl: count('defl'),
        stl: count('stl'),
        blk: count('blk'),
        reb: count('oreb') + count('dreb'),
        tip: count('tip'),
        loose: count('loose'),
        dist,
        strides,
        maxSpeed: maxSpeed * 3.6, // km/h
        tagged: mine.length,
        trackPts: pts.length,
      }
    })
  }, [events, tracks, relDistMeters])

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: fileName,
      calibration: metersPerUnit ? { metersPerUnit, referenceMeters: calMeters } : null,
      events: events.map((e) => ({ ...e, label: tagByType[e.type]?.label })),
      tracks,
      statSheet: sheet
        .filter((r) => r.tagged > 0 || r.trackPts > 0)
        .map((r) => ({
          player: `${r.player.firstName} ${r.player.lastName}`,
          points: r.points,
          assists: r.ast,
          hockeyAssists: r.hast,
          deflections: r.defl,
          steals: r.stl,
          blocks: r.blk,
          rebounds: r.reb,
          distanceMeters: +r.dist.toFixed(1),
          estimatedStrides: r.strides,
          maxSpeedKmh: +r.maxSpeed.toFixed(1),
        })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ball-analysis-session-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const lastTrail = (tracks[activePlayer] ?? []).slice(-12)

  return (
    <div className="p-4 md:p-8 max-w-[1500px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Video Analysis</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Track a game from your camera or an uploaded video. Tag stats with hotkeys while it plays,
        calibrate the court once to measure real distance, speed and strides per player.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Left: video + transport */}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 cursor-pointer">
              Upload game video
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
              />
            </label>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50"
            >
              Use laptop camera
            </button>
            {source !== 'none' && (
              <span className="self-center text-xs text-muted-foreground truncate max-w-[200px]">
                {fileName} · {fmtClock(clock)}
              </span>
            )}
          </div>
          {camError && <p className="text-sm text-red-500 mb-3">{camError}</p>}

          <div
            ref={boxRef}
            onClick={onOverlayClick}
            className={`relative bg-black rounded-xl overflow-hidden border border-border ${
              mode !== 'tag' ? 'cursor-crosshair' : ''
            }`}
            style={{ aspectRatio: '16 / 9' }}
          >
            <video ref={videoRef} playsInline controls={source === 'file'} className="w-full h-full object-contain" />
            {source === 'none' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <p className="text-white/90 font-semibold">No video source</p>
                <p className="text-white/50 text-sm mt-1">
                  Upload a game recording or start the laptop camera to begin a session.
                </p>
              </div>
            )}
            {/* Overlay: calibration line + movement trail */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {calPoints.length === 2 && (
                <line
                  x1={calPoints[0].x * 100}
                  y1={calPoints[0].y * 100}
                  x2={calPoints[1].x * 100}
                  y2={calPoints[1].y * 100}
                  stroke="#facc15"
                  strokeWidth="0.4"
                  strokeDasharray="1.5 1"
                />
              )}
              {calPoints.map((p, i) => (
                <circle key={i} cx={p.x * 100} cy={p.y * 100} r="0.9" fill="#facc15" />
              ))}
              {lastTrail.length > 1 && (
                <polyline
                  points={lastTrail.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="0.4"
                  strokeOpacity="0.9"
                />
              )}
              {lastTrail.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r={i === lastTrail.length - 1 ? 1.1 : 0.6}
                  fill="#f97316"
                  fillOpacity={i === lastTrail.length - 1 ? 1 : 0.55}
                />
              ))}
            </svg>
            {flash && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-orange-600 text-white text-sm font-semibold shadow-lg">
                {flash}
              </div>
            )}
          </div>

          {/* Mode + calibration */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {(
              [
                ['tag', 'Tag mode'],
                ['track', 'Track movement'],
                ['calibrate', 'Calibrate court'],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg border ${
                  mode === m
                    ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
            {mode === 'calibrate' && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Click 2 court points spanning
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={calMeters}
                  onChange={(e) => setCalMeters(Number(e.target.value) || 28)}
                  className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground"
                />
                meters (28 = full court, 15 = width)
              </span>
            )}
            {mode === 'track' && (
              <span className="text-xs text-muted-foreground">
                Click the active player&apos;s position as they move — each click adds a waypoint.
              </span>
            )}
            <span
              className={`ml-auto text-xs px-2.5 py-1 rounded-full ${
                metersPerUnit ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
              }`}
            >
              {metersPerUnit ? 'Court calibrated' : 'Not calibrated — distances unavailable'}
            </span>
          </div>
        </div>

        {/* Right: players + tag pad */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active player <span className="text-xs text-muted-foreground font-normal">(keys 1–0)</span>
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {roster.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePlayer(p.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left truncate ${
                    activePlayer === p.id
                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="opacity-60 mr-1">{(i + 1) % 10}</span>#{p.number} {p.lastName}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Tag pad <span className="text-xs text-muted-foreground font-normal">(hotkeys shown)</span>
            </h2>
            {TAG_GROUPS.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.filter((t) => t.group === g).map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => addTag(t.type)}
                      disabled={source === 'none'}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-orange-500 hover:text-orange-500 disabled:opacity-40"
                    >
                      <kbd className="opacity-50 mr-1 uppercase">{t.key}</kbd>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session stat sheet */}
      <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Session Stat Sheet</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              disabled={events.length === 0 && Object.keys(tracks).length === 0}
              className="px-3.5 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50 disabled:opacity-40"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => {
                setEvents([])
                setTracks({})
              }}
              disabled={events.length === 0 && Object.keys(tracks).length === 0}
              className="px-3.5 py-2 text-sm font-medium rounded-lg border border-border text-red-500 hover:bg-red-500/10 disabled:opacity-40"
            >
              Clear session
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Player', 'PTS', 'FG', 'AST', 'HCKY AST', 'DEFL', 'STL', 'BLK', 'REB', 'TIP', 'LOOSE', 'DIST', 'STRIDES', 'MAX SPD'].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet
                .filter((r) => r.tagged > 0 || r.trackPts > 0)
                .map((r) => (
                  <tr key={r.player.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                      #{r.player.number} {r.player.firstName} {r.player.lastName}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold">{r.points}</td>
                    <td className="px-3 py-2.5 text-center">{r.fg}</td>
                    <td className="px-3 py-2.5 text-center">{r.ast}</td>
                    <td className="px-3 py-2.5 text-center">{r.hast}</td>
                    <td className="px-3 py-2.5 text-center">{r.defl}</td>
                    <td className="px-3 py-2.5 text-center">{r.stl}</td>
                    <td className="px-3 py-2.5 text-center">{r.blk}</td>
                    <td className="px-3 py-2.5 text-center">{r.reb}</td>
                    <td className="px-3 py-2.5 text-center">{r.tip}</td>
                    <td className="px-3 py-2.5 text-center">{r.loose}</td>
                    <td className="px-3 py-2.5 text-center">{metersPerUnit ? `${r.dist.toFixed(0)} m` : '—'}</td>
                    <td className="px-3 py-2.5 text-center">{metersPerUnit && r.strides > 0 ? r.strides : '—'}</td>
                    <td className="px-3 py-2.5 text-center">{metersPerUnit && r.maxSpeed > 0 ? `${r.maxSpeed.toFixed(1)} km/h` : '—'}</td>
                  </tr>
                ))}
              {sheet.every((r) => r.tagged === 0 && r.trackPts === 0) && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">
                    No data yet — load a video, then tag stats or track movement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="mt-5 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Event Timeline <span className="text-sm text-muted-foreground font-normal">({events.length} events — click to jump)</span>
            </h2>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {[...events].reverse().map((e) => {
              const p = roster.find((r) => r.id === e.playerId)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    if (source === 'file' && videoRef.current) videoRef.current.currentTime = e.t
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/20 text-left"
                >
                  <span className="text-muted-foreground tabular-nums w-12 shrink-0">{fmtClock(e.t)}</span>
                  <span className="font-medium text-foreground truncate">
                    #{p?.number} {p?.lastName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 ml-auto shrink-0">
                    {tagByType[e.type]?.label}
                  </span>
                  <span
                    className="text-xs text-red-500 hover:underline shrink-0"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setEvents((prev) => prev.filter((x) => x.id !== e.id))
                    }}
                  >
                    remove
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Distances and speeds are measured from your court calibration and waypoint clicks — the same
        assisted-tracking workflow used by professional team analysts. Automatic optical player
        tracking can be layered on later; the session format already stores everything per player
        so workouts can be adapted to measured strengths and weaknesses.
      </p>
    </div>
  )
}
