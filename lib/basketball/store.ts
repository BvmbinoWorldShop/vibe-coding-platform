'use client'

// Real-data store for Ball Analysis. Everything the dashboard shows comes
// from here: the roster you create, the sessions you record (live or from
// video), and the CRM logs you keep. Persisted in the browser's localStorage
// — no fake numbers anywhere.

import { useSyncExternalStore } from 'react'

export interface RosterPlayer {
  id: string
  name: string
  number: number
  position: string
  height: string
  weight: string
  strideLength: number // meters, used to estimate strides from distance
  notes: string
  team: string // "My Team" by default; scouted/opponent players can use any name
  color?: string // optional custom box/jersey color (hex); falls back to auto team color
}

export interface ShotMark {
  x: number // 0-100 half-court coords (ShotChart convention)
  y: number
}

export interface SessionEvent {
  id: string
  t: number // seconds on the session clock
  playerId: string
  type: string // TAGS type
  shot?: ShotMark
}

export interface PlayerMovement {
  distanceM: number
  maxSpeedKmh: number
  strides: number
}

export interface GameSession {
  id: string
  date: string
  opponent: string
  location: 'home' | 'away'
  source: 'live' | 'video' | 'ai'
  events: SessionEvent[]
  movement: Record<string, PlayerMovement>
  teamScore: number
  oppScore: number
  durationS: number
}

export interface WorkoutEntry {
  id: string
  playerId: string
  date: string
  type: string
  duration: number
  intensity: 'low' | 'medium' | 'high'
  description: string
  completed: boolean
}

export interface RecoveryEntry {
  id: string
  playerId: string
  date: string
  sleepHours: number
  recoveryScore: number
  soreness: 'none' | 'mild' | 'moderate' | 'severe'
  notes: string
}

export interface AppSettings {
  teamName: string
  mistralKey: string
  cerebrasKey: string
}

export interface DB {
  roster: RosterPlayer[]
  sessions: GameSession[]
  workouts: WorkoutEntry[]
  recovery: RecoveryEntry[]
  settings: AppSettings
}

export const TAGS: { key: string; label: string; type: string; pts?: number; group: string; shot?: boolean; made?: boolean }[] = [
  { key: 'q', label: '2PT Made', type: 'fg2m', pts: 2, group: 'Scoring', shot: true, made: true },
  { key: 'w', label: '2PT Miss', type: 'fg2x', group: 'Scoring', shot: true, made: false },
  { key: 'e', label: '3PT Made', type: 'fg3m', pts: 3, group: 'Scoring', shot: true, made: true },
  { key: 'r', label: '3PT Miss', type: 'fg3x', group: 'Scoring', shot: true, made: false },
  { key: 't', label: 'FT Made', type: 'ftm', pts: 1, group: 'Scoring' },
  { key: 'y', label: 'FT Miss', type: 'ftx', group: 'Scoring' },
  { key: 'a', label: 'Assist', type: 'ast', group: 'Playmaking' },
  { key: 's', label: 'Hockey Assist', type: 'hast', group: 'Playmaking' },
  { key: 'v', label: 'Screen Assist', type: 'sast', group: 'Playmaking' },
  { key: 'p', label: 'Pass', type: 'pass', group: 'Playmaking' },
  { key: 'j', label: 'Dribble Drive', type: 'drive', group: 'Playmaking' },
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
export const TAG_GROUPS = ['Scoring', 'Playmaking', 'Defense', 'Hustle']
export const tagByType: Record<string, (typeof TAGS)[number]> = Object.fromEntries(
  TAGS.map((t) => [t.type, t])
)

const KEY = 'ball-analysis-db-v1'
const EMPTY: DB = {
  roster: [],
  sessions: [],
  workouts: [],
  recovery: [],
  settings: { teamName: 'My Team', mistralKey: '', cerebrasKey: '' },
}

let cache: DB | null = null
const listeners = new Set<() => void>()

export function getDB(): DB {
  if (typeof window === 'undefined') return EMPTY
  if (!cache) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DB>
      cache = {
        ...EMPTY,
        ...raw,
        roster: (raw.roster ?? []).map((p) => ({ ...p, team: p.team || 'My Team' })),
        settings: { ...EMPTY.settings, ...(raw.settings ?? {}) },
      }
    } catch {
      cache = { ...EMPTY }
    }
  }
  return cache
}

export function teamsOf(roster: RosterPlayer[]): string[] {
  return Array.from(new Set(roster.map((p) => p.team || 'My Team')))
}

export function updateDB(fn: (db: DB) => DB) {
  const next = fn(getDB())
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage full — keep in-memory state
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, () => EMPTY)
}

export function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------- aggregation ----------

export interface StatLine {
  points: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  ast: number
  hast: number
  sast: number
  pass: number
  drive: number
  tov: number
  defl: number
  stl: number
  blk: number
  cont: number
  chg: number
  oreb: number
  dreb: number
  reb: number
  tip: number
  loose: number
  boxout: number
  pf: number
  tagged: number
}

export function statLine(events: SessionEvent[], playerId?: string): StatLine {
  const mine = playerId ? events.filter((e) => e.playerId === playerId) : events
  const c = (type: string) => mine.filter((e) => e.type === type).length
  const fg2m = c('fg2m')
  const fg3m = c('fg3m')
  return {
    points: fg2m * 2 + fg3m * 3 + c('ftm'),
    fgm: fg2m + fg3m,
    fga: fg2m + fg3m + c('fg2x') + c('fg3x'),
    tpm: fg3m,
    tpa: fg3m + c('fg3x'),
    ftm: c('ftm'),
    fta: c('ftm') + c('ftx'),
    ast: c('ast'),
    hast: c('hast'),
    sast: c('sast'),
    pass: c('pass'),
    drive: c('drive'),
    tov: c('tov'),
    defl: c('defl'),
    stl: c('stl'),
    blk: c('blk'),
    cont: c('cont'),
    chg: c('chg'),
    oreb: c('oreb'),
    dreb: c('dreb'),
    reb: c('oreb') + c('dreb'),
    tip: c('tip'),
    loose: c('loose'),
    boxout: c('boxout'),
    pf: c('pf'),
    tagged: mine.length,
  }
}

export function sessionShots(session: GameSession, playerId?: string) {
  return session.events
    .filter((e) => e.shot && (!playerId || e.playerId === playerId))
    .map((e) => ({
      x: e.shot!.x,
      y: e.shot!.y,
      made: !!tagByType[e.type]?.made,
      shotType: e.type.startsWith('fg3') ? '3PT' : '2PT',
      playerId: e.playerId,
    }))
}

export function playerSeason(sessions: GameSession[], playerId: string) {
  const played = sessions.filter(
    (s) => s.events.some((e) => e.playerId === playerId) || s.movement[playerId]
  )
  const totals = statLine(
    played.flatMap((s) => s.events),
    playerId
  )
  const distance = played.reduce((a, s) => a + (s.movement[playerId]?.distanceM ?? 0), 0)
  const strides = played.reduce((a, s) => a + (s.movement[playerId]?.strides ?? 0), 0)
  const maxSpeed = Math.max(0, ...played.map((s) => s.movement[playerId]?.maxSpeedKmh ?? 0))
  return { played: played.length, totals, distance, strides, maxSpeed }
}
