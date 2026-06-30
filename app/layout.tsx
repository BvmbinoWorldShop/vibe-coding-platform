import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const title = 'Ball Analysis'
const description = 'Professional basketball analytics dashboard and player CRM — live game tracking, advanced stats, workouts, nutrition, and recovery.'

export const metadata: Metadata = {
  title,
  description,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
