import { useState, useEffect, useRef } from 'react'

interface AnimatedLeaderboardRowProps {
  entryId: string
  rank: number
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function AnimatedLeaderboardRow({
  entryId,
  rank,
  children,
  className = '',
  onClick
}: AnimatedLeaderboardRowProps) {
  const [isMovingUp, setIsMovingUp] = useState(false)
  const [rankChange, setRankChange] = useState(0)
  const previousRank = useRef<number | null>(null)

  useEffect(() => {
    // Skip on initial render
    if (previousRank.current === null) {
      previousRank.current = rank
      return
    }

    // Check if rank improved (lower number = better rank)
    if (rank < previousRank.current) {
      const change = previousRank.current - rank
      setRankChange(change)
      setIsMovingUp(true)

      // Clear animation after it completes
      const timer = setTimeout(() => {
        setIsMovingUp(false)
        setRankChange(0)
      }, 1500)

      previousRank.current = rank
      return () => clearTimeout(timer)
    }

    previousRank.current = rank
  }, [rank, entryId])

  return (
    <tr
      onClick={onClick}
      className={`
        ${className}
        ${isMovingUp ? 'animate-rank-up' : ''}
        transition-all duration-300
      `}
      style={{
        position: 'relative',
      }}
    >
      {children}

      {/* Rank change indicator */}
      {isMovingUp && rankChange > 0 && (
        <td className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="animate-rank-badge inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-field-500 text-white shadow-lg shadow-field-500/30">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +{rankChange}
          </span>
        </td>
      )}
    </tr>
  )
}
