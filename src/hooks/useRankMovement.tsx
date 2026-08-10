import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

interface EntryPoints {
  id: string
  week1_points: number
  week2_points: number
  week3_points: number
  week4_points: number
  total_points: number
  points_after_week3: number // Cumulative after Week 3
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
          const week4_points = lineups.find(l => l.week_id === 4)?.total_points || 0
          const total_points = lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)
          const points_after_week3 = week1_points + week2_points + week3_points
          return {
            id: entry.id,
            week1_points,
            week2_points,
            week3_points,
            week4_points,
            total_points,
            points_after_week3
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
        rankAfterWeek3: new Map<string, number>(),
        rankByTotal: new Map<string, number>(),
        biggestUpMovers: new Set<string>(),
        biggestDownMovers: new Set<string>(),
        movements: new Map<string, number>()
      }
    }

    // Calculate ranks after Week 3 (before Week 4)
    const rankAfterWeek3 = new Map<string, number>()
    const entriesAfterWeek3 = [...entries].sort((a, b) => b.points_after_week3 - a.points_after_week3)
    entriesAfterWeek3.forEach((entry, index) => {
      rankAfterWeek3.set(entry.id, index + 1)
    })

    // Calculate ranks based on total score (after Week 4)
    const rankByTotal = new Map<string, number>()
    const entriesByTotal = [...entries].sort((a, b) => b.total_points - a.total_points)
    entriesByTotal.forEach((entry, index) => {
      rankByTotal.set(entry.id, index + 1)
    })

    // Calculate movements - comparing Week 3 standings to current (Week 4) standings
    const movementsList = entries.map(entry => {
      const week3Rank = rankAfterWeek3.get(entry.id) || 0
      const currentRank = rankByTotal.get(entry.id) || 0
      const movement = week3Rank - currentRank // positive = moved up
      return { id: entry.id, movement, currentRank }
    })

    // Store all movements in a map for easy lookup
    const movements = new Map<string, number>()
    movementsList.forEach(m => {
      movements.set(m.id, m.movement)
    })

    // Filter to entries who moved 3+ spots (show more movement indicators)
    const biggestUpMovers = new Set(
      movementsList
        .filter(m => m.movement >= 3)
        .map(m => m.id)
    )
    const biggestDownMovers = new Set(
      movementsList
        .filter(m => m.movement <= -3)
        .map(m => m.id)
    )

    return {
      rankAfterWeek3,
      rankByTotal,
      biggestUpMovers,
      biggestDownMovers,
      movements
    }
  }, [entries])

  const getMovement = (entryId: string): number => {
    return movementData.movements.get(entryId) || 0
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
  const movement = getMovement(entryId)
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs'
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'

  if (biggestUpMovers.has(entryId)) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${textSize} font-semibold text-green-400`} title={`Up ${movement} spots from Week 3`}>
        <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        <span>{movement}</span>
      </span>
    )
  }

  if (biggestDownMovers.has(entryId)) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${textSize} font-semibold text-red-400`} title={`Down ${Math.abs(movement)} spots from Week 3`}>
        <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span>{Math.abs(movement)}</span>
      </span>
    )
  }

  return null
}
