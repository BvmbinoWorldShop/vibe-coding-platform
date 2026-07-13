'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useDB, updateDB, playerSeason, uid, teamsOf } from '@/lib/basketball/store'

export default function PlayersPage() {
  const db = useDB()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [position, setPosition] = useState('PG')
  const [height, setHeight] = useState('')
  const [stride, setStride] = useState('2.5')
  const [team, setTeam] = useState('My Team')
  const [newTeam, setNewTeam] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')

  const teams = useMemo(() => teamsOf(db.roster), [db.roster])

  function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const finalTeam = (newTeam.trim() || team).trim() || 'My Team'
    updateDB((d) => ({
      ...d,
      roster: [
        ...d.roster,
        {
          id: uid(),
          name: name.trim(),
          number: Number(number) || 0,
          position,
          height: height.trim(),
          weight: '',
          strideLength: Number(stride) || 2.5,
          notes: '',
          team: finalTeam,
        },
      ],
    }))
    setName('')
    setNumber('')
    setHeight('')
    setNewTeam('')
    setTeam(finalTeam)
    setShowForm(false)
  }

  const visible = teamFilter === 'All' ? db.roster : db.roster.filter((p) => p.team === teamFilter)

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-1">
        <h1 className="text-2xl font-bold text-foreground">Players & CRM</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500"
        >
          {showForm ? 'Cancel' : '+ Add player'}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Your roster and any scouted teams you add. Every stat shown is aggregated from sessions you
        actually recorded — nothing here is simulated.
      </p>

      {showForm && (
        <form onSubmit={addPlayer} className="bg-card border border-border rounded-xl p-5 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Full name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-48" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Jersey #</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} type="number" min="0" max="99"
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-20" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Position</label>
            <select value={position} onChange={(e) => setPosition(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
              {['PG', 'SG', 'SF', 'PF', 'C'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Height</label>
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={'6\'2"'}
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-24" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Stride length (m)</label>
            <input value={stride} onChange={(e) => setStride(e.target.value)} type="number" step="0.1" min="1" max="4"
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-24" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Team</label>
            <select value={team} onChange={(e) => setTeam(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
              {teams.map((t) => <option key={t}>{t}</option>)}
              <option value="__new__" disabled>— or type a new team below —</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">New team name</label>
            <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="e.g. Metro Hawks (scouting)"
              className="px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground w-56" />
          </div>
          <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">
            Save player
          </button>
        </form>
      )}

      {db.roster.length === 0 && !showForm && (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <p className="text-foreground font-semibold mb-1">No players yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add your roster — or an opposing team for scouting — to start tracking real stats.
          </p>
          <button type="button" onClick={() => setShowForm(true)}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500">
            Add your first player
          </button>
        </div>
      )}

      {teams.length > 1 && (
        <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
          {['All', ...teams].map((t) => (
            <button key={t} type="button" onClick={() => setTeamFilter(t)}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                teamFilter === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {visible.map((p) => {
          const season = playerSeason(db.sessions, p.id)
          const g = Math.max(season.played, 1)
          return (
            <Link key={p.id} href={`/dashboard/players/profile?id=${p.id}`}
              className="bg-card border border-border rounded-xl p-4 hover:border-orange-500 transition-colors block">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white flex items-center justify-center font-bold shrink-0">
                  {p.number}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.position, p.height].filter(Boolean).join(' · ')}
                  </p>
                  {teams.length > 1 && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.team}</span>
                  )}
                </div>
              </div>
              {season.played === 0 ? (
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  No recorded sessions yet
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-bold text-foreground tabular-nums">{(season.totals.points / g).toFixed(1)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">PPG</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground tabular-nums">{(season.totals.reb / g).toFixed(1)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">RPG</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground tabular-nums">{(season.totals.ast / g).toFixed(1)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">APG</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground tabular-nums">{(season.totals.defl / g).toFixed(1)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">DEFL</p>
                  </div>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
