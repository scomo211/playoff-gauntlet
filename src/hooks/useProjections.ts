import { useState, useEffect, useCallback } from 'react'
import { fetchProjections, buildProjectionMap, createPlayerKey } from '../lib/projections'

export function useProjections(weekId: number) {
  const [projectionMap, setProjectionMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProjections() {
      setLoading(true)
      setError(null)

      try {
        const projections = await fetchProjections(weekId)
        if (!cancelled) {
          setProjectionMap(buildProjectionMap(projections))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projections')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProjections()

    return () => {
      cancelled = true
    }
  }, [weekId])

  const getProjection = useCallback(
    (playerName: string, teamId: string): number | null => {
      const key = createPlayerKey(playerName, teamId)
      return projectionMap.get(key) ?? null
    },
    [projectionMap]
  )

  return {
    projectionMap,
    loading,
    error,
    getProjection,
  }
}
