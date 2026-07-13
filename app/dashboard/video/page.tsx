'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type PlayerMovement,
} from '@/lib/basketball/store'
import { extractFrames, extractFramesAt, analyzeFrames, confirmShotOutcome, type AiEvent, type ShotOutcome } from '@/lib/basketball/ai'
import { loadDetector, detectFrame } from '@/lib/basketball/detector'

type TrackPoint = { t: number; x: number; y: number }
type Mode = 'tag' | 'track' | 'calibrate' | 'hoop'
interface ScanProposal { id: string; t: number; outcome: ShotOutcome }

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function VideoAnalysisPage() {
  const db = useDB()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const courtRef = useRef<SVGSVGElement>(null)
  const camStartRef = useRef(0)

  const [source, setSource] = useState<'none' | 'file' | 'camera'>('none')
  const [fileName, setFileName] = useState('')
  const [camError, setCamError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('tag')
  const [activePlayer, setActivePlayer] = useState('')
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({})
  const [calPoints, setCalPoints] = useState<{ x: number; y: number }[]>([])
  const [calMeters, setCalMeters] = useState(28)
  const [metersPerUnit, setMetersPerUnit] = useState<number | null>(null)
  const [pendingShot, setPendingShot] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [clock, setClock] = useState(0)

  // AI panel state
  const [aiStart, setAiStart] = useState(0)
  const [aiEnd, setAiEnd] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<AiEvent[]>([])

  // Scoring-play scan (hoop heuristic + AI confirmation)
  const [hoopPoint, setHoopPoint] = useState<{ x: number; y: number } | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanProposals, setScanProposals] = useState<ScanProposal[]>([])

  // Save form
  const [opponent, setOpponent] = useState('')
  const [gLocation, setGLocation] = useState<'home' | 'away'>('home')
  const [oppScore, setOppScore] = useState('')

  useEffect(() => {
    if (!activePlayer && db.roster[0]) setActivePlayer(db.roster[0].id)
  }, [db.roster, activePlayer])

  const now = useCallback((): number => {
    if (source === 'camera') return (Date.now() - camStartRef.current) / 1000
    return videoRef.current?.currentTime ?? 0
  }, [source])

  useEffect(() => {
    const idInt = setInterval(() => setClock(now()), 500)
    return () => clearInterval(idInt)
  }, [now])

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
    (type: string, at?: number, playerId?: string) => {
      if (source === 'none') return
      const pid = playerId ?? activePlayer
      if (!pid) return
      const ev: SessionEvent = { id: uid(), t: at ?? now(), playerId: pid, type }
      setEvents((prev) => [...prev, ev].sort((a, b) => a.t - b.t))
      const tag = tagByType[type]
      const p = db.roster.find((r) => r.id === pid)
      setFlash(`${tag?.label} — ${p?.name.split(' ').slice(-1)[0] ?? ''}`)
      setTimeout(() => setFlash(null), 900)
      if (tag?.shot && at === undefined) setPendingShot(ev.id)
    },
    [source, activePlayer, now, db.roster]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
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
      if (e.key === ' ' && source === 'file') {
        e.preventDefault()
        const v = videoRef.current
        if (v) {
          if (v.paused) v.play().catch(() => {})
          else v.pause()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addTag, source, db.roster])

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
    } else if (mode === 'track' && activePlayer) {
      setTracks((prev) => ({
        ...prev,
        [activePlayer]: [...(prev[activePlayer] ?? []), { t: now(), x, y }],
      }))
    } else if (mode === 'hoop') {
      setHoopPoint({ x, y })
    }
  }

  function markShot(e: React.MouseEvent) {
    if (!pendingShot || !courtRef.current) return
    const rect = courtRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setEvents((prev) => prev.map((ev) => (ev.id === pendingShot ? { ...ev, shot: { x, y } } : ev)))
    setPendingShot(null)
  }

  const movement = useMemo((): Record<string, PlayerMovement> => {
    const box = boxRef.current
    const result: Record<string, PlayerMovement> = {}
    if (!box || !metersPerUnit) return result
    for (const [pid, pts] of Object.entries(tracks)) {
      let dist = 0
      let maxSpeed = 0
      for (let i = 1; i < pts.length; i++) {
        const dx = (pts[i].x - pts[i - 1].x) * box.clientWidth
        const dy = (pts[i].y - pts[i - 1].y) * box.clientHeight
        const d = Math.sqrt(dx * dx + dy * dy) * metersPerUnit
        const dt = pts[i].t - pts[i - 1].t
        if (dt <= 0.2 || dt > 60) continue
        dist += d
        maxSpeed = Math.max(maxSpeed, d / dt)
      }
      const stride = db.roster.find((p) => p.id === pid)?.strideLength ?? 2.5
      result[pid] = {
        distanceM: dist,
        maxSpeedKmh: maxSpeed * 3.6,
        strides: dist > 0 ? Math.round(dist / stride) : 0,
      }
    }
    return result
  }, [tracks, metersPerUnit, db.roster])

  async function runAi() {
    const v = videoRef.current
    if (!v || source !== 'file') return
    setAiBusy(true)
    setAiError(null)
    try {
      const frames = await extractFrames(v, aiStart, aiEnd, 1)
      if (frames.length === 0) throw new Error('No frames extracted — check the clip range.')
      const rosterHint = db.roster.map((p) => `#${p.number} ${p.name}`).join(', ')
      const found = await analyzeFrames(db.settings.mistralKey, frames, rosterHint)
      setProposals(found)
      if (found.length === 0) setAiError('AI found no clear events in this clip. Try a different range.')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAiBusy(false)
    }
  }

  function acceptProposal(p: AiEvent) {
    const byJersey = p.jersey != null ? db.roster.find((r) => r.number === p.jersey) : undefined
    addTag(p.type, p.t, byJersey?.id ?? activePlayer)
    setProposals((prev) => prev.filter((x) => x !== p))
  }

  // Scans the clip for ball-near-hoop moments (on-device, timecode-seeked —
  // works the same whether the footage plays back slow or fast, since it
  // steps through exact timestamps rather than watching in real time), then
  // confirms each candidate's outcome with AI vision.
  async function scanForScoringPlays() {
    const video = videoRef.current
    if (!video || source !== 'file' || !hoopPoint || !db.settings.mistralKey) return
    setScanBusy(true)
    setScanError(null)
    setScanProposals([])
    const wasPaused = video.paused
    video.pause()
    try {
      setScanStatus('Loading on-device detector…')
      const model = await loadDetector()
      const duration = isFinite(video.duration) ? video.duration : aiEnd
      const scanEndT = Math.min(duration, aiEnd || duration)
      const scanStartT = Math.max(0, aiStart || 0)
      const step = 0.4
      const candidates: number[] = []
      let lastCandidate = -Infinity
      for (let t = scanStartT; t <= scanEndT && candidates.length < 10; t += step) {
        setScanStatus(`Scanning ${fmtClock(t)} / ${fmtClock(scanEndT)}…`)
        await new Promise<void>((resolve, reject) => {
          const onSeek = () => {
            video.removeEventListener('seeked', onSeek)
            resolve()
          }
          video.addEventListener('seeked', onSeek)
          video.currentTime = t
          setTimeout(() => reject(new Error('seek timeout')), 4000)
        }).catch(() => {})
        const dets = await detectFrame(model, video, 0.4)
        const ball = dets.find((d) => d.cls === 'sports ball')
        if (ball) {
          const cx = ball.x + ball.w / 2
          const cy = ball.y + ball.h / 2
          const dist = Math.hypot(cx - hoopPoint.x, cy - hoopPoint.y)
          if (dist < 0.09 && t - lastCandidate > 3) {
            candidates.push(t)
            lastCandidate = t
          }
        }
      }
      if (candidates.length === 0) {
        setScanError('No ball-near-hoop moments found in this range. Try re-marking the hoop or widening the clip range.')
        return
      }
      setScanStatus(`Found ${candidates.length} candidate moment(s) — confirming with AI…`)
      const rosterHint = db.roster.map((p) => `#${p.number} ${p.name}`).join(', ')
      const results: ScanProposal[] = []
      for (const t of candidates) {
        try {
          const frames = await extractFramesAt(video, [Math.max(0, t - 0.6), Math.max(0, t - 0.3), t, t + 0.3])
          const outcome = await confirmShotOutcome(db.settings.mistralKey, frames, rosterHint)
          if (outcome.attempted) results.push({ id: uid(), t, outcome })
        } catch {
          // skip this candidate, keep scanning the rest
        }
      }
      setScanProposals(results)
      if (results.length === 0) setScanError('AI did not confirm a shot attempt among the candidates found.')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanStatus(null)
      setScanBusy(false)
      if (!wasPaused) video.play().catch(() => {})
    }
  }

  function acceptScanProposal(sp: ScanProposal) {
    const o = sp.outcome
    const shotCode = o.shotType === '3PT' ? (o.made ? 'fg3m' : 'fg3x') : o.shotType === 'FT' ? (o.made ? 'ftm' : 'ftx') : o.made ? 'fg2m' : 'fg2x'
    const shooter = o.shooterJersey != null ? db.roster.find((p) => p.number === o.shooterJersey) : undefined
    if (shooter) addTag(shotCode, sp.t, shooter.id)
    if (o.made) {
      const assister = o.assistJersey != null ? db.roster.find((p) => p.number === o.assistJersey) : undefined
      if (assister) addTag('ast', sp.t - 0.1, assister.id)
      const hockey = o.hockeyAssistJersey != null ? db.roster.find((p) => p.number === o.hockeyAssistJersey) : undefined
      if (hockey) addTag('hast', sp.t - 0.2, hockey.id)
    } else {
      const blocker = o.blockedByJersey != null ? db.roster.find((p) => p.number === o.blockedByJersey) : undefined
      if (blocker) addTag('blk', sp.t, blocker.id)
    }
    setScanProposals((prev) => prev.filter((x) => x.id !== sp.id))
  }
  function dismissScanProposal(id: string) {
    setScanProposals((prev) => prev.filter((x) => x.id !== id))
  }

  function saveSession() {
    if (!opponent.trim() || events.length === 0) return
    const line = statLine(events)
    const session = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      opponent: opponent.trim(),
      location: gLocation,
      source: 'video' as const,
      events,
      movement,
      teamScore: line.points,
      oppScore: Number(oppScore) || 0,
      durationS: videoRef.current?.duration && isFinite(videoRef.current.duration) ? videoRef.current.duration : now(),
    }
    updateDB((d) => ({ ...d, sessions: [...d.sessions, session] }))
    router.push(`/dashboard/games/view?id=${session.id}`)
  }

  const lastTrail = (tracks[activePlayer] ?? []).slice(-12)
  const sheetRows = db.roster.filter((p) => events.some((e) => e.playerId === p.id) || tracks[p.id]?.length)

  if (db.roster.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-[900px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Video Analysis</h1>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center mt-6">
          <p className="text-foreground font-semibold mb-1">Add your roster first</p>
          <p className="text-sm text-muted-foreground mb-4">
            Video analysis tags real stats per player — you need at least one player.
          </p>
          <Link href="/dashboard/players"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">
            Add players
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1500px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Video Analysis</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload film or use the camera. Tag with hotkeys, let AI propose events, calibrate the court
        for real distance / speed / strides — then save it as a real game.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 cursor-pointer">
              Upload game video
              <input type="file" accept="video/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </label>
            <button type="button" onClick={startCamera}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50">
              Use laptop camera
            </button>
            {source !== 'none' && (
              <span className="self-center text-xs text-muted-foreground truncate max-w-[220px]">
                {fileName} · {fmtClock(clock)}
              </span>
            )}
          </div>
          {camError && <p className="text-sm text-red-500 mb-3">{camError}</p>}

          <div ref={boxRef} onClick={onOverlayClick}
            className={`relative bg-black rounded-xl overflow-hidden border border-border ${mode !== 'tag' ? 'cursor-crosshair' : ''}`}
            style={{ aspectRatio: '16 / 9' }}>
            <video ref={videoRef} playsInline controls={source === 'file'} className="w-full h-full object-contain" />
            {source === 'none' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <p className="text-white/90 font-semibold">No video source</p>
                <p className="text-white/50 text-sm mt-1">Upload a game recording or start the laptop camera.</p>
              </div>
            )}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {calPoints.length === 2 && (
                <line x1={calPoints[0].x * 100} y1={calPoints[0].y * 100} x2={calPoints[1].x * 100} y2={calPoints[1].y * 100}
                  stroke="#facc15" strokeWidth="0.4" strokeDasharray="1.5 1" />
              )}
              {calPoints.map((p, i) => (
                <circle key={i} cx={p.x * 100} cy={p.y * 100} r="0.9" fill="#facc15" />
              ))}
              {hoopPoint && (
                <g>
                  <circle cx={hoopPoint.x * 100} cy={hoopPoint.y * 100} r="9" fill="none" stroke="#f97316" strokeWidth="0.3" strokeDasharray="1 1" />
                  <circle cx={hoopPoint.x * 100} cy={hoopPoint.y * 100} r="0.8" fill="#f97316" />
                </g>
              )}
              {lastTrail.length > 1 && (
                <polyline points={lastTrail.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill="none" stroke="#f97316" strokeWidth="0.4" strokeOpacity="0.9" />
              )}
              {lastTrail.map((p, i) => (
                <circle key={i} cx={p.x * 100} cy={p.y * 100} r={i === lastTrail.length - 1 ? 1.1 : 0.6}
                  fill="#f97316" fillOpacity={i === lastTrail.length - 1 ? 1 : 0.55} />
              ))}
            </svg>
            {flash && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-orange-600 text-white text-sm font-semibold shadow-lg">
                {flash}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {([['tag', 'Tag mode'], ['track', 'Track movement'], ['calibrate', 'Calibrate court'], ['hoop', 'Mark hoop']] as [Mode, string][]).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg border ${
                  mode === m ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
            {mode === 'calibrate' && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Click 2 court points spanning
                <input type="number" min={1} max={40} value={calMeters}
                  onChange={(e) => setCalMeters(Number(e.target.value) || 28)}
                  className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground" />
                meters (28 = court length, 15 = width)
              </span>
            )}
            {mode === 'track' && (
              <span className="text-xs text-muted-foreground">
                Click the active player&apos;s position as they move.
              </span>
            )}
            {mode === 'hoop' && <span className="text-xs text-muted-foreground">Click the rim once to enable scoring-play scanning.</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              metersPerUnit ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
              {metersPerUnit ? 'Court calibrated' : 'Not calibrated'}
            </span>
            <span className={`ml-auto text-xs px-2.5 py-1 rounded-full ${hoopPoint ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
              {hoopPoint ? 'Hoop marked' : 'Hoop not marked'}
            </span>
          </div>

          {/* AI panel */}
          <div className="mt-4 bg-card border border-border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-foreground">
                ⚡ AI Auto-Track <span className="text-xs font-normal text-muted-foreground">(Mistral vision — free key)</span>
              </h2>
              {!db.settings.mistralKey && (
                <Link href="/dashboard/settings" className="text-xs text-orange-500 hover:underline">
                  Add your free API key in Settings →
                </Link>
              )}
            </div>
            {source !== 'file' ? (
              <p className="text-xs text-muted-foreground">
                Load an uploaded video to use AI analysis (camera mode: tag manually while it records).
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Clip start (s)</label>
                    <input type="number" min={0} value={aiStart} onChange={(e) => setAiStart(Number(e.target.value) || 0)}
                      className="w-20 px-2 py-1.5 text-sm rounded border border-border bg-background text-foreground" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Clip end (s)</label>
                    <input type="number" min={1} value={aiEnd} onChange={(e) => setAiEnd(Number(e.target.value) || 10)}
                      className="w-20 px-2 py-1.5 text-sm rounded border border-border bg-background text-foreground" />
                  </div>
                  <button type="button"
                    onClick={() => { setAiStart(Math.max(0, Math.floor(now()) - 10)); setAiEnd(Math.floor(now())) }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground">
                    Last 10s
                  </button>
                  <button type="button" onClick={runAi} disabled={aiBusy || !db.settings.mistralKey || aiEnd <= aiStart}
                    className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40">
                    {aiBusy ? 'Analyzing…' : 'Analyze clip'}
                  </button>
                  <span className="text-xs text-muted-foreground">max 16s per pass on the free tier</span>
                </div>
                {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
                {proposals.length > 0 && (
                  <div className="mt-3 border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                      <p className="text-xs font-semibold text-foreground">{proposals.length} AI-detected events — review and accept</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => [...proposals].forEach(acceptProposal)}
                          className="text-xs text-green-500 hover:underline">Accept all</button>
                        <button type="button" onClick={() => setProposals([])}
                          className="text-xs text-red-500 hover:underline">Dismiss all</button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {proposals.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-0">
                          <span className="tabular-nums text-muted-foreground w-10 shrink-0">{fmtClock(p.t)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium shrink-0">
                            {tagByType[p.type]?.label ?? p.type}
                          </span>
                          {p.jersey != null && <span className="text-muted-foreground shrink-0">#{p.jersey}</span>}
                          <span className="text-muted-foreground truncate flex-1">{p.description}</span>
                          <span className={`shrink-0 ${p.confidence === 'high' ? 'text-green-500' : p.confidence === 'low' ? 'text-red-400' : 'text-yellow-500'}`}>
                            {p.confidence}
                          </span>
                          <button type="button" onClick={() => acceptProposal(p)}
                            className="shrink-0 px-2 py-1 rounded bg-green-600 text-white font-semibold hover:bg-green-500">
                            Accept
                          </button>
                          <button type="button" onClick={() => setProposals((prev) => prev.filter((x) => x !== p))}
                            className="shrink-0 text-red-500 hover:underline">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scoring-play scan */}
          {source === 'file' && (
            <div className="mt-4 bg-card border border-border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-semibold text-foreground">
                  🏀 Scan for Scoring Plays <span className="text-xs font-normal text-muted-foreground">(on-device detector + AI confirmation)</span>
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Mark the hoop above, then scan the clip range (from the AI panel&apos;s start/end above).
                This steps through exact timestamps rather than watching in real time, so it works the
                same whether the footage is normal speed or sped up. Each candidate near the hoop gets
                a quick AI vision check for made/missed, assist and block — you approve every one.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={scanForScoringPlays}
                  disabled={scanBusy || !hoopPoint || !db.settings.mistralKey}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40"
                >
                  {scanBusy ? 'Scanning…' : 'Scan clip for scoring plays'}
                </button>
                {!hoopPoint && <span className="text-xs text-muted-foreground">Mark the hoop first.</span>}
                {!db.settings.mistralKey && (
                  <Link href="/dashboard/settings" className="text-xs text-orange-500 hover:underline">Add free Mistral key →</Link>
                )}
              </div>
              {scanStatus && <p className="text-xs text-orange-500 mt-2">{scanStatus}</p>}
              {scanError && <p className="text-xs text-red-500 mt-2">{scanError}</p>}
              {scanProposals.length > 0 && (
                <div className="mt-3 border border-orange-500 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 border-b border-orange-500">
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">{scanProposals.length} detected play(s) — review and accept</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => [...scanProposals].forEach(acceptScanProposal)} className="text-xs text-green-500 hover:underline">Accept all</button>
                      <button type="button" onClick={() => setScanProposals([])} className="text-xs text-red-500 hover:underline">Dismiss all</button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {scanProposals.map((sp) => {
                      const o = sp.outcome
                      const shooter = o.shooterJersey != null ? db.roster.find((p) => p.number === o.shooterJersey) : undefined
                      const assister = o.assistJersey != null ? db.roster.find((p) => p.number === o.assistJersey) : undefined
                      const blocker = o.blockedByJersey != null ? db.roster.find((p) => p.number === o.blockedByJersey) : undefined
                      return (
                        <div key={sp.id} className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-0">
                          <span className="tabular-nums text-muted-foreground w-12 shrink-0">{fmtClock(sp.t)}</span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold shrink-0 ${o.made ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {o.shotType ?? '2PT'} {o.made ? 'MADE' : 'MISS'}
                          </span>
                          <span className="text-foreground truncate flex-1">
                            {shooter ? `#${shooter.number} ${shooter.name}` : o.shooterJersey ? `#${o.shooterJersey} (not on roster)` : 'shooter unknown'}
                            {assister && ` · assist #${assister.number} ${assister.name}`}
                            {blocker && ` · blocked by #${blocker.number} ${blocker.name}`}
                          </span>
                          <span className={`shrink-0 ${o.confidence === 'high' ? 'text-green-500' : o.confidence === 'low' ? 'text-red-400' : 'text-yellow-500'}`}>{o.confidence}</span>
                          <button type="button" onClick={() => acceptScanProposal(sp)} className="shrink-0 px-2 py-1 rounded bg-green-600 text-white font-semibold hover:bg-green-500">Accept</button>
                          <button type="button" onClick={() => dismissScanProposal(sp.id)} className="shrink-0 text-red-500 hover:underline">✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active player <span className="text-xs text-muted-foreground font-normal">(keys 1–0)</span>
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {db.roster.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setActivePlayer(p.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left truncate ${
                    activePlayer === p.id ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-border text-muted-foreground hover:text-foreground'
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
                <svg ref={courtRef} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" />
              </div>
              <button type="button" onClick={() => setPendingShot(null)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground">Skip location</button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Tag pad <span className="text-xs text-muted-foreground font-normal">(hotkeys)</span>
              </h2>
              {TAG_GROUPS.map((g) => (
                <div key={g} className="mb-3 last:mb-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TAGS.filter((t) => t.group === g).map((t) => (
                      <button key={t.type} type="button" onClick={() => addTag(t.type)} disabled={source === 'none'}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-orange-500 hover:text-orange-500 disabled:opacity-40">
                        <kbd className="opacity-50 mr-1 uppercase">{t.key}</kbd>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

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
              <button type="button" onClick={saveSession} disabled={!opponent.trim() || events.length === 0}
                className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40">
                Save session ({events.length} events)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat sheet */}
      {sheetRows.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Session Stat Sheet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Player', 'PTS', 'FG', 'AST', 'HCKY', 'PASS', 'DEFL', 'STL', 'BLK', 'REB', 'DIST', 'STRIDES', 'MAX SPD'].map((h) => (
                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wide font-medium text-muted-foreground text-center first:text-left first:px-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map((p) => {
                  const l = statLine(events, p.id)
                  const mv = movement[p.id]
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">#{p.number} {p.name}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">{l.points}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.fgm}-{l.fga}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.ast}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.hast}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.pass}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.defl}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.stl}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.blk}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{l.reb}</td>
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

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="mt-5 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Event Timeline <span className="text-sm text-muted-foreground font-normal">({events.length} — click to jump)</span>
            </h2>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {[...events].reverse().map((e) => {
              const p = db.roster.find((r) => r.id === e.playerId)
              return (
                <div key={e.id} className="w-full flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/20">
                  <button type="button"
                    onClick={() => { if (source === 'file' && videoRef.current) videoRef.current.currentTime = e.t }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-muted-foreground tabular-nums w-12 shrink-0">{fmtClock(e.t)}</span>
                    <span className="font-medium text-foreground truncate">#{p?.number} {p?.name.split(' ').slice(-1)[0]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 ml-auto shrink-0">
                      {tagByType[e.type]?.label}
                    </span>
                  </button>
                  <button type="button" onClick={() => setEvents((prev) => prev.filter((x) => x.id !== e.id))}
                    className="text-xs text-red-500 hover:underline shrink-0">remove</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
