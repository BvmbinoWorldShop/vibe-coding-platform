import { DashboardSidebar } from '@/components/basketball/sidebar'
import type { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
