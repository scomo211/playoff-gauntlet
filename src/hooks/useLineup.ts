import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Lineup, LineupPlayer, Week, Position, POSITION_SLOTS } from '../types/database'
import { PlayerWithTeam } from './usePlayers'

export interface PlayerStats {
  pass_cmp: number
  pass_att: number
  pass_yards: number
  pass_td: number
  rush_att: number
  rush_yards: number
  rush_td: number
  receptions: number
  rec_yards: number
  rec_td: number
}

export interface LineupSlot {
  slot: string
  position: Position
  player: PlayerWithTeam | null
  points: number
  stats: PlayerStats | null
}

export function useLineup(entryId: string, weekId: number, isAdmin: boolean = false) {
  const [lineup, setLineup] = useState<Lineup | null>(null)
  const [lineupPlayers, setLineupPlayers] = useState<Map<string, LineupPlayer & { player: PlayerWithTeam }>>(new Map())
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map())
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set())
  const [week, setWeek] = useState<Week | null>(null)
  const [entriesLocked, setEntriesLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch lineup data
  const fetchLineup = useCallback(async () => {
    if (!entryId || !weekId) return

    try {
      setLoading(true)

      // Fetch week info
      const { data: weekData, error: weekError } = await supabase
        .from('weeks')
        .select('*')
        .eq('id', weekId)
        .single()

      if (weekError) throw weekError
      setWeek(weekData)

      // Fetch league settings to check if entries are locked
      const { data: settingsData } = await supabase
        .from('league_settings')
        .select('entries_locked')
        .eq('id', 1)
        .single()

      setEntriesLocked(settingsData?.entries_locked ?? false)

      // Fetch or create lineup
      let { data: lineupData, error: lineupError } = await supabase
        .from('lineups')
        .select('*')
        .eq('entry_id', entryId)
        .eq('week_id', weekId)
        .single()

      if (lineupError && lineupError.code === 'PGRST116') {
        // No lineup exists, create one
        const { data: newLineup, error: createError } = await supabase
          .from('lineups')
          .insert({
            entry_id: entryId,
            week_id: weekId,
          })
          .select()
          .single()

        if (createError) throw createError
        lineupData = newLineup
      } else if (lineupError) {
        throw lineupError
      }

      setLineup(lineupData)

      // Fetch lineup players
      const { data: playersData, error: playersError } = await supabase
        .from('lineup_players')
        .select(`
          *,
          player:players(
            *,
            team:teams(*)
          )
        `)
        .eq('lineup_id', lineupData.id)

      if (playersError) throw playersError

      const playersMap = new Map<string, LineupPlayer & { player: PlayerWithTeam }>()
      playersData.forEach(lp => {
        playersMap.set(lp.position_slot, lp as LineupPlayer & { player: PlayerWithTeam })
      })
      setLineupPlayers(playersMap)

      // Fetch all used players for this entry (from all weeks)
      const { data: usedData, error: usedError } = await supabase
        .from('used_players')
        .select('player_id')
        .eq('entry_id', entryId)

      if (usedError) throw usedError

      const usedIds = new Set(usedData.map(up => up.player_id))
      setUsedPlayerIds(usedIds)

      // Fetch player weekly stats for the lineup players
      const playerIds = playersData.map((lp: { player_id: string }) => lp.player_id)
      if (playerIds.length > 0) {
        const { data: statsData } = await supabase
          .from('player_weekly_stats')
          .select('player_id, pass_cmp, pass_att, pass_yards, pass_td, rush_att, rush_yards, rush_td, receptions, rec_yards, rec_td')
          .eq('week_id', weekId)
          .in('player_id', playerIds)

        const statsMap = new Map<string, PlayerStats>()
        if (statsData) {
          statsData.forEach((stat: {
            player_id: string
            pass_cmp: number
            pass_att: number
            pass_yards: number
            pass_td: number
            rush_att: number
            rush_yards: number
            rush_td: number
            receptions: number
            rec_yards: number
            rec_td: number
          }) => {
            statsMap.set(stat.player_id, {
              pass_cmp: stat.pass_cmp || 0,
              pass_att: stat.pass_att || 0,
              pass_yards: stat.pass_yards || 0,
              pass_td: stat.pass_td || 0,
              rush_att: stat.rush_att || 0,
              rush_yards: stat.rush_yards || 0,
              rush_td: stat.rush_td || 0,
              receptions: stat.receptions || 0,
              rec_yards: stat.rec_yards || 0,
              rec_td: stat.rec_td || 0,
            })
          })
        }
        setPlayerStats(statsMap)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lineup')
    } finally {
      setLoading(false)
    }
  }, [entryId, weekId])

  useEffect(() => {
    fetchLineup()
  }, [fetchLineup])

  // Add player to lineup slot
  const addPlayer = async (slot: string, player: PlayerWithTeam, isSubmitted: boolean = false): Promise<{ error: string | null }> => {
    if (!lineup) return { error: 'Lineup not loaded' }

    try {
      setSaving(true)

      // Check if slot already has a player
      const existingSlot = lineupPlayers.get(slot)
      const oldPlayerId = existingSlot?.player_id

      if (existingSlot) {
        // Update existing slot
        const { error } = await supabase
          .from('lineup_players')
          .update({ player_id: player.id })
          .eq('id', existingSlot.id)

        if (error) throw error

        // If lineup was already submitted, update used_players
        if (isSubmitted && oldPlayerId) {
          // Remove old player from used_players
          await supabase
            .from('used_players')
            .delete()
            .eq('entry_id', entryId)
            .eq('player_id', oldPlayerId)

          // Add new player to used_players
          await supabase
            .from('used_players')
            .upsert({
              entry_id: entryId,
              player_id: player.id,
              week_used: weekId,
            }, { onConflict: 'entry_id,player_id' })
        }
      } else {
        // Insert new slot
        const { error } = await supabase
          .from('lineup_players')
          .insert({
            lineup_id: lineup.id,
            player_id: player.id,
            position_slot: slot,
          })

        if (error) throw error

        // If lineup was already submitted, add to used_players
        if (isSubmitted) {
          await supabase
            .from('used_players')
            .upsert({
              entry_id: entryId,
              player_id: player.id,
              week_used: weekId,
            }, { onConflict: 'entry_id,player_id' })
        }
      }

      await fetchLineup()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to add player' }
    } finally {
      setSaving(false)
    }
  }

  // Remove player from lineup slot
  const removePlayer = async (slot: string, isSubmitted: boolean = false): Promise<{ error: string | null }> => {
    if (!lineup) return { error: 'Lineup not loaded' }

    try {
      setSaving(true)

      const existingSlot = lineupPlayers.get(slot)
      if (!existingSlot) return { error: null }

      const playerId = existingSlot.player_id

      const { error } = await supabase
        .from('lineup_players')
        .delete()
        .eq('id', existingSlot.id)

      if (error) throw error

      // If lineup was already submitted, remove from used_players
      if (isSubmitted && playerId) {
        await supabase
          .from('used_players')
          .delete()
          .eq('entry_id', entryId)
          .eq('player_id', playerId)

        // Check if lineup is now incomplete and revert submitted status
        const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]
        const requiredSlots = Object.values(slots).flat()
        const remainingPlayers = lineupPlayers.size - 1 // After removal

        if (remainingPlayers < requiredSlots.length) {
          // Lineup is now incomplete, revert submitted status
          await supabase
            .from('lineups')
            .update({
              is_submitted: false,
              submitted_at: null,
            })
            .eq('id', lineup.id)
        }
      }

      await fetchLineup()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove player' }
    } finally {
      setSaving(false)
    }
  }

  // Submit lineup (locks players)
  const submitLineup = async (): Promise<{ error: string | null }> => {
    if (!lineup || !week) return { error: 'Lineup not loaded' }

    // Validate lineup is complete
    const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]
    const requiredSlots = Object.values(slots).flat()
    const filledSlots = Array.from(lineupPlayers.keys())

    // For weeks 1-3, all slots must be filled
    if (weekId !== 4 && filledSlots.length < requiredSlots.length) {
      const missing = requiredSlots.length - filledSlots.length
      return { error: `Lineup incomplete. You need to fill ${missing} more slot(s).` }
    }

    try {
      setSaving(true)

      // Mark lineup as submitted
      const { error: updateError } = await supabase
        .from('lineups')
        .update({
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', lineup.id)

      if (updateError) throw updateError

      // Add all players to used_players table
      const usedPlayersInserts = Array.from(lineupPlayers.values()).map(lp => ({
        entry_id: entryId,
        player_id: lp.player_id,
        week_used: weekId,
      }))

      if (usedPlayersInserts.length > 0) {
        const { error: usedError } = await supabase
          .from('used_players')
          .upsert(usedPlayersInserts, { onConflict: 'entry_id,player_id' })

        if (usedError) throw usedError
      }

      await fetchLineup()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to submit lineup' }
    } finally {
      setSaving(false)
    }
  }

  // Unsubmit lineup (admin only - removes used players tracking)
  const unsubmitLineup = async (): Promise<{ error: string | null }> => {
    if (!lineup) return { error: 'Lineup not loaded' }

    try {
      setSaving(true)

      // Mark lineup as not submitted
      const { error: updateError } = await supabase
        .from('lineups')
        .update({
          is_submitted: false,
          submitted_at: null,
        })
        .eq('id', lineup.id)

      if (updateError) throw updateError

      // Remove all players from used_players for this week
      const playerIds = Array.from(lineupPlayers.values()).map(lp => lp.player_id)
      if (playerIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('used_players')
          .delete()
          .eq('entry_id', entryId)
          .eq('week_used', weekId)

        if (deleteError) throw deleteError
      }

      await fetchLineup()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to unsubmit lineup' }
    } finally {
      setSaving(false)
    }
  }

  // Get lineup slots with player data
  const getLineupSlots = (): LineupSlot[] => {
    const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]
    const result: LineupSlot[] = []

    for (const [position, positionSlots] of Object.entries(slots)) {
      for (const slot of positionSlots) {
        const lineupPlayer = lineupPlayers.get(slot)
        const playerId = lineupPlayer?.player_id
        result.push({
          slot,
          position: position as Position,
          player: lineupPlayer?.player || null,
          points: lineupPlayer?.points_scored || 0,
          stats: playerId ? playerStats.get(playerId) || null : null,
        })
      }
    }

    return result
  }

  // Check if week is locked
  // Week is locked if:
  // 1. League-wide entries_locked setting is enabled (applies to EVERYONE including admins)
  // 2. Current time is before the opens_at time (not yet open) - admins can bypass
  // 3. Current time is past the lockout_time (deadline passed) - admins can bypass
  // Note: Admins must use the admin panel to edit lineups when entries_locked is true
  const { isLocked, lockReason } = (() => {
    // Check league-wide lock first - this applies to EVERYONE including admins
    // Admins must use the admin panel to make changes when this is enabled
    if (entriesLocked) {
      return { isLocked: true, lockReason: 'entries_locked' as const }
    }

    if (!week) return { isLocked: false, lockReason: null }

    const now = new Date()

    // Not yet open (opens_at is in the future) - admins can bypass
    if (week.opens_at && new Date(week.opens_at) > now) {
      if (isAdmin) return { isLocked: false, lockReason: null }
      return { isLocked: true, lockReason: 'not_yet_open' as const }
    }

    // Past lockout time = locked - admins can bypass
    if (new Date(week.lockout_time) < now) {
      if (isAdmin) return { isLocked: false, lockReason: null }
      return { isLocked: true, lockReason: 'deadline' as const }
    }

    return { isLocked: false, lockReason: null }
  })()

  // Check if a player is used (either in this lineup or previous weeks)
  const isPlayerUsed = (playerId: string): boolean => {
    // Check if used in previous weeks
    if (usedPlayerIds.has(playerId)) {
      // But allow if it's in the current lineup (not yet submitted)
      const currentLineupPlayerIds = Array.from(lineupPlayers.values()).map(lp => lp.player_id)
      if (!currentLineupPlayerIds.includes(playerId)) {
        return true
      }
      // If lineup is submitted, it's used
      if (lineup?.is_submitted) {
        return true
      }
    }
    return false
  }

  // Check if a player is in the current lineup
  const isPlayerInLineup = (playerId: string): boolean => {
    return Array.from(lineupPlayers.values()).some(lp => lp.player_id === playerId)
  }

  return {
    lineup,
    week,
    loading,
    saving,
    error,
    lineupSlots: getLineupSlots(),
    usedPlayerIds,
    isLocked,
    lockReason,
    isPlayerUsed,
    isPlayerInLineup,
    addPlayer,
    removePlayer,
    submitLineup,
    unsubmitLineup,
    refetch: fetchLineup,
  }
}
