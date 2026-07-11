export interface Player {
  id: string
  firstName: string
  lastName: string
  number: number
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  height: string
  weight: number
  age: number
  photo: string
  strideLength: number
  wingspan: string
  standingReach: string
  verticalLeap: number
  status: 'active' | 'injured' | 'rest'
  notes: string
}

export interface ShotAttempt {
  id: string
  playerId: string
  x: number
  y: number
  made: boolean
  shotType: '2PT' | '3PT' | 'FT'
  shotZone: string
  quarter: number
  timeRemaining: string
  assisted: boolean
  assistedBy?: string
  contested: boolean
  shotDistance: number
}

export interface PlayByPlay {
  id: string
  gameId: string
  quarter: number
  timeRemaining: string
  playerId: string
  action: PlayAction
  details: string
  points?: number
  relatedPlayerId?: string
}

export type PlayAction =
  | 'FG_MADE'
  | 'FG_MISS'
  | '3PT_MADE'
  | '3PT_MISS'
  | 'FT_MADE'
  | 'FT_MISS'
  | 'OREB'
  | 'DREB'
  | 'AST'
  | 'STL'
  | 'BLK'
  | 'TOV'
  | 'PF'
  | 'DEFLECTION'
  | 'TIP'
  | 'CHARGE_DRAWN'
  | 'SCREEN_AST'
  | 'HOCKEY_AST'
  | 'LOOSE_BALL'
  | 'BOX_OUT'
  | 'CONTESTED_SHOT'

export interface PlayerGameStats {
  playerId: string
  minutes: number
  points: number
  fgMade: number
  fgAttempted: number
  threePtMade: number
  threePtAttempted: number
  ftMade: number
  ftAttempted: number
  offRebounds: number
  defRebounds: number
  totalRebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  personalFouls: number
  plusMinus: number
  deflections: number
  tips: number
  chargesDrawn: number
  screenAssists: number
  hockeyAssists: number
  looseBalls: number
  boxOuts: number
  contestedShots: number
  milesRun: number
  avgSpeed: number
  maxSpeed: number
  touches: number
  passesLeadingToAssist: number
  pointsInPaint: number
  fastBreakPoints: number
  secondChancePoints: number
}

export interface QuarterStats {
  quarter: number
  teamScore: number
  opponentScore: number
  fgPercentage: number
  turnovers: number
  rebounds: number
  assists: number
  fastBreakPoints: number
  pointsInPaint: number
}

export interface Game {
  id: string
  date: string
  opponent: string
  opponentLogo: string
  location: 'home' | 'away'
  result: 'W' | 'L'
  teamScore: number
  opponentScore: number
  status: 'completed' | 'live' | 'upcoming'
  quarterScores: QuarterStats[]
  playerStats: PlayerGameStats[]
  shots: ShotAttempt[]
  plays: PlayByPlay[]
}

export interface Workout {
  id: string
  playerId: string
  date: string
  type: 'strength' | 'conditioning' | 'shooting' | 'agility' | 'recovery' | 'film'
  duration: number
  intensity: 'low' | 'medium' | 'high'
  description: string
  completed: boolean
}

export interface MealPlan {
  id: string
  playerId: string
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-game' | 'post-game'
  calories: number
  protein: number
  carbs: number
  fat: number
  description: string
}

export interface RestRecord {
  id: string
  playerId: string
  date: string
  sleepHours: number
  sleepQuality: 1 | 2 | 3 | 4 | 5
  recoveryScore: number
  soreness: 'none' | 'mild' | 'moderate' | 'severe'
  notes: string
}

export interface PlayerPosition {
  playerId: string
  x: number
  y: number
  hasBall: boolean
}

export interface LiveGameState {
  gameId: string
  quarter: number
  timeRemaining: string
  shotClock: number
  teamScore: number
  opponentScore: number
  possession: 'team' | 'opponent'
  playerPositions: PlayerPosition[]
  ballPosition: { x: number; y: number }
}

export interface TeamSeasonStats {
  wins: number
  losses: number
  pointsPerGame: number
  oppPointsPerGame: number
  fgPercentage: number
  threePtPercentage: number
  reboundsPerGame: number
  assistsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  turnoversPerGame: number
}
