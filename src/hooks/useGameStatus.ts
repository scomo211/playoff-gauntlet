import { useState, useEffect, useCallback } from 'react'
import { GameStatus, getTeamGameStatus, getGameForTeam, isTeamOnBye } from '../lib/schedule'

interface UseGameStatusResult {
  getStatus: (teamId: string | undefined, playoffSeed?: number | null) => GameStatus | 'bye'
  refresh: () => void
}

export function useGameStatus(weekId: number): UseGameStatusResult {
  const [, setTick] = useState(0)

  // Force a re-render to recalculate game statuses
  const refresh = useCallback(() => {
    setTick(t => t + 1)
  }, [])

  // Auto-refresh every 60 seconds to update game statuses
  useEffect(() => {
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  const getStatus = useCallback((teamId: string | undefined, playoffSeed?: number | null): GameStatus | 'bye' => {
    if (!teamId) return 'upcoming'

    // Check for bye week
    if (isTeamOnBye(teamId, weekId, playoffSeed ?? null)) {
      return 'bye'
    }

    // Check if team has a game this week
    const game = getGameForTeam(teamId, weekId)
    if (!game) {
      return 'upcoming' // No game scheduled (could be eliminated or TBD)
    }

    return getTeamGameStatus(teamId, weekId)
  }, [weekId])

  return { getStatus, refresh }
}
