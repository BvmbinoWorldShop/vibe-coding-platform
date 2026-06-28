'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/dashboard/games', label: 'Games', icon: 'calendar' },
  { href: '/dashboard/players', label: 'Players & CRM', icon: 'users' },
  { href: '/dashboard/live', label: 'Live Tracking', icon: 'radio' },
]

const iconPaths: Record<string, string> = {
  grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z',
  calendar: 'M8 2v2M16 2v2M3 6h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  radio: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4.93 19.07A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10a10 10 0 0 1-2.93 7.07M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 6-6 6 6 0 0 1 6 6 6 6 0 0 1-1.76 4.24',
}

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M4.93 4.93c4.08 4.08 10.06 4.08 14.14 0" />
              <path d="M4.93 19.07c4.08-4.08 10.06-4.08 14.14 0" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">CourtIQ</h1>
            <p className="text-xs text-muted-foreground">Basketball Analytics</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPaths[item.icon]} />
              </svg>
              {item.label}
            </Link>
          )
        })}
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
  )
}
