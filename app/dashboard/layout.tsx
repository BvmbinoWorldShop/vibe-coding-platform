import { DashboardSidebar } from '@/components/basketball/sidebar'
import type { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 md:overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
