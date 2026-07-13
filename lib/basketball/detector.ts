'use client'

// Live, on-device object detection for the AI Court Tracker. Runs entirely
// in the browser on the device GPU (WebGL backend via TensorFlow.js) — no
// server, no upload. COCO-SSD detects generic "person" and "sports ball"
// boxes per frame; a lightweight centroid tracker persists identity across
// frames so a name assigned once keeps following the same box.
//
// Honesty note: this detects *where people and the ball are*, not jersey
// numbers or names — that requires a custom-trained model. The analyst
// assigns a roster name to a tracked box once; the tracker keeps the label
// as long as it can match the box frame-to-frame.

import * as tf from '@tensorflow/tfjs'

export interface DetectedBox {
  trackId: number
  cls: 'person' | 'sports ball'
  x: number // 0-1, box left, relative to frame
  y: number // 0-1, box top
  w: number // 0-1
  h: number // 0-1
  score: number
}

type CocoModel = {
  detect: (
    img: HTMLVideoElement | HTMLCanvasElement
  ) => Promise<{ bbox: [number, number, number, number]; class: string; score: number }[]>
}

let modelPromise: Promise<CocoModel> | null = null

export async function loadDetector(): Promise<CocoModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'))
      await tf.ready()
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      return cocoSsd.load({ base: 'lite_mobilenet_v2' }) as unknown as Promise<CocoModel>
    })()
  }
  return modelPromise
}

interface TrackState {
  id: number
  cls: string
  cx: number
  cy: number
  w: number
  h: number
  lastSeen: number
  missCount: number
}

// Simple nearest-centroid multi-object tracker. Good enough to keep a
// human-assigned name attached to the same moving box between detection
// passes (tracking, not identification).
export class CentroidTracker {
  private tracks: TrackState[] = []
  private nextId = 1
  private maxMiss = 8
  private frame = 0

  update(
    detections: { cls: 'person' | 'sports ball'; x: number; y: number; w: number; h: number; score: number }[]
  ): DetectedBox[] {
    this.frame++
    const used = new Set<number>()
    const results: DetectedBox[] = []

    for (const det of detections) {
      const cx = det.x + det.w / 2
      const cy = det.y + det.h / 2
      let best: TrackState | null = null
      let bestDist = Infinity
      for (const t of this.tracks) {
        if (used.has(t.id) || t.cls !== det.cls) continue
        const dist = Math.hypot(t.cx - cx, t.cy - cy)
        const gate = det.cls === 'sports ball' ? 0.12 : 0.18
        if (dist < gate && dist < bestDist) {
          best = t
          bestDist = dist
        }
      }
      if (best) {
        best.cx = cx
        best.cy = cy
        best.w = det.w
        best.h = det.h
        best.lastSeen = this.frame
        best.missCount = 0
        used.add(best.id)
        results.push({ trackId: best.id, cls: det.cls, x: det.x, y: det.y, w: det.w, h: det.h, score: det.score })
      } else {
        const t: TrackState = { id: this.nextId++, cls: det.cls, cx, cy, w: det.w, h: det.h, lastSeen: this.frame, missCount: 0 }
        this.tracks.push(t)
        used.add(t.id)
        results.push({ trackId: t.id, cls: det.cls, x: det.x, y: det.y, w: det.w, h: det.h, score: det.score })
      }
    }

    // Age out unmatched tracks.
    for (const t of this.tracks) {
      if (!used.has(t.id)) t.missCount++
    }
    this.tracks = this.tracks.filter((t) => t.missCount <= this.maxMiss)

    return results
  }

  reset() {
    this.tracks = []
    this.nextId = 1
    this.frame = 0
  }
}

export async function detectFrame(
  model: CocoModel,
  source: HTMLVideoElement,
  minScore = 0.4
): Promise<{ cls: 'person' | 'sports ball'; x: number; y: number; w: number; h: number; score: number }[]> {
  const preds = await model.detect(source)
  const vw = source.videoWidth || 1
  const vh = source.videoHeight || 1
  return preds
    .filter((p) => (p.class === 'person' || p.class === 'sports ball') && p.score >= minScore)
    .map((p) => ({
      cls: p.class as 'person' | 'sports ball',
      x: p.bbox[0] / vw,
      y: p.bbox[1] / vh,
      w: p.bbox[2] / vw,
      h: p.bbox[3] / vh,
      score: p.score,
    }))
}
