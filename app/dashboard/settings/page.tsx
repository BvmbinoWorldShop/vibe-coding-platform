'use client'

import { useState } from 'react'
import { useDB, updateDB, getDB } from '@/lib/basketball/store'
import { testMistralKey, testCerebrasKey } from '@/lib/basketball/ai'

export default function SettingsPage() {
  const db = useDB()
  const [teamName, setTeamName] = useState<string | null>(null)
  const [mistralKey, setMistralKey] = useState<string | null>(null)
  const [cerebrasKey, setCerebrasKey] = useState<string | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState<'mistral' | 'cerebras' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const shownTeam = teamName ?? db.settings.teamName
  const shownMistral = mistralKey ?? db.settings.mistralKey
  const shownCerebras = cerebrasKey ?? db.settings.cerebrasKey

  function save() {
    updateDB((d) => ({
      ...d,
      settings: {
        ...d.settings,
        teamName: shownTeam.trim() || 'My Team',
        mistralKey: shownMistral.trim(),
        cerebrasKey: shownCerebras.trim(),
      },
    }))
    setStatus({ ok: true, msg: 'Settings saved.' })
  }

  async function runTest(provider: 'mistral' | 'cerebras') {
    setTesting(provider)
    setStatus(null)
    try {
      const msg =
        provider === 'mistral'
          ? await testMistralKey(shownMistral.trim())
          : await testCerebrasKey(shownCerebras.trim())
      setStatus({ ok: true, msg })
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : 'Key test failed' })
    } finally {
      setTesting(null)
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(getDB(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ball-analysis-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function importData(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        updateDB((d) => ({ ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings ?? {}) } }))
        setStatus({ ok: true, msg: 'Backup imported.' })
      } catch {
        setStatus({ ok: false, msg: 'Not a valid backup file.' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="p-4 md:p-8 max-w-[860px]">
      <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Team profile, AI providers and your data. Everything stays on this device.
      </p>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">Team</h2>
        <label className="block text-sm text-muted-foreground mb-1">Team name</label>
        <input
          value={shownTeam}
          onChange={(e) => setTeamName(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">AI Providers (free keys)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Keys are stored only on this device; calls go straight from your browser to the provider.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-foreground mb-1">
            Mistral API key <span className="text-xs text-muted-foreground font-normal">— powers AI video analysis (vision)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Free key: go to{' '}
            <a href="https://console.mistral.ai" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
              console.mistral.ai
            </a>{' '}
            → sign up → API Keys → Create key (choose the free “Experiment” plan).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={shownMistral}
              onChange={(e) => setMistralKey(e.target.value)}
              type="password"
              placeholder="Mistral key…"
              className="flex-1 min-w-[240px] px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
            <button
              type="button"
              onClick={() => runTest('mistral')}
              disabled={testing !== null || !shownMistral.trim()}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50 disabled:opacity-40"
            >
              {testing === 'mistral' ? 'Testing…' : 'Test key'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Cerebras API key <span className="text-xs text-muted-foreground font-normal">— powers instant coaching insights</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Free key: go to{' '}
            <a href="https://cloud.cerebras.ai" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
              cloud.cerebras.ai
            </a>{' '}
            → sign up → API Keys → Generate.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={shownCerebras}
              onChange={(e) => setCerebrasKey(e.target.value)}
              type="password"
              placeholder="Cerebras key (csk-…)"
              className="flex-1 min-w-[240px] px-4 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
            <button
              type="button"
              onClick={() => runTest('cerebras')}
              disabled={testing !== null || !shownCerebras.trim()}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50 disabled:opacity-40"
            >
              {testing === 'cerebras' ? 'Testing…' : 'Test key'}
            </button>
          </div>
        </div>

        {status && (
          <p className={`text-sm mt-3 ${status.ok ? 'text-green-500' : 'text-red-500'}`}>{status.msg}</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">Your data</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {db.roster.length} players · {db.sessions.length} recorded sessions · {db.workouts.length}{' '}
          workouts · {db.recovery.length} recovery entries
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportData}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50"
          >
            Export backup
          </button>
          <label className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-accent/50 cursor-pointer">
            Import backup
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
            />
          </label>
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-red-500 hover:bg-red-500/10"
            >
              Clear all data
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                updateDB(() => ({
                  roster: [],
                  sessions: [],
                  workouts: [],
                  recovery: [],
                  settings: { teamName: 'My Team', mistralKey: '', cerebrasKey: '' },
                }))
                setConfirmClear(false)
              }}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500"
            >
              Really delete everything?
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500"
      >
        Save settings
      </button>
    </div>
  )
}
