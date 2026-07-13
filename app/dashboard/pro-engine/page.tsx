'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDB, updateDB, type GameSession, type RosterPlayer } from '@/lib/basketball/store'

interface AnalysisResult {
  roster: RosterPlayer[]
  session: GameSession
}

export default function ProEnginePage() {
  const db = useDB()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [courtType, setCourtType] = useState<'full' | 'half'>('full')
  const [detector, setDetector] = useState('yolov8m')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  const engineUrl = db.settings.proEngineUrl

  async function runAnalysis() {
    if (!file || !engineUrl) return
    setBusy(true)
    setError(null)
    setProgress(0)
    setStatusMsg('Uploading…')
    try {
      const form = new FormData()
      form.append('video', file)
      form.append('options', JSON.stringify({ court_type: courtType, detector, corners: [], fps_sample: 5 }))
      const res = await fetch(`${engineUrl}/analyze`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Engine returned HTTP ${res.status}`)
      const { jobId } = await res.json()

      // Poll until done.
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500))
        const jr = await fetch(`${engineUrl}/jobs/${jobId}`)
        if (!jr.ok) throw new Error('Lost contact with the engine')
        const job = await jr.json()
        setProgress(job.progress ?? 0)
        setStatusMsg(job.message || job.status)
        if (job.status === 'error') throw new Error(job.message || 'Analysis failed')
        if (job.status === 'done') {
          importResult(job.result as AnalysisResult)
          return
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setBusy(false)
    }
  }

  function importResult(result: AnalysisResult) {
    updateDB((d) => ({
      ...d,
      roster: [...d.roster, ...result.roster],
      sessions: [...d.sessions, result.session],
    }))
    router.push(`/dashboard/games/view?id=${result.session.id}`)
  }

  if (!engineUrl) {
    return (
      <div className="p-4 md:p-8 max-w-[900px]">
        <h1 className="text-2xl font-bold text-foreground mb-1">Pro Tracking Engine</h1>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center mt-6">
          <p className="text-foreground font-semibold mb-1">Connect your engine first</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
            The Pro Engine is a free, open-source backend (YOLOv8 + ByteTrack) you run on your own
            GPU for arena-grade tracking. Start it from <code>tracking-engine/</code>, then set its URL
            in Settings.
          </p>
          <Link href="/dashboard/settings" className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">
            Set engine URL
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[900px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Pro Tracking Engine</h1>
      <p className="text-sm text-muted-foreground mb-1">
        Upload a game to your self-hosted GPU engine for high-accuracy detection, ByteTrack IDs, and
        metric movement. The result imports as a normal game — all your analytics, search and reports
        work on it.
      </p>
      <p className="text-xs text-muted-foreground mb-6">Engine: <code>{engineUrl}</code></p>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Game video</label>
          <input ref={fileRef} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-foreground" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Court</label>
            <select value={courtType} onChange={(e) => setCourtType(e.target.value as 'full' | 'half')}
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
              <option value="full">Full court</option>
              <option value="half">Half court</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Accuracy</label>
            <select value={detector} onChange={(e) => setDetector(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
              <option value="yolov8n">Fast (yolov8n)</option>
              <option value="yolov8s">Balanced (yolov8s)</option>
              <option value="yolov8m">Accurate (yolov8m)</option>
              <option value="yolov8x">Max (yolov8x)</option>
            </select>
          </div>
        </div>
        <button type="button" onClick={runAnalysis} disabled={!file || busy}
          className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40">
          {busy ? 'Analyzing…' : 'Analyze on GPU'}
        </button>
      </div>

      {busy && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-foreground">{statusMsg}</span>
            <span className="text-muted-foreground tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Processing runs entirely on your engine. Large clips at max accuracy can take a while —
            this is real frame-by-frame tracking, not a quick sample.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Tip: for metric speed/distance, calibrate the court in the engine request (4 corner points).
        The in-browser <Link href="/dashboard/live-ai" className="text-orange-500 hover:underline">Live AI Tracker</Link>{' '}
        remains available for real-time work without a backend.
      </p>
    </div>
  )
}
