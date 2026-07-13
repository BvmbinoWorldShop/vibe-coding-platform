'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/dashboard/games', label: 'Games', icon: 'calendar' },
  { href: '/dashboard/players', label: 'Players & CRM', icon: 'users' },
  { href: '/dashboard/live', label: 'Live Tracking', icon: 'radio' },
  { href: '/dashboard/live-ai', label: 'Live AI Tracker', icon: 'cpu' },
  { href: '/dashboard/video', label: 'Video Analysis', icon: 'video' },
  { href: '/dashboard/pro', label: 'Pro Leagues', icon: 'globe' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'gear' },
]

const iconPaths: Record<string, string> = {
  grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  calendar: 'M8 2v2M16 2v2M3 6h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  radio: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4.93 19.07A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10a10 10 0 0 1-2.93 7.07M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 6-6 6 6 0 0 1 6 6 6 6 0 0 1-1.76 4.24',
  video: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  cpu: 'M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2M7 7h10v10H7z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
}

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconPaths[icon]} />
    </svg>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M4.93 4.93c4.08 4.08 10.06 4.08 14.14 0" />
          <path d="M4.93 19.07c4.08-4.08 10.06-4.08 14.14 0" />
          <line x1="12" y1="2" x2="12" y2="22" />
        </svg>
      </div>
      <div>
        <h1 className="text-sm font-bold text-foreground leading-tight">Ball Analysis</h1>
        <p className="text-xs text-muted-foreground">Basketball Analytics</p>
      </div>
    </div>
  )
}

function useIsActive(href: string) {
  const pathname = usePathname()
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
}

export function DashboardSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-sidebar">
        <BrandMark />
        <button
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileOpen((open) => !open)}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-border text-foreground"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </header>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <nav className="md:hidden sticky top-[60px] z-20 bg-sidebar border-b border-border p-3 space-y-1">
          {navItems.map((item) => (
            <MobileNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col h-screen sticky top-0 shrink-0">
        <div className="p-6 border-b border-border">
          <BrandMark />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <DesktopNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-accent/50 rounded-lg p-3">
            <p className="text-xs font-medium text-foreground">Season 2025-26</p>
            <p className="text-xs text-muted-foreground mt-0.5">38-16 (.704)</p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '70.4%' }} />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function DesktopNavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const isActive = useIsActive(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <NavIcon icon={icon} className="w-5 h-5" />
      {label}
    </Link>
  )
}

function MobileNavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const isActive = useIsActive(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <NavIcon icon={icon} className="w-5 h-5" />
      {label}
    </Link>
  )
}
