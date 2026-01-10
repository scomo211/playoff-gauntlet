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

  // Fetch full favorite entries with points
  const fetchFavoriteEntries = useCallback(async () => {
    if (!user) {
      setFavoriteEntries([])
      setLoading(false)
      return
    }

    setLoading(true)

    // First get favorite entry IDs
    const { data: favorites, error: favError } = await supabase
      .from('favorites')
      .select('entry_id')
      .eq('user_id', user.id)

    if (favError) {
      console.error('Error fetching favorites:', favError)
      setLoading(false)
      return
    }

    if (favorites.length === 0) {
      setFavoriteEntries([])
      setLoading(false)
      return
    }

    const entryIds = favorites.map(f => f.entry_id)

    // Fetch entries with their lineups
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select(`
        id,
        entry_name,
        profile:profiles(display_name),
        lineups(week_id, total_points)
      `)
      .in('id', entryIds)
      .eq('is_active', true)

    if (entriesError) {
      console.error('Error fetching favorite entries:', entriesError)
      setLoading(false)
      return
    }

    const formatted = entries.map(entry => {
      const profile = entry.profile as { display_name: string | null } | { display_name: string | null }[] | null
      const displayName = Array.isArray(profile)
        ? profile[0]?.display_name
        : profile?.display_name

      const lineups = entry.lineups as { week_id: number; total_points: number }[] || []
      const getWeekPoints = (weekId: number) =>
        lineups.find(l => l.week_id === weekId)?.total_points || 0

      return {
        id: entry.id,
        entry_name: entry.entry_name,
        display_name: displayName || 'Unknown',
        total_points: lineups.reduce((sum, l) => sum + (l.total_points || 0), 0),
        week1_points: getWeekPoints(1),
        week2_points: getWeekPoints(2),
        week3_points: getWeekPoints(3),
        week4_points: getWeekPoints(4),
      }
    })

    // Sort by total points descending
    formatted.sort((a, b) => b.total_points - a.total_points)
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
