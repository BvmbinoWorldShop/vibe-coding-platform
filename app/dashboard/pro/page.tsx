'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchLeagueBoards,
  searchProPlayers,
  type LeagueBoard,
  type ProPlayer,
} from '@/lib/basketball/pro-data'

const REGIONS = ['All', 'USA', 'Europe', 'Asia-Pacific'] as const

export default function ProLeaguesPage() {
  const [boards, setBoards] = useState<LeagueBoard[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('All')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProPlayer[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLeagueBoards()
      setBoards(data)
      setRefreshedAt(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true)
    setSearchError(null)
    try {
      setResults(await searchProPlayers(q))
    } catch {
      setSearchError('Search unavailable — check your connection and try again.')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const visible = useMemo(() => {
    if (!boards) return []
    const list = region === 'All' ? boards : boards.filter((b) => b.region === region)
    // Leagues with data first, division 1 before division 2.
    return [...list].sort(
      (a, b) => Number(b.games.length > 0) - Number(a.games.length > 0) || a.division - b.division
    )
  }, [boards, region])

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-1">
        <h1 className="text-2xl font-bold text-foreground">Pro Leagues</h1>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Latest results from the top professional leagues — 1st and 2nd divisions across the USA,
        Europe and Asia-Pacific. Data is pulled live from ESPN and TheSportsDB on every load.
        {refreshedAt && (
          <span className="ml-2 text-xs">Updated {refreshedAt.toLocaleTimeString()}</span>
        )}
      </p>

      {/* Player search */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-1">Player Scouting Search</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Search any professional player — NBA, EuroLeague, national leagues in Europe, Asia and
          beyond.
        </p>
        <form onSubmit={runSearch} className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Victor Wembanyama, Luka Doncic, Yuki Kawamura…"
            className="flex-1 min-w-[220px] px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 3}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && <p className="text-sm text-red-500 mt-3">{searchError}</p>}
        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            No basketball players found for “{query}”. Try the full name.
          </p>
        )}
        {results && results.length > 0 && (
          <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {results.map((p) => (
              <div key={p.id} className="border border-border rounded-lg p-4 flex gap-3 bg-background">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo}
                    alt={p.name}
                    className="w-16 h-16 rounded-lg object-cover object-top bg-muted shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                    {p.name
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.team}
                    {p.league ? ` · ${p.league}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[p.position, p.height, p.nationality].filter(Boolean).join(' · ')}
                  </p>
                  {p.born && <p className="text-xs text-muted-foreground">Born {p.born}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Region filter */}
      <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              region === r
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* League boards */}
      {loading && !boards && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-64" />
          ))}
        </div>
      )}

      {boards && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {visible.map((b) => (
            <div key={b.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.region}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
                    b.division === 1
                      ? 'bg-orange-500/10 text-orange-500'
                      : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {b.division === 1 ? '1st Division' : '2nd Division'}
                </span>
              </div>
              {b.error || b.games.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {b.error ?? 'No recent results available from the data source.'}
                </p>
              ) : (
                <div>
                  {b.games.map((g) => (
                    <div
                      key={g.id}
                      className="px-4 py-2.5 border-b border-border last:border-0 text-sm flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{g.away}</p>
                        <p className="truncate text-foreground">{g.home}</p>
                      </div>
                      <div className="text-right font-bold tabular-nums text-foreground">
                        <p>{g.awayScore ?? '–'}</p>
                        <p>{g.homeScore ?? '–'}</p>
                      </div>
                      <div className="w-20 shrink-0 text-right">
                        {g.live ? (
                          <span className="text-xs font-semibold text-red-500 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{g.date || g.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-8">
        Sources: ESPN public scoreboard API (NBA, includes live games) and TheSportsDB community
        database (world leagues, results, players). Results refresh on every page load.
      </p>
    </div>
  )
}
