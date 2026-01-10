import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface FavoriteEntry {
  id: string
  entry_name: string
  display_name: string
  total_points: number
  week1_points: number
  week2_points: number
  week3_points: number
  week4_points: number
  playersPlayed: number
  totalPlayers: number
  rank: number
  isOwn?: boolean
}

export function useFavorites() {
  const { user } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoriteEntries, setFavoriteEntries] = useState<FavoriteEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch user's favorite entry IDs
  const fetchFavoriteIds = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set())
      return
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('entry_id')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching favorites:', error)
      return
    }

    setFavoriteIds(new Set(data.map(f => f.entry_id)))
  }, [user])

  // Fetch full favorite entries with points (including user's own entries)
  const fetchFavoriteEntries = useCallback(async () => {
    if (!user) {
      setFavoriteEntries([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Get current week first
    const { data: weekData } = await supabase
      .from('weeks')
      .select('id')
      .eq('is_current', true)
      .single()
    const activeWeek = weekData?.id || 1

    // Fetch user's own entries, favorited entries, and all entries for ranking
    const [favoritesResult, ownEntriesResult, allEntriesResult] = await Promise.all([
      supabase
        .from('favorites')
        .select('entry_id')
        .eq('user_id', user.id),
      supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          profile:profiles(display_name),
          lineups(week_id, total_points, lineup_players(points_scored))
        `)
        .eq('user_id', user.id)
        .eq('is_active', true),
      // Get all entries with their total points for global ranking
      supabase
        .from('entries')
        .select(`
          id,
          lineups(total_points)
        `)
        .eq('is_active', true)
    ])

    // Build global rankings map
    const globalRankings = new Map<string, number>()
    if (allEntriesResult.data) {
      const entriesWithTotals = allEntriesResult.data.map(e => ({
        id: e.id,
        total: (e.lineups as { total_points: number }[] || []).reduce((sum, l) => sum + (l.total_points || 0), 0)
      }))
      entriesWithTotals.sort((a, b) => b.total - a.total)
      entriesWithTotals.forEach((e, idx) => {
        globalRankings.set(e.id, idx + 1)
      })
    }

    if (favoritesResult.error) {
      console.error('Error fetching favorites:', favoritesResult.error)
    }

    if (ownEntriesResult.error) {
      console.error('Error fetching own entries:', ownEntriesResult.error)
    }

    const favoriteIds = new Set((favoritesResult.data || []).map(f => f.entry_id))
    const ownEntries = ownEntriesResult.data || []
    const ownEntryIds = new Set(ownEntries.map(e => e.id))

    // Get favorited entries that aren't the user's own
    const externalFavoriteIds = [...favoriteIds].filter(id => !ownEntryIds.has(id))

    let allEntries = [...ownEntries]

    // Fetch external favorites if any
    if (externalFavoriteIds.length > 0) {
      const { data: externalEntries, error: externalError } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          profile:profiles(display_name),
          lineups(week_id, total_points, lineup_players(points_scored))
        `)
        .in('id', externalFavoriteIds)
        .eq('is_active', true)

      if (externalError) {
        console.error('Error fetching external favorites:', externalError)
      } else if (externalEntries) {
        allEntries = [...allEntries, ...externalEntries]
      }
    }

    if (allEntries.length === 0) {
      setFavoriteEntries([])
      setLoading(false)
      return
    }

    const formatted = allEntries.map(entry => {
      const profile = entry.profile as { display_name: string | null } | { display_name: string | null }[] | null
      const displayName = Array.isArray(profile)
        ? profile[0]?.display_name
        : profile?.display_name

      const lineups = entry.lineups as { week_id: number; total_points: number; lineup_players?: { points_scored: number }[] }[] || []
      const getWeekPoints = (weekId: number) =>
        lineups.find(l => l.week_id === weekId)?.total_points || 0

      // Calculate players played for current week
      const currentWeekLineup = lineups.find(l => l.week_id === activeWeek)
      const lineupPlayers = currentWeekLineup?.lineup_players || []
      const totalPlayers = lineupPlayers.length
      const playersPlayed = lineupPlayers.filter(lp => (lp.points_scored || 0) > 0).length

      return {
        id: entry.id,
        entry_name: entry.entry_name,
        display_name: displayName || 'Unknown',
        total_points: lineups.reduce((sum, l) => sum + (l.total_points || 0), 0),
        week1_points: getWeekPoints(1),
        week2_points: getWeekPoints(2),
        week3_points: getWeekPoints(3),
        week4_points: getWeekPoints(4),
        playersPlayed,
        totalPlayers,
        rank: globalRankings.get(entry.id) || 0,
        isOwn: ownEntryIds.has(entry.id),
      }
    })

    // Sort by global rank (ascending - lower rank is better)
    formatted.sort((a, b) => a.rank - b.rank)
    setFavoriteEntries(formatted)
    setLoading(false)
  }, [user])

  // Add entry to favorites
  const addFavorite = async (entryId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: user.id, entry_id: entryId })

    if (error) {
      console.error('Error adding favorite:', error)
      return { error: error.message }
    }

    setFavoriteIds(prev => new Set([...prev, entryId]))
    fetchFavoriteEntries()
    return { error: null }
  }

  // Remove entry from favorites
  const removeFavorite = async (entryId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('entry_id', entryId)

    if (error) {
      console.error('Error removing favorite:', error)
      return { error: error.message }
    }

    setFavoriteIds(prev => {
      const next = new Set(prev)
      next.delete(entryId)
      return next
    })
    fetchFavoriteEntries()
    return { error: null }
  }

  // Toggle favorite status
  const toggleFavorite = async (entryId: string) => {
    if (favoriteIds.has(entryId)) {
      return removeFavorite(entryId)
    } else {
      return addFavorite(entryId)
    }
  }

  // Check if entry is favorited
  const isFavorite = (entryId: string) => favoriteIds.has(entryId)

  // Initial fetch
  useEffect(() => {
    fetchFavoriteIds()
    fetchFavoriteEntries()
  }, [fetchFavoriteIds, fetchFavoriteEntries])

  return {
    favoriteIds,
    favoriteEntries,
    loading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavoriteEntries,
  }
}
