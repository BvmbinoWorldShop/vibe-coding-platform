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

// ---------- jersey-color team separation ----------
// Genuinely on-device, no API calls: sample the average jersey color from
// the torso region of each person box, then run 2-means clustering across
// all currently visible boxes so the two teams separate by their real
// jersey colors — not a guess, an actual pixel average.

export interface RGB { r: number; g: number; b: number }

let sampleCanvas: HTMLCanvasElement | null = null

export function sampleTorsoColor(
  source: HTMLVideoElement,
  box: { x: number; y: number; w: number; h: number }
): RGB | null {
  if (!sampleCanvas) sampleCanvas = document.createElement('canvas')
  const vw = source.videoWidth
  const vh = source.videoHeight
  if (!vw || !vh) return null
  // Torso region: horizontally centered, upper-middle of the box (avoids
  // the head and legs, where background/skin would skew the average).
  const tx = box.x + box.w * 0.25
  const ty = box.y + box.h * 0.2
  const tw = box.w * 0.5
  const th = box.h * 0.32
  const sx = Math.max(0, Math.round(tx * vw))
  const sy = Math.max(0, Math.round(ty * vh))
  const sw = Math.max(1, Math.round(tw * vw))
  const sh = Math.max(1, Math.round(th * vh))
  sampleCanvas.width = sw
  sampleCanvas.height = sh
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
    const { data } = ctx.getImageData(0, 0, sw, sh)
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
    }
    if (n === 0) return null
    return { r: r / n, g: g / n, b: b / n }
  } catch {
    return null
  }
}

export function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function colorDist(a: RGB, b: RGB): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
}

// 2-means clustering, seeded from the previous tick's centroids so team
// colors stay stable across frames instead of flipping every update.
export function clusterIntoTeams(
  colors: RGB[],
  prevCentroids?: [RGB, RGB]
): { assignments: number[]; centroids: [RGB, RGB] } {
  if (colors.length === 0) {
    return { assignments: [], centroids: prevCentroids ?? [{ r: 200, g: 80, b: 80 }, { r: 80, g: 120, b: 200 }] }
  }
  let centroids: [RGB, RGB] = prevCentroids
    ? [prevCentroids[0], prevCentroids[1]]
    : colors.length > 1
      ? [colors[0], colors[colors.length - 1]]
      : [colors[0], { r: 255 - colors[0].r, g: 255 - colors[0].g, b: 255 - colors[0].b }]

  let assignments = colors.map(() => 0)
  for (let iter = 0; iter < 4; iter++) {
    assignments = colors.map((c) => (colorDist(c, centroids[0]) <= colorDist(c, centroids[1]) ? 0 : 1))
    for (const k of [0, 1] as const) {
      const members = colors.filter((_, i) => assignments[i] === k)
      if (members.length > 0) {
        centroids[k] = {
          r: members.reduce((a, c) => a + c.r, 0) / members.length,
          g: members.reduce((a, c) => a + c.g, 0) / members.length,
          b: members.reduce((a, c) => a + c.b, 0) / members.length,
        }
      }
    }
  }
  return { assignments, centroids }
}
