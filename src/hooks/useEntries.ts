import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Entry, LeagueSettings } from '../types/database'
import { useAuth } from '../contexts/AuthContext'

export function useEntries() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('entries')
        .select(`
          *,
          lineups (
            week_id,
            total_points
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Calculate total points for each entry
      const entriesWithPoints = data.map(entry => ({
        ...entry,
        total_points: entry.lineups?.reduce((sum: number, l: { total_points: number }) => sum + (l.total_points || 0), 0) || 0
      }))

      setEntries(entriesWithPoints)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch entries')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const createEntry = async (entryName: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const { error } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          entry_name: entryName.trim(),
        })

      if (error) throw error

      await fetchEntries()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to create entry' }
    }
  }

  const updateEntry = async (entryId: string, entryName: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const { error } = await supabase
        .from('entries')
        .update({ entry_name: entryName.trim() })
        .eq('id', entryId)
        .eq('user_id', user.id)

      if (error) throw error

      await fetchEntries()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update entry' }
    }
  }

  const deleteEntry = async (entryId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const { error } = await supabase
        .from('entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id)

      if (error) throw error

      await fetchEntries()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete entry' }
    }
  }

  return {
    entries,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    refetch: fetchEntries,
  }
}

export function useLeagueSettings() {
  const [settings, setSettings] = useState<LeagueSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('league_settings')
          .select('*')
          .single()

        if (error) throw error
        setSettings(data)
      } catch (err) {
        console.error('Failed to fetch league settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return { settings, loading }
}

export function useEntryCount() {
  const [count, setCount] = useState(0)
  const [payoutSpots, setPayoutSpots] = useState(4)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCount() {
      try {
        const { count, error } = await supabase
          .from('entries')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)

        if (error) throw error

        const entryCount = count || 0
        setCount(entryCount)

        // Calculate payout spots
        if (entryCount >= 100) setPayoutSpots(10)
        else if (entryCount >= 90) setPayoutSpots(9)
        else if (entryCount >= 80) setPayoutSpots(8)
        else if (entryCount >= 70) setPayoutSpots(7)
        else if (entryCount >= 60) setPayoutSpots(6)
        else if (entryCount >= 50) setPayoutSpots(5)
        else setPayoutSpots(4)
      } catch (err) {
        console.error('Failed to fetch entry count:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCount()
  }, [])

  return { count, payoutSpots, loading }
}
