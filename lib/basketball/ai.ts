'use client'

// AI layer for Ball Analysis. Two free providers, keys set in Settings:
//  - Mistral (api.mistral.ai, free tier at console.mistral.ai) — Pixtral
//    vision model reads sampled video frames and proposes events.
//  - Cerebras (api.cerebras.ai, free tier at cloud.cerebras.ai) — very fast
//    text model used for coaching insights and workout suggestions.
// All calls go directly from the browser; keys never leave the device.

export interface AiEvent {
  t: number
  type: string
  jersey: number | null
  description: string
  confidence: 'high' | 'medium' | 'low'
}

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions'
const MISTRAL_VISION_MODEL = 'pixtral-12b-2409'
const MISTRAL_TEXT_MODEL = 'mistral-small-latest'
const CEREBRAS_MODEL = 'llama-3.3-70b'

const EVENT_TYPES = [
  'fg2m: 2-point shot made',
  'fg2x: 2-point shot missed',
  'fg3m: 3-point shot made',
  'fg3x: 3-point shot missed',
  'ftm: free throw made',
  'ftx: free throw missed',
  'ast: assist (pass leading directly to a made basket)',
  'hast: hockey assist (the pass before the assist)',
  'pass: notable pass',
  'drive: dribble drive to the basket',
  'tov: turnover',
  'defl: deflection (defender tips a pass or dribble)',
  'stl: steal',
  'blk: block',
  'oreb: offensive rebound',
  'dreb: defensive rebound',
  'tip: tip on a rebound',
  'loose: loose ball recovery',
  'boxout: box out',
  'sast: screen assist',
  'chg: charge drawn',
  'cont: contested shot (defender)',
  'pf: foul',
].join('\n')

export async function extractFrames(
  video: HTMLVideoElement,
  startS: number,
  endS: number,
  fps = 1
): Promise<{ t: number; dataUrl: string }[]> {
  const frames: { t: number; dataUrl: string }[] = []
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 640 / (video.videoWidth || 640))
  canvas.width = Math.round((video.videoWidth || 640) * scale)
  canvas.height = Math.round((video.videoHeight || 360) * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const originalTime = video.currentTime
  const wasPaused = video.paused
  video.pause()
  const step = 1 / fps
  for (let t = startS; t <= endS + 0.001 && frames.length < 16; t += step) {
    await new Promise<void>((resolve, reject) => {
      const onSeek = () => {
        video.removeEventListener('seeked', onSeek)
        resolve()
      }
      video.addEventListener('seeked', onSeek)
      video.currentTime = t
      setTimeout(() => reject(new Error('Seek timeout')), 5000)
    }).catch(() => {})
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    frames.push({ t, dataUrl: canvas.toDataURL('image/jpeg', 0.6) })
  }
  video.currentTime = originalTime
  if (!wasPaused) video.play().catch(() => {})
  return frames
}

async function chat(
  url: string,
  apiKey: string,
  model: string,
  content: unknown,
  maxTokens = 2048
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid API key — check Settings.')
    if (res.status === 429) throw new Error('Rate limit hit on the free tier. Wait a minute and retry.')
    throw new Error(`AI request failed (HTTP ${res.status})`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

export async function analyzeFrames(
  mistralKey: string,
  frames: { t: number; dataUrl: string }[],
  rosterHint: string
): Promise<AiEvent[]> {
  if (!mistralKey) throw new Error('Video analysis needs a Mistral API key (free) — add it in Settings.')
  const content = [
    {
      type: 'text',
      text: `You are an elite basketball video analyst. You are given ${frames.length} consecutive frames from a game video, sampled 1 second apart, in order. The first frame is at video time t=${frames[0]?.t.toFixed(1)}s; each next frame is +1s.

Identify every basketball event you can observe. Allowed event types (use the code before the colon):
${EVENT_TYPES}

Our team's roster (jersey numbers): ${rosterHint || 'unknown'}.

Respond with ONLY a JSON array, no markdown fences:
[{"t": <video time seconds>, "type": "<code>", "jersey": <number or null>, "description": "<short>", "confidence": "high"|"medium"|"low"}]

Only include events you can actually observe. [] is a valid answer.`,
    },
    ...frames.map((f) => ({ type: 'image_url', image_url: { url: f.dataUrl } })),
  ]
  const text = await chat(MISTRAL_URL, mistralKey, MISTRAL_VISION_MODEL, content)
  const jsonText = text.replace(/```json|```/g, '').trim()
  const start = jsonText.indexOf('[')
  const end = jsonText.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error(`AI returned no events. Raw answer: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(jsonText.slice(start, end + 1)) as Partial<AiEvent>[]
  return parsed
    .filter((e) => typeof e.t === 'number' && typeof e.type === 'string')
    .map((e) => ({
      t: e.t as number,
      type: e.type as string,
      jersey: typeof e.jersey === 'number' ? e.jersey : null,
      description: e.description ?? '',
      confidence: (e.confidence as AiEvent['confidence']) ?? 'medium',
    }))
}

// Coaching insights from real recorded stats. Prefers Cerebras (fastest),
// falls back to Mistral's text model.
export async function coachingInsights(
  keys: { cerebrasKey: string; mistralKey: string },
  statSummary: string
): Promise<string> {
  const prompt = `You are a professional basketball performance coach. Based on this player's REAL recorded stats, give a concise scouting read: 3 strengths, 3 weaknesses, and a focused 1-week workout plan (5 sessions max) that targets the weaknesses. Be specific and practical. Use plain text with short headers, no markdown symbols.

${statSummary}`
  if (keys.cerebrasKey) {
    return chat(CEREBRAS_URL, keys.cerebrasKey, CEREBRAS_MODEL, prompt, 900)
  }
  if (keys.mistralKey) {
    return chat(MISTRAL_URL, keys.mistralKey, MISTRAL_TEXT_MODEL, prompt, 900)
  }
  throw new Error('Add a free Cerebras or Mistral API key in Settings first.')
}

export async function testMistralKey(apiKey: string): Promise<string> {
  await chat(MISTRAL_URL, apiKey, MISTRAL_TEXT_MODEL, 'Reply with exactly: OK', 5)
  return 'Mistral key works — video analysis is ready.'
}

export async function testCerebrasKey(apiKey: string): Promise<string> {
  await chat(CEREBRAS_URL, apiKey, CEREBRAS_MODEL, 'Reply with exactly: OK', 5)
  return 'Cerebras key works — coaching insights are ready.'
}
