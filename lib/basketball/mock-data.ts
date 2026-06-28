import type {
  Player,
  Game,
  PlayerGameStats,
  ShotAttempt,
  QuarterStats,
  PlayByPlay,
  Workout,
  MealPlan,
  RestRecord,
  LiveGameState,
  TeamSeasonStats,
} from './types'

export const players: Player[] = [
  {
    id: 'p1',
    firstName: 'Marcus',
    lastName: 'Johnson',
    number: 1,
    position: 'PG',
    height: "6'2\"",
    weight: 190,
    age: 27,
    photo: '',
    strideLength: 2.4,
    wingspan: "6'7\"",
    standingReach: "8'4\"",
    verticalLeap: 38,
    status: 'active',
    notes: 'Team captain. Elite court vision.',
  },
  {
    id: 'p2',
    firstName: 'DeAndre',
    lastName: 'Williams',
    number: 23,
    position: 'SG',
    height: "6'5\"",
    weight: 210,
    age: 24,
    photo: '',
    strideLength: 2.6,
    wingspan: "6'10\"",
    standingReach: "8'7\"",
    verticalLeap: 42,
    status: 'active',
    notes: 'Elite scorer. Needs to improve defensive consistency.',
  },
  {
    id: 'p3',
    firstName: 'James',
    lastName: 'Carter',
    number: 7,
    position: 'SF',
    height: "6'8\"",
    weight: 225,
    age: 26,
    photo: '',
    strideLength: 2.7,
    wingspan: "7'0\"",
    standingReach: "8'11\"",
    verticalLeap: 36,
    status: 'active',
    notes: 'Two-way player. High basketball IQ.',
  },
  {
    id: 'p4',
    firstName: 'Anthony',
    lastName: 'Davis',
    number: 34,
    position: 'PF',
    height: "6'10\"",
    weight: 245,
    age: 28,
    photo: '',
    strideLength: 2.8,
    wingspan: "7'3\"",
    standingReach: "9'2\"",
    verticalLeap: 34,
    status: 'active',
    notes: 'Interior presence. Elite shot blocker.',
  },
  {
    id: 'p5',
    firstName: 'Tobias',
    lastName: 'Mitchell',
    number: 50,
    position: 'C',
    height: "7'0\"",
    weight: 260,
    age: 25,
    photo: '',
    strideLength: 2.9,
    wingspan: "7'5\"",
    standingReach: "9'6\"",
    verticalLeap: 30,
    status: 'active',
    notes: 'Anchor of the defense. Improving passing.',
  },
  {
    id: 'p6',
    firstName: 'Kyle',
    lastName: 'Thompson',
    number: 11,
    position: 'PG',
    height: "6'1\"",
    weight: 185,
    age: 23,
    photo: '',
    strideLength: 2.3,
    wingspan: "6'5\"",
    standingReach: "8'2\"",
    verticalLeap: 36,
    status: 'active',
    notes: 'Backup PG. Strong 3-point shooter.',
  },
  {
    id: 'p7',
    firstName: 'Rashid',
    lastName: 'Brooks',
    number: 15,
    position: 'SG',
    height: "6'4\"",
    weight: 200,
    age: 22,
    photo: '',
    strideLength: 2.5,
    wingspan: "6'8\"",
    standingReach: "8'5\"",
    verticalLeap: 40,
    status: 'active',
    notes: 'Athletic wing. Developing shot.',
  },
  {
    id: 'p8',
    firstName: 'Chris',
    lastName: 'Okafor',
    number: 42,
    position: 'PF',
    height: "6'9\"",
    weight: 235,
    age: 30,
    photo: '',
    strideLength: 2.7,
    wingspan: "7'1\"",
    standingReach: "9'0\"",
    verticalLeap: 32,
    status: 'injured',
    notes: 'Veteran leader. Out with hamstring strain.',
  },
  {
    id: 'p9',
    firstName: 'Jordan',
    lastName: 'Lee',
    number: 3,
    position: 'SF',
    height: "6'7\"",
    weight: 215,
    age: 25,
    photo: '',
    strideLength: 2.6,
    wingspan: "6'11\"",
    standingReach: "8'9\"",
    verticalLeap: 38,
    status: 'active',
    notes: 'Versatile defender. Can guard 1-4.',
  },
  {
    id: 'p10',
    firstName: 'Darius',
    lastName: 'Young',
    number: 21,
    position: 'C',
    height: "6'11\"",
    weight: 250,
    age: 24,
    photo: '',
    strideLength: 2.8,
    wingspan: "7'4\"",
    standingReach: "9'4\"",
    verticalLeap: 28,
    status: 'rest',
    notes: 'Backup center. Load management day.',
  },
]

function generateShots(gameId: string): ShotAttempt[] {
  const zones = [
    { name: 'Paint', x: [35, 65], y: [75, 95], type: '2PT' as const },
    { name: 'Mid Left', x: [10, 35], y: [55, 75], type: '2PT' as const },
    { name: 'Mid Right', x: [65, 90], y: [55, 75], type: '2PT' as const },
    { name: 'Mid Top', x: [30, 70], y: [45, 65], type: '2PT' as const },
    { name: 'Left Elbow', x: [25, 40], y: [55, 70], type: '2PT' as const },
    { name: 'Right Elbow', x: [60, 75], y: [55, 70], type: '2PT' as const },
    { name: '3PT Left Corner', x: [5, 15], y: [78, 95], type: '3PT' as const },
    { name: '3PT Right Corner', x: [85, 95], y: [78, 95], type: '3PT' as const },
    { name: '3PT Left Wing', x: [8, 25], y: [45, 65], type: '3PT' as const },
    { name: '3PT Right Wing', x: [75, 92], y: [45, 65], type: '3PT' as const },
    { name: '3PT Top', x: [30, 70], y: [30, 45], type: '3PT' as const },
  ]

  const shots: ShotAttempt[] = []
  const playerIds = players.slice(0, 5).map((p) => p.id)

  for (let i = 0; i < 85; i++) {
    const zone = zones[Math.floor(Math.random() * zones.length)]
    const playerId = playerIds[Math.floor(Math.random() * playerIds.length)]
    const quarter = Math.floor(Math.random() * 4) + 1
    const made = Math.random() > (zone.type === '3PT' ? 0.64 : 0.5)

    shots.push({
      id: `${gameId}-shot-${i}`,
      playerId,
      x: zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]),
      y: zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]),
      made,
      shotType: zone.type,
      shotZone: zone.name,
      quarter,
      timeRemaining: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      assisted: made && Math.random() > 0.4,
      assistedBy: made && Math.random() > 0.4 ? playerIds[Math.floor(Math.random() * playerIds.length)] : undefined,
      contested: Math.random() > 0.35,
      shotDistance: zone.type === '3PT' ? 22 + Math.random() * 8 : 2 + Math.random() * 16,
    })
  }

  return shots
}

function generatePlayerStats(playerId: string, starter: boolean): PlayerGameStats {
  const mins = starter ? 28 + Math.floor(Math.random() * 12) : 10 + Math.floor(Math.random() * 15)
  const fga = Math.floor(mins * 0.45 + Math.random() * 5)
  const fgm = Math.floor(fga * (0.4 + Math.random() * 0.2))
  const tpa = Math.floor(fga * 0.35)
  const tpm = Math.floor(tpa * (0.3 + Math.random() * 0.15))
  const fta = Math.floor(Math.random() * 8)
  const ftm = Math.floor(fta * (0.7 + Math.random() * 0.25))

  return {
    playerId,
    minutes: mins,
    points: fgm * 2 - tpm + tpm * 3 + ftm,
    fgMade: fgm,
    fgAttempted: fga,
    threePtMade: tpm,
    threePtAttempted: tpa,
    ftMade: ftm,
    ftAttempted: fta,
    offRebounds: Math.floor(Math.random() * 4),
    defRebounds: Math.floor(Math.random() * 8),
    totalRebounds: 0,
    assists: Math.floor(Math.random() * (playerId === 'p1' ? 12 : 6)),
    steals: Math.floor(Math.random() * 3),
    blocks: Math.floor(Math.random() * 3),
    turnovers: Math.floor(Math.random() * 4),
    personalFouls: Math.floor(Math.random() * 5),
    plusMinus: Math.floor(Math.random() * 30) - 15,
    deflections: Math.floor(Math.random() * 6),
    tips: Math.floor(Math.random() * 3),
    chargesDrawn: Math.floor(Math.random() * 2),
    screenAssists: Math.floor(Math.random() * 5),
    hockeyAssists: Math.floor(Math.random() * 4),
    looseBalls: Math.floor(Math.random() * 3),
    boxOuts: Math.floor(Math.random() * 6),
    contestedShots: Math.floor(Math.random() * 8),
    milesRun: +(mins * 0.12 + Math.random() * 0.5).toFixed(1),
    avgSpeed: +(3.5 + Math.random() * 1.5).toFixed(1),
    maxSpeed: +(15 + Math.random() * 5).toFixed(1),
    touches: Math.floor(mins * 2 + Math.random() * 20),
    passesLeadingToAssist: Math.floor(Math.random() * 4),
    pointsInPaint: Math.floor(Math.random() * 10),
    fastBreakPoints: Math.floor(Math.random() * 6),
    secondChancePoints: Math.floor(Math.random() * 4),
  }
}

function generatePlays(gameId: string): PlayByPlay[] {
  const actions: { action: PlayByPlay['action']; detail: string }[] = [
    { action: 'FG_MADE', detail: 'driving layup' },
    { action: 'FG_MADE', detail: 'pull-up jumper' },
    { action: 'FG_MISS', detail: 'contested mid-range' },
    { action: '3PT_MADE', detail: 'catch-and-shoot three' },
    { action: '3PT_MISS', detail: 'step-back three' },
    { action: 'FT_MADE', detail: 'free throw 1 of 2' },
    { action: 'DREB', detail: 'defensive rebound' },
    { action: 'OREB', detail: 'offensive rebound' },
    { action: 'AST', detail: 'assist on basket' },
    { action: 'STL', detail: 'steal in passing lane' },
    { action: 'BLK', detail: 'block at the rim' },
    { action: 'TOV', detail: 'bad pass turnover' },
    { action: 'DEFLECTION', detail: 'deflected pass' },
    { action: 'TIP', detail: 'tip rebound' },
    { action: 'HOCKEY_AST', detail: 'hockey assist' },
    { action: 'BOX_OUT', detail: 'box out' },
    { action: 'CONTESTED_SHOT', detail: 'contested shot' },
    { action: 'LOOSE_BALL', detail: 'loose ball recovery' },
    { action: 'SCREEN_AST', detail: 'screen assist' },
    { action: 'CHARGE_DRAWN', detail: 'charge drawn' },
  ]

  const plays: PlayByPlay[] = []
  const playerIds = players.slice(0, 8).map((p) => p.id)

  for (let q = 1; q <= 4; q++) {
    for (let i = 0; i < 25; i++) {
      const play = actions[Math.floor(Math.random() * actions.length)]
      const mins = 12 - Math.floor((i / 25) * 12)
      const secs = Math.floor(Math.random() * 60)
      plays.push({
        id: `${gameId}-play-${q}-${i}`,
        gameId,
        quarter: q,
        timeRemaining: `${mins}:${String(secs).padStart(2, '0')}`,
        playerId: playerIds[Math.floor(Math.random() * playerIds.length)],
        action: play.action,
        details: play.detail,
        points: play.action.includes('MADE') ? (play.action === '3PT_MADE' ? 3 : 2) : undefined,
      })
    }
  }

  return plays
}

function makeQuarterStats(q: number): QuarterStats {
  return {
    quarter: q,
    teamScore: 22 + Math.floor(Math.random() * 12),
    opponentScore: 20 + Math.floor(Math.random() * 14),
    fgPercentage: +(42 + Math.random() * 16).toFixed(1),
    turnovers: Math.floor(Math.random() * 5) + 1,
    rebounds: 8 + Math.floor(Math.random() * 6),
    assists: 4 + Math.floor(Math.random() * 6),
    fastBreakPoints: Math.floor(Math.random() * 8),
    pointsInPaint: 6 + Math.floor(Math.random() * 10),
  }
}

export const games: Game[] = [
  {
    id: 'g1',
    date: '2026-06-25',
    opponent: 'Metro Hawks',
    opponentLogo: '',
    location: 'home',
    result: 'W',
    teamScore: 112,
    opponentScore: 104,
    status: 'completed',
    quarterScores: [1, 2, 3, 4].map(makeQuarterStats),
    playerStats: players.map((p, i) => {
      const s = generatePlayerStats(p.id, i < 5)
      s.totalRebounds = s.offRebounds + s.defRebounds
      return s
    }),
    shots: generateShots('g1'),
    plays: generatePlays('g1'),
  },
  {
    id: 'g2',
    date: '2026-06-22',
    opponent: 'Bay Wolves',
    opponentLogo: '',
    location: 'away',
    result: 'L',
    teamScore: 98,
    opponentScore: 105,
    status: 'completed',
    quarterScores: [1, 2, 3, 4].map(makeQuarterStats),
    playerStats: players.map((p, i) => {
      const s = generatePlayerStats(p.id, i < 5)
      s.totalRebounds = s.offRebounds + s.defRebounds
      return s
    }),
    shots: generateShots('g2'),
    plays: generatePlays('g2'),
  },
  {
    id: 'g3',
    date: '2026-06-19',
    opponent: 'Summit Kings',
    opponentLogo: '',
    location: 'home',
    result: 'W',
    teamScore: 118,
    opponentScore: 110,
    status: 'completed',
    quarterScores: [1, 2, 3, 4].map(makeQuarterStats),
    playerStats: players.map((p, i) => {
      const s = generatePlayerStats(p.id, i < 5)
      s.totalRebounds = s.offRebounds + s.defRebounds
      return s
    }),
    shots: generateShots('g3'),
    plays: generatePlays('g3'),
  },
  {
    id: 'g4',
    date: '2026-06-16',
    opponent: 'River Dragons',
    opponentLogo: '',
    location: 'away',
    result: 'W',
    teamScore: 106,
    opponentScore: 99,
    status: 'completed',
    quarterScores: [1, 2, 3, 4].map(makeQuarterStats),
    playerStats: players.map((p, i) => {
      const s = generatePlayerStats(p.id, i < 5)
      s.totalRebounds = s.offRebounds + s.defRebounds
      return s
    }),
    shots: generateShots('g4'),
    plays: generatePlays('g4'),
  },
  {
    id: 'g5',
    date: '2026-06-13',
    opponent: 'Steel Thunder',
    opponentLogo: '',
    location: 'home',
    result: 'L',
    teamScore: 95,
    opponentScore: 102,
    status: 'completed',
    quarterScores: [1, 2, 3, 4].map(makeQuarterStats),
    playerStats: players.map((p, i) => {
      const s = generatePlayerStats(p.id, i < 5)
      s.totalRebounds = s.offRebounds + s.defRebounds
      return s
    }),
    shots: generateShots('g5'),
    plays: generatePlays('g5'),
  },
]

export const workouts: Workout[] = [
  { id: 'w1', playerId: 'p1', date: '2026-06-27', type: 'shooting', duration: 90, intensity: 'high', description: '3-point shooting drills, catch-and-shoot, off-screen', completed: true },
  { id: 'w2', playerId: 'p1', date: '2026-06-26', type: 'conditioning', duration: 60, intensity: 'medium', description: 'Court sprints, ladder drills, defensive slides', completed: true },
  { id: 'w3', playerId: 'p1', date: '2026-06-28', type: 'film', duration: 45, intensity: 'low', description: 'Breakdown of pick-and-roll defense vs Metro Hawks', completed: false },
  { id: 'w4', playerId: 'p2', date: '2026-06-27', type: 'strength', duration: 75, intensity: 'high', description: 'Upper body: bench press, shoulder press, rows', completed: true },
  { id: 'w5', playerId: 'p2', date: '2026-06-28', type: 'shooting', duration: 60, intensity: 'medium', description: 'Mid-range game, footwork in the post', completed: false },
  { id: 'w6', playerId: 'p3', date: '2026-06-27', type: 'agility', duration: 60, intensity: 'high', description: 'Lateral quickness, cone drills, reaction time', completed: true },
  { id: 'w7', playerId: 'p4', date: '2026-06-27', type: 'recovery', duration: 30, intensity: 'low', description: 'Ice bath, stretching, foam rolling', completed: true },
  { id: 'w8', playerId: 'p5', date: '2026-06-28', type: 'strength', duration: 90, intensity: 'high', description: 'Lower body: squats, deadlifts, calf raises', completed: false },
  { id: 'w9', playerId: 'p3', date: '2026-06-28', type: 'shooting', duration: 75, intensity: 'medium', description: 'Corner 3s, transition 3s, pull-up shooting', completed: false },
  { id: 'w10', playerId: 'p4', date: '2026-06-28', type: 'film', duration: 60, intensity: 'low', description: 'Post defense review, help-side rotations', completed: false },
]

export const mealPlans: MealPlan[] = [
  { id: 'm1', playerId: 'p1', date: '2026-06-28', meal: 'breakfast', calories: 650, protein: 40, carbs: 75, fat: 20, description: 'Egg whites, oatmeal with berries, Greek yogurt' },
  { id: 'm2', playerId: 'p1', date: '2026-06-28', meal: 'lunch', calories: 850, protein: 55, carbs: 90, fat: 25, description: 'Grilled chicken breast, brown rice, steamed vegetables' },
  { id: 'm3', playerId: 'p1', date: '2026-06-28', meal: 'pre-game', calories: 500, protein: 25, carbs: 70, fat: 10, description: 'Pasta with lean turkey, banana, electrolyte drink' },
  { id: 'm4', playerId: 'p1', date: '2026-06-28', meal: 'post-game', calories: 700, protein: 50, carbs: 80, fat: 15, description: 'Protein shake, sweet potato, salmon' },
  { id: 'm5', playerId: 'p2', date: '2026-06-28', meal: 'breakfast', calories: 700, protein: 45, carbs: 80, fat: 22, description: 'Scrambled eggs, whole wheat toast, avocado, fruit' },
  { id: 'm6', playerId: 'p2', date: '2026-06-28', meal: 'lunch', calories: 900, protein: 60, carbs: 95, fat: 28, description: 'Steak bowl with quinoa, black beans, vegetables' },
  { id: 'm7', playerId: 'p3', date: '2026-06-28', meal: 'breakfast', calories: 600, protein: 35, carbs: 70, fat: 18, description: 'Smoothie bowl with protein powder, granola, berries' },
  { id: 'm8', playerId: 'p4', date: '2026-06-28', meal: 'lunch', calories: 950, protein: 65, carbs: 100, fat: 30, description: 'Double chicken breast, jasmine rice, mixed greens' },
]

export const restRecords: RestRecord[] = [
  { id: 'r1', playerId: 'p1', date: '2026-06-28', sleepHours: 8.5, sleepQuality: 5, recoveryScore: 92, soreness: 'none', notes: 'Feeling great after rest day' },
  { id: 'r2', playerId: 'p1', date: '2026-06-27', sleepHours: 7.0, sleepQuality: 3, recoveryScore: 78, soreness: 'mild', notes: 'Slight tightness in left calf' },
  { id: 'r3', playerId: 'p2', date: '2026-06-28', sleepHours: 9.0, sleepQuality: 5, recoveryScore: 95, soreness: 'none', notes: 'Fully recovered' },
  { id: 'r4', playerId: 'p2', date: '2026-06-27', sleepHours: 6.5, sleepQuality: 2, recoveryScore: 65, soreness: 'moderate', notes: 'Late night, need better routine' },
  { id: 'r5', playerId: 'p3', date: '2026-06-28', sleepHours: 8.0, sleepQuality: 4, recoveryScore: 88, soreness: 'mild', notes: 'Good sleep, minor knee stiffness' },
  { id: 'r6', playerId: 'p4', date: '2026-06-28', sleepHours: 7.5, sleepQuality: 4, recoveryScore: 85, soreness: 'mild', notes: 'Back tightness from game' },
  { id: 'r7', playerId: 'p5', date: '2026-06-28', sleepHours: 8.0, sleepQuality: 4, recoveryScore: 82, soreness: 'none', notes: 'Ready to go' },
  { id: 'r8', playerId: 'p8', date: '2026-06-28', sleepHours: 9.5, sleepQuality: 5, recoveryScore: 60, soreness: 'severe', notes: 'Hamstring rehab ongoing' },
]

export const liveGameState: LiveGameState = {
  gameId: 'g-live',
  quarter: 3,
  timeRemaining: '7:24',
  shotClock: 14,
  teamScore: 67,
  opponentScore: 62,
  possession: 'team',
  playerPositions: [
    { playerId: 'p1', x: 45, y: 65, hasBall: true },
    { playerId: 'p2', x: 78, y: 45, hasBall: false },
    { playerId: 'p3', x: 20, y: 50, hasBall: false },
    { playerId: 'p4', x: 55, y: 82, hasBall: false },
    { playerId: 'p5', x: 50, y: 90, hasBall: false },
  ],
  ballPosition: { x: 45, y: 65 },
}

export const teamSeasonStats: TeamSeasonStats = {
  wins: 38,
  losses: 16,
  pointsPerGame: 112.4,
  oppPointsPerGame: 106.8,
  fgPercentage: 47.2,
  threePtPercentage: 37.8,
  reboundsPerGame: 44.6,
  assistsPerGame: 26.3,
  stealsPerGame: 8.1,
  blocksPerGame: 5.4,
  turnoversPerGame: 13.2,
}
