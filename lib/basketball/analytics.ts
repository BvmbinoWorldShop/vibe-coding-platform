'use client'

// Advanced analytics engine — every metric here is computed from the real
// events you recorded (no simulated numbers). Where a metric is an estimate
// derived from tracked events rather than a directly counted stat, it is
// named with "est." and its formula is documented inline.

import { statLine, sessionShots, type GameSession, type RosterPlayer, type StatLine } from './store'

export interface PlayerAnalytics {
  player: RosterPlayer
  games: number
  totals: StatLine
  // Shooting quality
  efg: number // effective FG% = (FGM + 0.5*3PM) / FGA
  ts: number // true shooting % = PTS / (2*(FGA + 0.44*FTA))
  ppsa: number // points per shot attempt
  threeRate: number // 3PA / FGA
  // Playmaking
  astToTov: number
  creationEst: number // est. assists created = AST + 0.5*hockeyAST + 0.4*screenAST
  // Defense
  defActivity: number // deflections + steals + blocks + contests + charges, per game
  stocks: number // steals + blocks per game
  // Hustle
  hustle: number // loose balls + box outs + tips + charges, per game
  // Tendencies (share of shot attempts)
  paintShare: number
  midShare: number
  threeShare: number
  driveRate: number // drives per game
  // Movement
  distanceM: number
  maxSpeedKmh: number
  strides: number
}

// Classify a recorded shot into a zone from its half-court coords (0-100,
// basket near bottom-center in the ShotChart convention) and its 2/3 type.
function shotZone(x: number, y: number, isThree: boolean): 'paint' | 'mid' | 'three' {
  if (isThree) return 'three'
  const dx = x - 50
  const dy = y - 88 // basket
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist < 22 ? 'paint' : 'mid'
}

export function playerAnalytics(sessions: GameSession[], player: RosterPlayer): PlayerAnalytics {
  const played = sessions.filter((s) => s.events.some((e) => e.playerId === player.id) || s.movement[player.id])
  const g = Math.max(played.length, 1)
  const totals = statLine(played.flatMap((s) => s.events), player.id)

  const efg = totals.fga > 0 ? (totals.fgm + 0.5 * totals.tpm) / totals.fga : 0
  const tsDen = 2 * (totals.fga + 0.44 * totals.fta)
  const ts = tsDen > 0 ? totals.points / tsDen : 0
  const ppsa = totals.fga > 0 ? totals.points / totals.fga : 0
  const threeRate = totals.fga > 0 ? totals.tpa / totals.fga : 0

  const shots = played.flatMap((s) => sessionShots(s, player.id))
  let paint = 0, mid = 0, three = 0
  for (const sh of shots) {
    const z = shotZone(sh.x, sh.y, sh.shotType === '3PT')
    if (z === 'paint') paint++
    else if (z === 'mid') mid++
    else three++
  }
  const shotN = Math.max(shots.length, 1)

  const distanceM = played.reduce((a, s) => a + (s.movement[player.id]?.distanceM ?? 0), 0)
  const strides = played.reduce((a, s) => a + (s.movement[player.id]?.strides ?? 0), 0)
  const maxSpeedKmh = Math.max(0, ...played.map((s) => s.movement[player.id]?.maxSpeedKmh ?? 0))

  return {
    player,
    games: played.length,
    totals,
    efg,
    ts,
    ppsa,
    threeRate,
    astToTov: totals.tov > 0 ? totals.ast / totals.tov : totals.ast,
    creationEst: totals.ast + 0.5 * totals.hast + 0.4 * totals.sast,
    defActivity: (totals.defl + totals.stl + totals.blk + totals.cont + totals.chg) / g,
    stocks: (totals.stl + totals.blk) / g,
    hustle: (totals.loose + totals.boxout + totals.tip + totals.chg) / g,
    paintShare: paint / shotN,
    midShare: mid / shotN,
    threeShare: three / shotN,
    driveRate: totals.drive / g,
    distanceM,
    maxSpeedKmh,
    strides,
  }
}

export interface TeamAnalytics {
  team: string
  games: number
  ppg: number
  oppPpg: number
  netPerGame: number
  efg: number
  astRate: number // assists per made FG
  tovPerGame: number
  rebPerGame: number
  paceEst: number // est. possessions/game = FGA + 0.44*FTA + TOV
  pointsFrom: { paint: number; mid: number; three: number; ft: number }
}

export function teamAnalytics(sessions: GameSession[], team: string, roster: RosterPlayer[]): TeamAnalytics {
  const ids = new Set(roster.filter((p) => p.team === team).map((p) => p.id))
  // A team's games are sessions where at least one of its players has events.
  const played = sessions.filter((s) => s.events.some((e) => ids.has(e.playerId)))
  const g = Math.max(played.length, 1)
  const evs = played.flatMap((s) => s.events.filter((e) => ids.has(e.playerId)))
  const t = statLine(evs)

  let paintPts = 0, midPts = 0
  for (const s of played) {
    for (const e of s.events) {
      if (!ids.has(e.playerId) || !e.shot) continue
      const isThree = e.type === 'fg3m'
      if (e.type === 'fg2m') {
        const z = shotZone(e.shot.x, e.shot.y, false)
        if (z === 'paint') paintPts += 2
        else midPts += 2
      } else if (isThree) {
        // counted in three below
      }
    }
  }
  const threePts = t.tpm * 3
  const ftPts = t.ftm

  return {
    team,
    games: played.length,
    ppg: played.reduce((a, s) => a + s.teamScore, 0) / g,
    oppPpg: played.reduce((a, s) => a + s.oppScore, 0) / g,
    netPerGame: played.reduce((a, s) => a + (s.teamScore - s.oppScore), 0) / g,
    efg: t.fga > 0 ? (t.fgm + 0.5 * t.tpm) / t.fga : 0,
    astRate: t.fgm > 0 ? t.ast / t.fgm : 0,
    tovPerGame: t.tov / g,
    rebPerGame: t.reb / g,
    paceEst: (t.fga + 0.44 * t.fta + t.tov) / g,
    pointsFrom: { paint: paintPts, mid: midPts, three: threePts, ft: ftPts },
  }
}

// Lineup analytics: for each recorded session, the set of players who
// actually appear together, with that game's real net result. This is a
// genuine (if coarse) on-court net rating attributed to the group present.
export interface LineupRow {
  sessionId: string
  date: string
  opponent: string
  players: RosterPlayer[]
  net: number
  teamScore: number
  oppScore: number
}

export function lineups(sessions: GameSession[], roster: RosterPlayer[], team?: string): LineupRow[] {
  const teamIds = team ? new Set(roster.filter((p) => p.team === team).map((p) => p.id)) : null
  return sessions
    .map((s) => {
      const present = roster.filter(
        (p) => (!teamIds || teamIds.has(p.id)) && (s.events.some((e) => e.playerId === p.id) || s.movement[p.id])
      )
      return {
        sessionId: s.id,
        date: s.date,
        opponent: s.opponent,
        players: present,
        net: s.teamScore - s.oppScore,
        teamScore: s.teamScore,
        oppScore: s.oppScore,
      }
    })
    .filter((r) => r.players.length > 0)
    .sort((a, b) => b.net - a.net)
}

export function seasonsOf(sessions: GameSession[]): string[] {
  // Group by calendar year of the session date as a lightweight "season".
  return Array.from(new Set(sessions.map((s) => s.date.slice(0, 4)))).sort().reverse()
}
