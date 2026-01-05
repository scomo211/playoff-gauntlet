import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setIsAdmin(data?.is_admin || false)
      } catch (err) {
        console.error('Failed to check admin status:', err)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [user])

  return { isAdmin, loading }
}

export interface AdminStats {
  totalUsers: number
  totalEntries: number
  entriesPaid: number
  entriesUnpaid: number
  currentWeek: number
  lineupsSubmitted: number
  lineupsMissing: number
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total users
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        // Get entries stats
        const { data: entriesData } = await supabase
          .from('entries')
          .select('id, payment_received')
          .eq('is_active', true)

        const totalEntries = entriesData?.length || 0
        const entriesPaid = entriesData?.filter(e => e.payment_received).length || 0

        // Get current week
        const { data: weekData } = await supabase
          .from('weeks')
          .select('id')
          .eq('is_current', true)
          .single()

        const currentWeek = weekData?.id || 1

        // Get lineup stats for current week
        const { data: lineupsData } = await supabase
          .from('lineups')
          .select('id, is_submitted')
          .eq('week_id', currentWeek)

        const lineupsSubmitted = lineupsData?.filter(l => l.is_submitted).length || 0

        setStats({
          totalUsers: userCount || 0,
          totalEntries,
          entriesPaid,
          entriesUnpaid: totalEntries - entriesPaid,
          currentWeek,
          lineupsSubmitted,
          lineupsMissing: totalEntries - lineupsSubmitted,
        })
      } catch (err) {
        console.error('Failed to fetch admin stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading }
}

export interface AdminUser {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  created_at: string
  entry_count: number
  entries_paid: number
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          entries(id, payment_received, is_active)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = data.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin,
        created_at: user.created_at,
        entry_count: user.entries?.filter((e: { is_active: boolean }) => e.is_active).length || 0,
        entries_paid: user.entries?.filter((e: { is_active: boolean; payment_received: boolean }) => e.is_active && e.payment_received).length || 0,
      }))

      setUsers(formatted)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', userId)

    if (!error) await fetchUsers()
    return { error: error?.message || null }
  }

  return { users, loading, refetch: fetchUsers, toggleAdmin }
}

export interface AdminEntry {
  id: string
  entry_name: string
  user_id: string
  display_name: string
  email: string
  payment_received: boolean
  created_at: string
  total_points: number
  lineups_submitted: number
}

export function useAdminEntries() {
  const [entries, setEntries] = useState<AdminEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('entries')
        .select(`
          *,
          profile:profiles(display_name, email),
          lineups(week_id, total_points, is_submitted)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = data.map(entry => {
        const profile = entry.profile as { display_name: string; email: string } | null
        const lineups = entry.lineups as { week_id: number; total_points: number; is_submitted: boolean }[] | null
        return {
          id: entry.id,
          entry_name: entry.entry_name,
          user_id: entry.user_id,
          display_name: profile?.display_name || 'Unknown',
          email: profile?.email || '',
          payment_received: entry.payment_received,
          created_at: entry.created_at,
          total_points: lineups?.reduce((sum, l) => sum + (l.total_points || 0), 0) || 0,
          lineups_submitted: lineups?.filter(l => l.is_submitted).length || 0,
        }
      })

      setEntries(formatted)
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const togglePayment = async (entryId: string, paid: boolean) => {
    const { error } = await supabase
      .from('entries')
      .update({ payment_received: paid })
      .eq('id', entryId)

    if (!error) await fetchEntries()
    return { error: error?.message || null }
  }

  const deleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', entryId)

    if (!error) await fetchEntries()
    return { error: error?.message || null }
  }

  return { entries, loading, refetch: fetchEntries, togglePayment, deleteEntry }
}

export function useAdminTeams() {
  const [teams, setTeams] = useState<Array<{
    id: string
    name: string
    city: string
    conference: string
    is_alive: boolean
    eliminated_week: number | null
  }>>([])
  const [loading, setLoading] = useState(true)

  const fetchTeams = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('conference', { ascending: true })
        .order('city', { ascending: true })

      if (error) throw error
      setTeams(data)
    } catch (err) {
      console.error('Failed to fetch teams:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const eliminateTeam = async (teamId: string, weekId: number) => {
    const { error } = await supabase
      .from('teams')
      .update({ is_alive: false, eliminated_week: weekId })
      .eq('id', teamId)

    if (!error) await fetchTeams()
    return { error: error?.message || null }
  }

  const reinstateTeam = async (teamId: string) => {
    const { error } = await supabase
      .from('teams')
      .update({ is_alive: true, eliminated_week: null })
      .eq('id', teamId)

    if (!error) await fetchTeams()
    return { error: error?.message || null }
  }

  return { teams, loading, refetch: fetchTeams, eliminateTeam, reinstateTeam }
}

export function useAdminLeagueSettings() {
  const [settings, setSettings] = useState<{
    entries_locked: boolean
    current_week_id: number | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('league_settings')
        .select('*')
        .single()

      if (error) throw error
      setSettings(data)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const updateSettings = async (updates: Partial<typeof settings>) => {
    const { error } = await supabase
      .from('league_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 1)

    if (!error) await fetchSettings()
    return { error: error?.message || null }
  }

  const setCurrentWeek = async (weekId: number) => {
    // Update weeks table
    await supabase.from('weeks').update({ is_current: false }).neq('id', 0)
    await supabase.from('weeks').update({ is_current: true }).eq('id', weekId)

    // Update league settings
    return updateSettings({ current_week_id: weekId })
  }

  return { settings, loading, updateSettings, setCurrentWeek, refetch: fetchSettings }
}
