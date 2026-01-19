import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

interface EntryPoints {
  id: string
  week1_points: number
  total_points: number
}

interface MovementData {
  biggestUpMovers: Set<string>
  biggestDownMovers: Set<string>
  getMovement: (entryId: string) => number
  isLoading: boolean
}

export function useRankMovement(): MovementData {
  const [entries, setEntries] = useState<EntryPoints[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchEntries() {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select(`
            id,
            lineups(week_id, total_points)
          `)
          .eq('is_active', true)

        if (error) throw error

        const formatted = data.map(entry => {
          const lineups = entry.lineups as { week_id: number; total_points: number }[] || []
          const week1_points = lineups.find(l => l.week_id === 1)?.total_points || 0
          const total_points = lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)
          return {
            id: entry.id,
            week1_points,
            total_points
          }
        })

        setEntries(formatted)
      } catch (err) {
        console.error('Failed to fetch entries for movement:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEntries()
  }, [])

  const movementData = useMemo(() => {
    if (entries.length === 0) {
      return {
        rankByWeek1: new Map<string, number>(),
        rankByTotal: new Map<string, number>(),
        biggestUpMovers: new Set<string>(),
        biggestDownMovers: new Set<string>()
      }
    }

    // Calculate ranks based on Week 1 score
    const rankByWeek1 = new Map<string, number>()
    const entriesByWeek1 = [...entries].sort((a, b) => b.week1_points - a.week1_points)
    entriesByWeek1.forEach((entry, index) => {
      rankByWeek1.set(entry.id, index + 1)
    })

    // Calculate ranks based on total score
    const rankByTotal = new Map<string, number>()
    const entriesByTotal = [...entries].sort((a, b) => b.total_points - a.total_points)
    entriesByTotal.forEach((entry, index) => {
      rankByTotal.set(entry.id, index + 1)
    })

    // Calculate movements - only for entries currently in top 20 who moved 5+ spots
    const movements = entries.map(entry => {
      const week1Rank = rankByWeek1.get(entry.id) || 0
      const currentRank = rankByTotal.get(entry.id) || 0
      const movement = week1Rank - currentRank // positive = moved up
      return { id: entry.id, movement, currentRank }
    })

    // Filter to entries in top 20 who moved 11+ spots
    const biggestUpMovers = new Set(
      movements
        .filter(m => m.currentRank <= 20 && m.movement >= 11)
        .map(m => m.id)
    )
    const biggestDownMovers = new Set(
      movements
        .filter(m => m.currentRank <= 20 && m.movement <= -11)
        .map(m => m.id)
    )

    return {
      rankByWeek1,
      rankByTotal,
      biggestUpMovers,
      biggestDownMovers
    }
  }, [entries])

  const getMovement = (entryId: string): number => {
    const week1Rank = movementData.rankByWeek1.get(entryId) || 0
    const currentRank = movementData.rankByTotal.get(entryId) || 0
    return week1Rank - currentRank
  }

  return {
    biggestUpMovers: movementData.biggestUpMovers,
    biggestDownMovers: movementData.biggestDownMovers,
    getMovement,
    isLoading
  }
}

// Movement indicator component for reuse
export function MovementIndicator({
  entryId,
  biggestUpMovers,
  biggestDownMovers,
  getMovement,
  size = 'sm'
}: {
  entryId: string
  biggestUpMovers: Set<string>
  biggestDownMovers: Set<string>
  getMovement: (id: string) => number
  size?: 'sm' | 'xs'
}) {
  const sizeClass = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'

  if (biggestUpMovers.has(entryId)) {
    return (
      <span className="inline-flex items-center text-green-400" title={`Up ${getMovement(entryId)} spots`}>
        <svg className={sizeClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }

  if (biggestDownMovers.has(entryId)) {
    return (
      <span className="inline-flex items-center text-red-400" title={`Down ${Math.abs(getMovement(entryId))} spots`}>
        <svg className={sizeClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }

  return null
}
