// Client-side fetchers for live professional basketball data.
// Sources: ESPN public scoreboard API (NBA live/latest) and TheSportsDB
// (world leagues, past results, player search). Both allow CORS from the
// browser, so all requests run client-side and get fresh data on every load.

export interface ProGame {
  id: string
  league: string
  date: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string
  live: boolean
}

export interface ProPlayer {
  id: string
  name: string
  team: string
  nationality: string
  position: string
  height: string
  weight: string
  born: string
  photo: string
  description: string
  league: string
}

export interface LeagueBoard {
  key: string
  name: string
  region: 'USA' | 'Europe' | 'Asia-Pacific'
  division: 1 | 2
  games: ProGame[]
  error?: string
}

const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3'

// Curated world leagues. TheSportsDB ids are resolved at runtime by name so
// stale ids never break the page; `fallbackId` covers the common ones.
const LEAGUES: {
  key: string
  name: string
  match: string[]
  region: LeagueBoard['region']
  division: 1 | 2
  fallbackId?: string
}[] = [
  { key: 'nba', name: 'NBA', match: ['nba'], region: 'USA', division: 1, fallbackId: '4387' },
  { key: 'gleague', name: 'NBA G League', match: ['g league', 'g-league'], region: 'USA', division: 2 },
  { key: 'euroleague', name: 'EuroLeague', match: ['euroleague'], region: 'Europe', division: 1 },
  { key: 'acb', name: 'Liga ACB (Spain)', match: ['liga acb', 'spanish liga acb'], region: 'Europe', division: 1 },
  { key: 'lebOro', name: 'Primera FEB / LEB Oro (Spain 2nd)', match: ['leb oro', 'primera feb'], region: 'Europe', division: 2 },
  { key: 'lnbProA', name: 'LNB Élite (France)', match: ['lnb', 'french pro a', 'betclic elite', 'betclic élite'], region: 'Europe', division: 1 },
  { key: 'lnbProB', name: 'LNB Pro B (France 2nd)', match: ['pro b'], region: 'Europe', division: 2 },
  { key: 'legaA', name: 'Lega Basket Serie A (Italy)', match: ['lega basket', 'italian serie a basketball'], region: 'Europe', division: 1 },
  { key: 'bsl', name: 'Basketbol Süper Ligi (Turkey)', match: ['super ligi', 'süper ligi', 'turkish basketball'], region: 'Europe', division: 1 },
  { key: 'gbl', name: 'Greek Basket League', match: ['greek basket'], region: 'Europe', division: 1 },
  { key: 'cba', name: 'CBA (China)', match: ['chinese basketball', 'cba'], region: 'Asia-Pacific', division: 1 },
  { key: 'bleague', name: 'B.League (Japan)', match: ['b.league', 'b league'], region: 'Asia-Pacific', division: 1 },
  { key: 'nbl', name: 'NBL (Australia)', match: ['australian nbl', 'nbl australia'], region: 'Asia-Pacific', division: 1 },
]

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

type SportsDbLeague = { idLeague?: string; strLeague?: string; strSport?: string }
type SportsDbEvent = {
  idEvent?: string
  strLeague?: string
  dateEvent?: string
  strHomeTeam?: string
  strAwayTeam?: string
  intHomeScore?: string | null
  intAwayScore?: string | null
  strStatus?: string
}
type SportsDbPlayer = {
  idPlayer?: string
  strPlayer?: string
  strTeam?: string
  strNationality?: string
  strPosition?: string
  strHeight?: string
  strWeight?: string
  dateBorn?: string
  strCutout?: string
  strThumb?: string
  strDescriptionEN?: string
  strSport?: string
  strTeamLeague?: string
}

let leagueIdCache: Map<string, string> | null = null

async function resolveLeagueIds(): Promise<Map<string, string>> {
  if (leagueIdCache) return leagueIdCache
  const ids = new Map<string, string>()
  try {
    const data = (await getJson(`${SPORTSDB}/search_all_leagues.php?s=Basketball`)) as {
      countries?: SportsDbLeague[]
    }
    const all = data.countries ?? []
    for (const league of LEAGUES) {
      const hit = all.find((l) => {
        const name = (l.strLeague ?? '').toLowerCase()
        return league.match.some((m) => name.includes(m))
      })
      if (hit?.idLeague) ids.set(league.key, hit.idLeague)
    }
  } catch {
    // fall through to fallback ids
  }
  for (const league of LEAGUES) {
    if (!ids.has(league.key) && league.fallbackId) ids.set(league.key, league.fallbackId)
  }
  leagueIdCache = ids
  return ids
}

function parseSportsDbEvents(events: SportsDbEvent[], leagueName: string): ProGame[] {
  return events
    .filter((e) => e.strHomeTeam && e.strAwayTeam)
    .map((e) => ({
      id: e.idEvent ?? `${e.dateEvent}-${e.strHomeTeam}`,
      league: leagueName,
      date: e.dateEvent ?? '',
      home: e.strHomeTeam ?? '',
      away: e.strAwayTeam ?? '',
      homeScore: e.intHomeScore != null && e.intHomeScore !== '' ? Number(e.intHomeScore) : null,
      awayScore: e.intAwayScore != null && e.intAwayScore !== '' ? Number(e.intAwayScore) : null,
      status: e.strStatus || 'Final',
      live: false,
    }))
}

// ESPN scoreboard: shows live games in progress plus today's finals.
type EspnCompetitor = {
  homeAway?: string
  score?: string
  team?: { displayName?: string; shortDisplayName?: string }
}
type EspnEvent = {
  id?: string
  date?: string
  status?: { type?: { state?: string; shortDetail?: string; completed?: boolean } }
  competitions?: { competitors?: EspnCompetitor[] }[]
}

export async function fetchNbaScoreboard(): Promise<ProGame[]> {
  const data = (await getJson(
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
  )) as { events?: EspnEvent[] }
  return (data.events ?? []).map((e) => {
    const comp = e.competitions?.[0]?.competitors ?? []
    const home = comp.find((c) => c.homeAway === 'home')
    const away = comp.find((c) => c.homeAway === 'away')
    const state = e.status?.type?.state ?? ''
    return {
      id: e.id ?? '',
      league: 'NBA',
      date: (e.date ?? '').slice(0, 10),
      home: home?.team?.displayName ?? '',
      away: away?.team?.displayName ?? '',
      homeScore: home?.score != null ? Number(home.score) : null,
      awayScore: away?.score != null ? Number(away.score) : null,
      status: e.status?.type?.shortDetail ?? '',
      live: state === 'in',
    }
  })
}

export async function fetchLeagueBoards(): Promise<LeagueBoard[]> {
  const ids = await resolveLeagueIds()
  const boards = await Promise.all(
    LEAGUES.map(async (league): Promise<LeagueBoard> => {
      const base: LeagueBoard = {
        key: league.key,
        name: league.name,
        region: league.region,
        division: league.division,
        games: [],
      }
      try {
        if (league.key === 'nba') {
          // Prefer ESPN for the NBA: it includes live in-progress games.
          try {
            const espn = await fetchNbaScoreboard()
            if (espn.length > 0) return { ...base, games: espn.slice(0, 8) }
          } catch {
            // fall back to TheSportsDB below
          }
        }
        const id = ids.get(league.key)
        if (!id) return { ...base, error: 'League not found in data source' }
        const data = (await getJson(`${SPORTSDB}/eventspastleague.php?id=${id}`)) as {
          events?: SportsDbEvent[] | null
        }
        return { ...base, games: parseSportsDbEvents(data.events ?? [], league.name).slice(0, 8) }
      } catch (err) {
        return { ...base, error: err instanceof Error ? err.message : 'Failed to load' }
      }
    })
  )
  return boards
}

export async function searchProPlayers(query: string): Promise<ProPlayer[]> {
  const data = (await getJson(
    `${SPORTSDB}/searchplayers.php?p=${encodeURIComponent(query)}`
  )) as { player?: SportsDbPlayer[] | null }
  return (data.player ?? [])
    .filter((p) => (p.strSport ?? '').toLowerCase() === 'basketball')
    .map((p) => ({
      id: p.idPlayer ?? p.strPlayer ?? '',
      name: p.strPlayer ?? '',
      team: p.strTeam ?? 'Free agent',
      nationality: p.strNationality ?? '',
      position: p.strPosition ?? '',
      height: p.strHeight ?? '',
      weight: p.strWeight ?? '',
      born: p.dateBorn ?? '',
      photo: p.strCutout || p.strThumb || '',
      description: (p.strDescriptionEN ?? '').slice(0, 320),
      league: p.strTeamLeague ?? '',
    }))
}
