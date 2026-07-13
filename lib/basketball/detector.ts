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
      // mobilenet_v2 is the most accurate COCO-SSD base — noticeably better at
      // locating a player/ball than the "lite" base, and fast enough on a GPU
      // for the handful of objects on a court.
      return cocoSsd.load({ base: 'mobilenet_v2' }) as unknown as Promise<CocoModel>
    })()
  }
  return modelPromise
}

interface TrackState {
  id: number
  cls: string
  cx: number
  cy: number
  vx: number
  vy: number
  w: number
  h: number
  lastSeen: number
  missCount: number
}

// Nearest-centroid multi-object tracker with constant-velocity prediction.
// Matching a detection against each track's *predicted* next position (not
// its last one) lets identities survive fast movement between frames, and
// coasting a briefly-missed track along its velocity keeps the box moving
// with the player instead of freezing until the next detection.
export class CentroidTracker {
  private tracks: TrackState[] = []
  private nextId = 1
  private maxMiss = 12
  private frame = 0

  update(
    detections: { cls: 'person' | 'sports ball'; x: number; y: number; w: number; h: number; score: number }[]
  ): DetectedBox[] {
    this.frame++
    const used = new Set<number>()
    const results: DetectedBox[] = []

    // Predict every track forward one step before matching.
    for (const t of this.tracks) {
      t.cx += t.vx
      t.cy += t.vy
    }

    for (const det of detections) {
      const cx = det.x + det.w / 2
      const cy = det.y + det.h / 2
      let best: TrackState | null = null
      let bestDist = Infinity
      for (const t of this.tracks) {
        if (used.has(t.id) || t.cls !== det.cls) continue
        const dist = Math.hypot(t.cx - cx, t.cy - cy)
        // Wider gates than a static tracker, scaled up while a track is
        // temporarily unmatched so a fast player isn't dropped mid-drive.
        const base = det.cls === 'sports ball' ? 0.16 : 0.24
        const gate = base * (1 + Math.min(t.missCount, 4) * 0.4)
        if (dist < gate && dist < bestDist) {
          best = t
          bestDist = dist
        }
      }
      if (best) {
        // Velocity update (EMA) toward the new observation, then snap to it.
        const nvx = cx - best.cx
        const nvy = cy - best.cy
        best.vx = best.vx * 0.5 + nvx * 0.5
        best.vy = best.vy * 0.5 + nvy * 0.5
        best.cx = cx
        best.cy = cy
        best.w = det.w
        best.h = det.h
        best.lastSeen = this.frame
        best.missCount = 0
        used.add(best.id)
        results.push({ trackId: best.id, cls: det.cls, x: det.x, y: det.y, w: det.w, h: det.h, score: det.score })
      } else {
        const t: TrackState = { id: this.nextId++, cls: det.cls, cx, cy, vx: 0, vy: 0, w: det.w, h: det.h, lastSeen: this.frame, missCount: 0 }
        this.tracks.push(t)
        used.add(t.id)
        results.push({ trackId: t.id, cls: det.cls, x: det.x, y: det.y, w: det.w, h: det.h, score: det.score })
      }
    }

    // Unmatched tracks: coast along velocity (with damping) and emit a
    // predicted box so the overlay keeps moving; age them out after a bit.
    // The ball coasts longer than people so it is virtually never "lost".
    for (const t of this.tracks) {
      if (used.has(t.id)) continue
      t.missCount++
      t.vx *= 0.85
      t.vy *= 0.85
      const coastLimit = t.cls === 'sports ball' ? 12 : 4
      if (t.missCount <= coastLimit) {
        const x = Math.max(0, Math.min(1 - t.w, t.cx - t.w / 2))
        const y = Math.max(0, Math.min(1 - t.h, t.cy - t.h / 2))
        results.push({ trackId: t.id, cls: t.cls as 'person' | 'sports ball', x, y, w: t.w, h: t.h, score: 0.25 })
      }
    }
    const maxMiss = this.maxMiss
    this.tracks = this.tracks.filter((t) => t.missCount <= (t.cls === 'sports ball' ? 30 : maxMiss))

    return results
  }

  reset() {
    this.tracks = []
    this.nextId = 1
    this.frame = 0
  }
}

// Point-in-polygon (ray casting) for the on-court region mask. Detections
// whose feet fall outside the marked court are ignored, so the GPU/AI never
// spend effort on the crowd, bench, or sideline.
export function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return true
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export async function detectFrame(
  model: CocoModel,
  source: HTMLVideoElement,
  personMin = 0.4,
  // The ball is small and fast, so it scores lower than people — use a much
  // lower threshold for it so it is caught (and kept) far more often. This is
  // what keeps the ball recognized nearly every frame.
  ballMin = 0.18
): Promise<{ cls: 'person' | 'sports ball'; x: number; y: number; w: number; h: number; score: number }[]> {
  const preds = await model.detect(source)
  const vw = source.videoWidth || 1
  const vh = source.videoHeight || 1
  return preds
    .filter((p) =>
      (p.class === 'person' && p.score >= personMin) ||
      (p.class === 'sports ball' && p.score >= ballMin)
    )
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

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Distinct, high-contrast fallback colors for ad-hoc participants (pickup /
// streetball, where players aren't on a defined team). Cycled by index.
export const PARTICIPANT_PALETTE = [
  '#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899',
  '#a855f7', '#14b8a6', '#ef4444', '#84cc16', '#06b6d4',
]

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
