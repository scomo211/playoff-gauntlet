import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

interface EntryPoints {
  id: string
  week1_points: number
  week2_points: number
  week3_points: number
  total_points: number
  points_after_week2: number // Cumulative after Week 2
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
          const week2_points = lineups.find(l => l.week_id === 2)?.total_points || 0
          const week3_points = lineups.find(l => l.week_id === 3)?.total_points || 0
          const total_points = lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)
          const points_after_week2 = week1_points + week2_points
          return {
            id: entry.id,
            week1_points,
            week2_points,
            week3_points,
            total_points,
            points_after_week2
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
        rankAfterWeek2: new Map<string, number>(),
        rankByTotal: new Map<string, number>(),
        biggestUpMovers: new Set<string>(),
        biggestDownMovers: new Set<string>()
      }
    }

    // Calculate ranks after Week 2 (before Week 3)
    const rankAfterWeek2 = new Map<string, number>()
    const entriesAfterWeek2 = [...entries].sort((a, b) => b.points_after_week2 - a.points_after_week2)
    entriesAfterWeek2.forEach((entry, index) => {
      rankAfterWeek2.set(entry.id, index + 1)
    })

    // Calculate ranks based on total score (after Week 3)
    const rankByTotal = new Map<string, number>()
    const entriesByTotal = [...entries].sort((a, b) => b.total_points - a.total_points)
    entriesByTotal.forEach((entry, index) => {
      rankByTotal.set(entry.id, index + 1)
    })

    // Calculate movements - comparing Week 2 standings to current (Week 3) standings
    const movements = entries.map(entry => {
      const week2Rank = rankAfterWeek2.get(entry.id) || 0
      const currentRank = rankByTotal.get(entry.id) || 0
      const movement = week2Rank - currentRank // positive = moved up
      return { id: entry.id, movement, currentRank }
    })

    // Filter to entries in top 20 who moved 8+ spots (slightly lower threshold for Week 2->3)
    const biggestUpMovers = new Set(
      movements
        .filter(m => m.currentRank <= 20 && m.movement >= 8)
        .map(m => m.id)
    )
    const biggestDownMovers = new Set(
      movements
        .filter(m => m.currentRank <= 20 && m.movement <= -8)
        .map(m => m.id)
    )

    return {
      rankAfterWeek2,
      rankByTotal,
      biggestUpMovers,
      biggestDownMovers
    }
  }, [entries])

  const getMovement = (entryId: string): number => {
    const week2Rank = movementData.rankAfterWeek2.get(entryId) || 0
    const currentRank = movementData.rankByTotal.get(entryId) || 0
    return week2Rank - currentRank
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
