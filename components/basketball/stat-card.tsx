'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatCard({ label, value, subValue, trend, trendValue, size = 'md', className }: StatCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className={cn(
          'font-bold text-foreground',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-2xl',
          size === 'lg' && 'text-3xl',
        )}>
          {value}
        </p>
        {trend && trendValue && (
          <span className={cn(
            'text-xs font-medium mb-0.5',
            trend === 'up' && 'text-green-500',
            trend === 'down' && 'text-red-500',
            trend === 'neutral' && 'text-muted-foreground',
          )}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{trendValue}
          </span>
        )}
      </div>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  )
}

interface ProgressBarProps {
  label: string
  value: number
  max: number
  color?: string
  showPercent?: boolean
  className?: string
}

export function ProgressBar({ label, value, max, color = 'bg-blue-500', showPercent = true, className }: ProgressBarProps) {
  const percent = max > 0 ? (value / max) * 100 : 0
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {showPercent ? `${percent.toFixed(1)}%` : `${value}/${max}`}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  )
}
