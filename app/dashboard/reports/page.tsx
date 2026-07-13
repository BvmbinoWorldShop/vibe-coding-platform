'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useDB, statLine, tagByType, type GameSession } from '@/lib/basketball/store'
import { playerAnalytics } from '@/lib/basketball/analytics'

function download(name: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

export default function ReportsPage() {
  const db = useDB()
  const [scope, setScope] = useState<'all' | string>('all') // 'all' or a session id

  const sessions = useMemo<GameSession[]>(
    () => (scope === 'all' ? db.sessions : db.sessions.filter((s) => s.id === scope)),
    [db.sessions, scope]
  )

  function exportBoxScoreCsv() {
    const header = ['Player', 'Team', 'G', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA', 'REB', 'AST', 'HCKY', 'STL', 'BLK', 'DEFL', 'TOV', 'DIST_m', 'STRIDES', 'MAX_KMH']
    const rows: (string | number)[][] = [header]
    for (const p of db.roster) {
      const a = playerAnalytics(sessions, p)
      if (a.games === 0) continue
      const t = a.totals
      rows.push([
        p.name, p.team, a.games, t.points, t.fgm, t.fga, t.tpm, t.tpa, t.ftm, t.fta,
        t.reb, t.ast, t.hast, t.stl, t.blk, t.defl, t.tov,
        a.distanceM.toFixed(0), a.strides, a.maxSpeedKmh.toFixed(1),
      ])
    }
    download(`box-score-${scope === 'all' ? 'season' : scope}.csv`, csv(rows))
  }

  function exportEventsCsv() {
    const rows: (string | number)[][] = [['Date', 'Opponent', 'Time', 'Player', 'Number', 'Event']]
    for (const s of sessions) {
      for (const e of s.events) {
        const p = db.roster.find((r) => r.id === e.playerId)
        rows.push([s.date, s.opponent, e.t.toFixed(1), p?.name ?? 'Unknown', p?.number ?? '', tagByType[e.type]?.label ?? e.type])
      }
    }
    download(`events-${scope === 'all' ? 'all' : scope}.csv`, csv(rows))
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = db.roster
      .map((p) => ({ p, a: playerAnalytics(sessions, p) }))
      .filter((x) => x.a.games > 0)
      .sort((a, b) => b.a.totals.points - a.a.totals.points)
    const title = scope === 'all' ? `${db.settings.teamName} — Season Report` : `Game Report`
    const body = rows
      .map(
        ({ p, a }) => `<tr>
          <td style="text-align:left">#${p.number} ${p.name}</td>
          <td>${a.games}</td><td>${(a.totals.points / a.games).toFixed(1)}</td>
          <td>${(a.efg * 100).toFixed(1)}%</td><td>${(a.ts * 100).toFixed(1)}%</td>
          <td>${(a.totals.reb / a.games).toFixed(1)}</td><td>${(a.totals.ast / a.games).toFixed(1)}</td>
          <td>${a.defActivity.toFixed(1)}</td><td>${a.hustle.toFixed(1)}</td>
          <td>${a.maxSpeedKmh > 0 ? a.maxSpeedKmh.toFixed(1) : '—'}</td>
        </tr>`
      )
      .join('')
    win.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:32px;color:#111}
        h1{font-size:22px;margin:0 0 4px}p.sub{color:#666;margin:0 0 20px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{padding:7px 6px;border-bottom:1px solid #ddd;text-align:center}
        th:first-child,td:first-child{text-align:left}
        th{background:#f4f4f4;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#555}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${title}</h1>
      <p class="sub">${sessions.length} game(s) · generated ${new Date().toLocaleDateString()}</p>
      <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;border:0;background:#e8630f;color:#fff;border-radius:6px;cursor:pointer">Print / Save as PDF</button>
      <table><thead><tr>
        <th>Player</th><th>G</th><th>PTS/G</th><th>eFG%</th><th>TS%</th><th>REB/G</th><th>AST/G</th><th>Def/G</th><th>Hustle/G</th><th>Max km/h</th>
      </tr></thead><tbody>${body || '<tr><td colspan="10">No data</td></tr>'}</tbody></table>
      </body></html>`)
    win.document.close()
  }

  return (
    <div className="p-4 md:p-8 max-w-[900px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Reports & Export</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Generate CSV data or a printable PDF report from your real recorded games — for coaches,
        players, or integration with other tools.
      </p>

      {db.sessions.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <p className="text-foreground font-semibold mb-1">Nothing to report yet</p>
          <p className="text-sm text-muted-foreground mb-4">Record a game and its stats will be exportable here.</p>
          <Link href="/dashboard/live-ai" className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 inline-block">Track a game</Link>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <label className="block text-xs text-muted-foreground mb-1">Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}
              className="w-full max-w-md px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground">
              <option value="all">Whole season ({db.sessions.length} games)</option>
              {db.sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.date} · {s.location === 'away' ? '@' : 'vs'} {s.opponent}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <button type="button" onClick={exportBoxScoreCsv}
              className="bg-card border border-border rounded-xl p-5 text-left hover:border-orange-500 transition-colors">
              <p className="font-semibold text-foreground mb-1">Box score (CSV)</p>
              <p className="text-xs text-muted-foreground">Per-player totals and advanced stats as a spreadsheet.</p>
            </button>
            <button type="button" onClick={exportEventsCsv}
              className="bg-card border border-border rounded-xl p-5 text-left hover:border-orange-500 transition-colors">
              <p className="font-semibold text-foreground mb-1">Play-by-play (CSV)</p>
              <p className="text-xs text-muted-foreground">Every recorded event with timestamp and player.</p>
            </button>
            <button type="button" onClick={printReport}
              className="bg-card border border-border rounded-xl p-5 text-left hover:border-orange-500 transition-colors">
              <p className="font-semibold text-foreground mb-1">Printable report (PDF)</p>
              <p className="text-xs text-muted-foreground">Opens a clean report — use your browser&apos;s Save as PDF.</p>
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            For programmatic integration, use the JSON backup in{' '}
            <Link href="/dashboard/settings" className="text-orange-500 hover:underline">Settings</Link> — it contains
            the full roster, sessions and events in a stable schema. Everything runs locally on this
            device; no cloud is required.
          </p>
        </>
      )}
    </div>
  )
}
