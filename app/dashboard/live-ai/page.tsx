'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LiveCourt } from '@/components/basketball/court'
import {
  useDB,
  updateDB,
  uid,
  statLine,
  tagByType,
  TAGS,
  TAG_GROUPS,
  type SessionEvent,
  type PlayerMovement,
} from '@/lib/basketball/store'
import { loadDetector, detectFrame, CentroidTracker, type DetectedBox } from '@/lib/basketball/detector'

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const DETECT_INTERVAL_MS = 450

export default function LiveAiTrackerPage() {
  const db = useDB()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const camStartRef = useRef(0)
  const trackerRef = useRef(new CentroidTracker())
  const modelRef = useRef<Awaited<ReturnType<typeof loadDetector>> | null>(null)
  const runningRef = useRef(false)
  const busyRef = useRef(false)
  const assignmentsRef = useRef<Record<number, string>>({})
  const movementRef = useRef<Record<string, { t: number; x: number; y: number }[]>>({})

  const [source, setSource] = useState<'none' | 'file' | 'camera'>('none')
  const [fileName, setFileName] = useState('')
  const [camError, setCamError] = useState<string | null>(null)
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [tracking, setTracking] = useState(false)
  const [boxes, setBoxes] = useState<DetectedBox[]>([])
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [assignPopover, setAssignPopover] = useState<number | null>(null)
  const [mode, setMode] = useState<'assign' | 'calibrate'>('assign')
  const [calPoints, setCalPoints] = useState<{ x: number; y: number }[]>([])
  const [calMeters, setCalMeters] = useState(28)
  const [metersPerUnit, setMetersPerUnit] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const [clock, setClock] = useState(0)
  const [activePlayer, setActivePlayer] = useState('')
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [flash, setFlash] = useState<string | null>(null)

  const [opponent, setOpponent] = useState('')
  const [gLocation, setGLocation] = useState<'home' | 'away'>('home')
  const [oppScore, setOppScore] = useState('')

  useEffect(() => {
    assignmentsRef.current = assignments
  }, [assignments])

  const now = useCallback((): number => {
    if (source === 'camera') return (Date.now() - camStartRef.current) / 1000
    return videoRef.current?.currentTime ?? 0
  }, [source])

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 500)
    return () => clearInterval(id)
  }, [now])

  function loadFile(file: File) {
    stopCamera()
    setSource('file')
    setFileName(file.name)
    trackerRef.current.reset()
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      const v = videoRef.current
      if (v) {
        v.src = ''
        v.srcObject = stream
        v.play().catch(() => {})
      }
      camStartRef.current = Date.now()
      trackerRef.current.reset()
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

  async function toggleTracking() {
    if (tracking) {
      setTracking(false)
      runningRef.current = false
      return
    }
    if (source === 'none') return
    if (modelState !== 'ready') {
      setModelState('loading')
      try {
        modelRef.current = await loadDetector()
        setModelState('ready')
      } catch {
        setModelState('error')
        return
      }
    }
    runningRef.current = true
    setTracking(true)
  }

  // Detection loop — runs on an interval so the browser controls pacing;
  // guarded so a slow detection pass never overlaps the next tick.
  useEffect(() => {
    if (!tracking) return
    const id = setInterval(async () => {
      if (busyRef.current || !runningRef.current) return
      const video = videoRef.current
      const model = modelRef.current
      if (!video || !model || video.readyState < 2) return
      busyRef.current = true
      try {
        const dets = await detectFrame(model, video, 0.45)
        const tracked = trackerRef.current.update(dets)
        setBoxes(tracked)
        const t = now()
        for (const b of tracked) {
          if (b.cls !== 'person') continue
          const playerId = assignmentsRef.current[b.trackId]
          if (!playerId) continue
          const cx = b.x + b.w / 2
          const cy = b.y + b.h / 2
          const arr = movementRef.current[playerId] ?? (movementRef.current[playerId] = [])
          arr.push({ t, x: cx, y: cy })
        }
        setTick((c) => c + 1)
      } finally {
        busyRef.current = false
      }
    }, DETECT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [tracking, now])

  const addTag = useCallback(
    (type: string) => {
      if (!activePlayer) return
      const ev: SessionEvent = { id: uid(), t: now(), playerId: activePlayer, type }
      setEvents((prev) => [...prev, ev])
      const tag = tagByType[type]
      const p = db.roster.find((r) => r.id === activePlayer)
      setFlash(`${tag?.label} — ${p?.name.split(' ').slice(-1)[0] ?? ''}`)
      setTimeout(() => setFlash(null), 900)
    },
    [activePlayer, now, db.roster]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const assignedIds = Object.values(assignmentsRef.current)
      const digit = '1234567890'.indexOf(e.key)
      if (digit >= 0 && assignedIds[digit]) {
        setActivePlayer(assignedIds[digit])
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
  }, [addTag])

  function onOverlayClick(e: React.MouseEvent) {
    if (mode !== 'calibrate' || !boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
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
  }

  function assignTrack(trackId: number, playerId: string) {
    setAssignments((prev) => ({ ...prev, [trackId]: playerId }))
    setActivePlayer((cur) => cur || playerId)
    setAssignPopover(null)
  }
  function unassignTrack(trackId: number) {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[trackId]
      return next
    })
    setAssignPopover(null)
  }

  // Movement summary, recomputed whenever a detection tick lands.
  const movementByPlayer: Record<string, PlayerMovement> = {}
  if (metersPerUnit) {
    for (const [playerId, pts] of Object.entries(movementRef.current)) {
      let dist = 0
      let maxSpeed = 0
      for (let i = 1; i < pts.length; i++) {
        const dt = pts[i].t - pts[i - 1].t
        if (dt <= 0 || dt > 3) continue // gap = likely occlusion/ID loss, skip to avoid false distance
        const dx = (pts[i].x - pts[i - 1].x) * (boxRef.current?.clientWidth ?? 1)
        const dy = (pts[i].y - pts[i - 1].y) * (boxRef.current?.clientHeight ?? 1)
        const d = Math.sqrt(dx * dx + dy * dy) * metersPerUnit
        if (d / dt > 12) continue // > 43 km/h is a tracker glitch, not a real sprint — drop it
        dist += d
        maxSpeed = Math.max(maxSpeed, d / dt)
      }
      const stride = db.roster.find((p) => p.id === playerId)?.strideLength ?? 2.5
      movementByPlayer[playerId] = { distanceM: dist, maxSpeedKmh: maxSpeed * 3.6, strides: dist > 0 ? Math.round(dist / stride) : 0 }
    }
  }

  const ballBox = boxes.find((b) => b.cls === 'sports ball')
  const assignedRows = db.roster.filter((p) => Object.values(assignments).includes(p.id))
  const courtPositions = boxes
    .filter((b) => b.cls === 'person' && assignments[b.trackId])
    .map((b) => {
      const p = db.roster.find((r) => r.id === assignments[b.trackId])
      return {
        playerId: b.trackId.toString(),
        x: (b.x + b.w / 2) * 100,
        y: (b.y + b.h / 2) * 100,
        hasBall: false,
        label: p ? `#${p.number}` : '?',
      }
    })

  function saveSession() {
    if (!opponent.trim()) return
    const line = statLine(events)
    const session = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      opponent: opponent.trim(),
      location: gLocation,
      source: 'ai' as const,
      events,
      movement: movementByPlayer,
      teamScore: line.points,
      oppScore: Number(oppScore) || 0,
      durationS: clock,
    }
    updateDB((d) => ({ ...d, sessions: [...d.sessions, session] }))
    router.push(`/dashboard/games/view?id=${session.id}`)
  }

  if (db.roster.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-[900px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Live AI Tracker</h1>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center mt-6">
          <p className="text-foreground font-semibold mb-1">Add your roster first</p>
          <p className="text-sm text-muted-foreground mb-4">
            You need at least one player to assign to a detected track.
          </p>
          <Link href="/dashboard/players" className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">
            Add players
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1500px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Live AI Tracker</h1>
      <p className="text-sm text-muted-foreground mb-1">
        On-device AI (runs on your GPU via WebGL, nothing uploaded) detects people and the ball live
        from your camera or an uploaded video, and follows each box across frames.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Honest limits: it detects <b>where</b> people and the ball are, not jersey numbers — assign a
        roster name to a box once and the tracker keeps following it. If a box&apos;s label ever jumps
        to the wrong player (after two people cross paths), just reassign it.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 cursor-pointer">
              Upload game video
              <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </label>
            <button type="button" onClick={startCamera} className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50">
              Use laptop camera
            </button>
            <button
              type="button"
              onClick={toggleTracking}
              disabled={source === 'none' || modelState === 'loading'}
              className={`px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40 ${
                tracking ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {modelState === 'loading' ? 'Loading AI model…' : tracking ? '■ Stop AI tracking' : '▶ Start AI tracking'}
            </button>
            {source !== 'none' && (
              <span className="self-center text-xs text-muted-foreground truncate max-w-[200px]">{fileName} · {fmtClock(clock)}</span>
            )}
          </div>
          {camError && <p className="text-sm text-red-500 mb-3">{camError}</p>}
          {modelState === 'error' && <p className="text-sm text-red-500 mb-3">Could not load the AI model — check your connection and retry.</p>}

          <div
            ref={boxRef}
            onClick={onOverlayClick}
            className={`relative bg-black rounded-xl overflow-hidden border border-border ${mode === 'calibrate' ? 'cursor-crosshair' : ''}`}
            style={{ aspectRatio: '16 / 9' }}
          >
            <video ref={videoRef} playsInline controls={source === 'file'} className="w-full h-full object-contain" />
            {source === 'none' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <p className="text-white/90 font-semibold">No video source</p>
                <p className="text-white/50 text-sm mt-1">Upload a game recording or start the laptop camera to begin.</p>
              </div>
            )}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {calPoints.length === 2 && (
                <line x1={calPoints[0].x * 100} y1={calPoints[0].y * 100} x2={calPoints[1].x * 100} y2={calPoints[1].y * 100} stroke="#facc15" strokeWidth="0.4" strokeDasharray="1.5 1" />
              )}
              {calPoints.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 100} r="0.9" fill="#facc15" />)}
              {boxes.map((b) => {
                const isBall = b.cls === 'sports ball'
                const playerId = assignments[b.trackId]
                const player = playerId ? db.roster.find((p) => p.id === playerId) : null
                const label = isBall ? 'BALL' : player ? `#${player.number} ${player.name.split(' ').slice(-1)[0]}` : `track ${b.trackId}`
                const color = isBall ? '#f97316' : player ? '#22c55e' : '#94a3b8'
                return (
                  <g
                    key={`${b.cls}-${b.trackId}`}
                    style={{ pointerEvents: mode === 'assign' && !isBall ? 'auto' : 'none', cursor: 'pointer' }}
                    onClick={(e) => {
                      if (mode !== 'assign' || isBall) return
                      e.stopPropagation()
                      setAssignPopover(b.trackId)
                    }}
                  >
                    <rect x={b.x * 100} y={b.y * 100} width={b.w * 100} height={b.h * 100} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <rect x={b.x * 100} y={Math.max(0, b.y * 100 - 4.2)} width={Math.min(96, label.length * 1.7 + 2)} height="4" fill={color} />
                    <text x={b.x * 100 + 0.8} y={Math.max(0, b.y * 100 - 4.2) + 3} fontSize="3" fontWeight="700" fill="#000">{label}</text>
                  </g>
                )
              })}
            </svg>
            {flash && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-orange-600 text-white text-sm font-semibold shadow-lg">{flash}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {([['assign', 'Assign mode'], ['calibrate', 'Calibrate court']] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg border ${mode === m ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
            {mode === 'assign' && <span className="text-xs text-muted-foreground">Click a gray box to name it.</span>}
            {mode === 'calibrate' && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Click 2 court points spanning
                <input type="number" min={1} max={40} value={calMeters} onChange={(e) => setCalMeters(Number(e.target.value) || 28)}
                  className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground" />
                meters
              </span>
            )}
            <span className={`ml-auto text-xs px-2.5 py-1 rounded-full ${metersPerUnit ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
              {metersPerUnit ? 'Court calibrated' : 'Not calibrated — distances unavailable'}
            </span>
          </div>

          {assignPopover != null && (
            <div className="mt-3 bg-card border border-orange-500 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Assign track #{assignPopover}</p>
                <button type="button" onClick={() => setAssignPopover(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {db.roster.map((p) => (
                  <button key={p.id} type="button" onClick={() => assignTrack(assignPopover, p.id)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-green-500 hover:text-green-500">
                    #{p.number} {p.name}
                  </button>
                ))}
                {assignmentsRef.current[assignPopover] && (
                  <button type="button" onClick={() => unassignTrack(assignPopover)} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-500 text-red-500">
                    Unassign
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live court minimap */}
          <div className="mt-4 bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Live Court</h2>
            <LiveCourt
              playerPositions={courtPositions}
              ballPosition={ballBox ? { x: (ballBox.x + ballBox.w / 2) * 100, y: (ballBox.y + ballBox.h / 2) * 100 } : { x: 50, y: 50 }}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Tracked boxes ({boxes.length})</h2>
            <p className="text-xs text-muted-foreground mb-2">
              {boxes.filter((b) => b.cls === 'person').length} people · {boxes.filter((b) => b.cls === 'sports ball').length} ball
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {boxes.filter((b) => b.cls === 'person').map((b) => {
                const p = assignments[b.trackId] ? db.roster.find((r) => r.id === assignments[b.trackId]) : null
                return (
                  <button key={b.trackId} type="button" onClick={() => setAssignPopover(b.trackId)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg border border-border hover:border-orange-500">
                    <span className={p ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                      {p ? `#${p.number} ${p.name}` : `Unassigned track #${b.trackId}`}
                    </span>
                    <span className="text-muted-foreground">{(b.score * 100).toFixed(0)}%</span>
                  </button>
                )
              })}
              {boxes.length === 0 && <p className="text-xs text-muted-foreground">Start tracking to detect people and the ball.</p>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active player for tags <span className="text-xs text-muted-foreground font-normal">(keys 1–0)</span>
            </h2>
            {assignedRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Assign a tracked box to a player to tag stats for them.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {assignedRows.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setActivePlayer(p.id)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left truncate ${
                      activePlayer === p.id ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    <span className="opacity-60 mr-1">{(i + 1) % 10}</span>#{p.number} {p.name.split(' ').slice(-1)[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Tag pad</h2>
            {TAG_GROUPS.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.filter((t) => t.group === g).map((t) => (
                    <button key={t.type} type="button" onClick={() => addTag(t.type)} disabled={!activePlayer}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-orange-500 hover:text-orange-500 disabled:opacity-40">
                      <kbd className="opacity-50 mr-1 uppercase">{t.key}</kbd>{t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Save as game</h2>
            <div className="space-y-2.5">
              <input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Opponent name *"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
              <div className="flex gap-2">
                <select value={gLocation} onChange={(e) => setGLocation(e.target.value as 'home' | 'away')}
                  className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
                <input value={oppScore} onChange={(e) => setOppScore(e.target.value)} type="number" min="0" placeholder="Opp. score"
                  className="w-28 px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground" />
              </div>
              <button type="button" onClick={saveSession} disabled={!opponent.trim()}
                className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40">
                Save session ({events.length} events, {assignedRows.length} tracked players)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live stat readout */}
      {assignedRows.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Live Stats</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Player', 'PTS', 'REB', 'AST', 'DEFL', 'STL', 'BLK', 'DIST', 'STRIDES', 'MAX SPD'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs uppercase font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedRows.map((p) => {
                  const l = statLine(events, p.id)
                  const mv = movementByPlayer[p.id]
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">#{p.number} {p.name}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">{l.points}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.reb}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.ast}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.defl}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.stl}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.blk}</td>
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
      )}
    </div>
  )
}
