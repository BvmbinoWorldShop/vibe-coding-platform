'use client'

import type { ReactNode } from 'react'

interface CourtProps {
  width?: number
  height?: number
  variant?: 'half' | 'full'
  children?: ReactNode
  className?: string
}

export function BasketballCourt({ width = 500, height = 470, variant = 'half', className }: CourtProps) {
  if (variant === 'full') {
    return (
      <svg viewBox="0 0 940 500" className={className} style={{ width: '100%', height: 'auto' }}>
        <rect x="0" y="0" width="940" height="500" fill="#1a2332" rx="4" />
        <rect x="10" y="10" width="920" height="480" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <line x1="470" y1="10" x2="470" y2="490" stroke="#2d4a6f" strokeWidth="2" />
        <circle cx="470" cy="250" r="60" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <circle cx="470" cy="250" r="3" fill="#4a90d9" />

        {/* Left basket */}
        <rect x="10" y="175" width="190" height="150" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <rect x="10" y="205" width="60" height="90" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <circle cx="200" cy="250" r="60" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <path d="M 10 175 Q 240 250 10 325" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <line x1="40" y1="245" x2="40" y2="255" stroke="#ff6b35" strokeWidth="3" />
        <rect x="28" y="243" width="24" height="14" fill="none" stroke="#ff6b35" strokeWidth="2" rx="2" />

        {/* Right basket */}
        <rect x="740" y="175" width="190" height="150" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <rect x="870" y="205" width="60" height="90" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <circle cx="740" cy="250" r="60" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <path d="M 930 175 Q 700 250 930 325" fill="none" stroke="#2d4a6f" strokeWidth="2" />
        <line x1="900" y1="245" x2="900" y2="255" stroke="#ff6b35" strokeWidth="3" />
        <rect x="888" y="243" width="24" height="14" fill="none" stroke="#ff6b35" strokeWidth="2" rx="2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 500 470" className={className} style={{ width: '100%', height: 'auto', maxWidth: width, aspectRatio: `${width} / ${height}` }}>
      <rect x="0" y="0" width="500" height="470" fill="#1a2332" rx="4" />
      <rect x="10" y="10" width="480" height="450" fill="none" stroke="#2d4a6f" strokeWidth="2" />

      {/* Three-point arc */}
      <path d="M 60 460 L 60 310 Q 250 80 440 310 L 440 460" fill="none" stroke="#2d4a6f" strokeWidth="2" />

      {/* Paint / key */}
      <rect x="170" y="350" width="160" height="110" fill="none" stroke="#2d4a6f" strokeWidth="2" />

      {/* Free throw circle */}
      <circle cx="250" cy="350" r="60" fill="none" stroke="#2d4a6f" strokeWidth="2" />

      {/* Restricted area */}
      <path d="M 210 460 Q 250 410 290 460" fill="none" stroke="#2d4a6f" strokeWidth="1.5" strokeDasharray="4 4" />

      {/* Basket */}
      <line x1="240" y1="440" x2="260" y2="440" stroke="#ff6b35" strokeWidth="3" />
      <rect x="238" y="435" width="24" height="14" fill="none" stroke="#ff6b35" strokeWidth="2" rx="2" />

      {/* Backboard */}
      <line x1="220" y1="450" x2="280" y2="450" stroke="#5a7a9a" strokeWidth="2" />
    </svg>
  )
}

interface ShotChartProps {
  shots: Array<{
    x: number
    y: number
    made: boolean
    shotType: string
    playerId: string
  }>
  width?: number
  height?: number
  selectedPlayer?: string | null
  className?: string
}

export function ShotChart({ shots, width = 500, height = 470, selectedPlayer, className }: ShotChartProps) {
  const filteredShots = selectedPlayer ? shots.filter((s) => s.playerId === selectedPlayer) : shots

  return (
    <div className={`relative ${className || ''}`} style={{ maxWidth: width }}>
      <BasketballCourt width={width} height={height} />
      <svg
        viewBox="0 0 500 470"
        className="absolute inset-0"
        style={{ width: '100%', height: 'auto' }}
      >
        {filteredShots.map((shot, i) => (
          <circle
            key={i}
            cx={(shot.x / 100) * 480 + 10}
            cy={(shot.y / 100) * 450 + 10}
            r={6}
            fill={shot.made ? '#22c55e' : '#ef4444'}
            opacity={0.75}
            stroke={shot.made ? '#16a34a' : '#dc2626'}
            strokeWidth={1.5}
          />
        ))}
      </svg>
    </div>
  )
}

interface LiveCourtProps {
  playerPositions: Array<{
    playerId: string
    x: number
    y: number
    hasBall: boolean
    label?: string
  }>
  ballPosition: { x: number; y: number }
  className?: string
}

export function LiveCourt({ playerPositions, ballPosition, className }: LiveCourtProps) {
  return (
    <div className={`relative ${className || ''}`}>
      <BasketballCourt variant="full" />
      <svg viewBox="0 0 940 500" className="absolute inset-0" style={{ width: '100%', height: 'auto' }}>
        {playerPositions.map((pos, i) => (
          <g key={i}>
            <circle
              cx={(pos.x / 100) * 920 + 10}
              cy={(pos.y / 100) * 480 + 10}
              r={16}
              fill={pos.hasBall ? '#eab308' : '#3b82f6'}
              stroke="#fff"
              strokeWidth={2}
              opacity={0.9}
            />
            <text
              x={(pos.x / 100) * 920 + 10}
              y={(pos.y / 100) * 480 + 14}
              textAnchor="middle"
              fill="#fff"
              fontSize="11"
              fontWeight="bold"
            >
              {pos.label || pos.playerId.replace('p', '#')}
            </text>
          </g>
        ))}
        <circle
          cx={(ballPosition.x / 100) * 920 + 10}
          cy={(ballPosition.y / 100) * 480 + 10}
          r={8}
          fill="#ff6b35"
          stroke="#fff"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  )
}
