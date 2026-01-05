import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Lineup, LineupPlayer, Week, Position, POSITION_SLOTS } from '../types/database'
import { PlayerWithTeam } from './usePlayers'

export interface LineupSlot {
  slot: string
  position: Position
  player: PlayerWithTeam | null
  points: number
}

export function useLineup(entryId: string, weekId: number) {
  const [lineup, setLineup] = useState<Lineup | null>(null)
  const [lineupPlayers, setLineupPlayers] = useState<Map<string, LineupPlayer & { player: PlayerWithTeam }>>(new Map())
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set())
  const [week, setWeek] = useState<Week | null>(null)
  const [previousWeek, setPreviousWeek] = useState<Week | null>(null)
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

      // Fetch previous week info (for weeks 2-4)
      if (weekId > 1) {
        const { data: prevWeekData } = await supabase
          .from('weeks')
          .select('*')
          .eq('id', weekId - 1)
          .single()
        setPreviousWeek(prevWeekData)
      } else {
        setPreviousWeek(null)
      }

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
  const addPlayer = async (slot: string, player: PlayerWithTeam): Promise<{ error: string | null }> => {
    if (!lineup) return { error: 'Lineup not loaded' }

    try {
      setSaving(true)

      // Check if slot already has a player
      const existingSlot = lineupPlayers.get(slot)

      if (existingSlot) {
        // Update existing slot
        const { error } = await supabase
          .from('lineup_players')
          .update({ player_id: player.id })
          .eq('id', existingSlot.id)

        if (error) throw error
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
  const removePlayer = async (slot: string): Promise<{ error: string | null }> => {
    if (!lineup) return { error: 'Lineup not loaded' }

    try {
      setSaving(true)

      const existingSlot = lineupPlayers.get(slot)
      if (!existingSlot) return { error: null }

      const { error } = await supabase
        .from('lineup_players')
        .delete()
        .eq('id', existingSlot.id)

      if (error) throw error

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

  // Get lineup slots with player data
  const getLineupSlots = (): LineupSlot[] => {
    const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]
    const result: LineupSlot[] = []

    for (const [position, positionSlots] of Object.entries(slots)) {
      for (const slot of positionSlots) {
        const lineupPlayer = lineupPlayers.get(slot)
        result.push({
          slot,
          position: position as Position,
          player: lineupPlayer?.player || null,
          points: lineupPlayer?.points_scored || 0,
        })
      }
    }

    return result
  }

  // Check if week is locked
  // Week is locked if:
  // 1. Current time is past the lockout time, OR
  // 2. For weeks 2-4: previous week is not yet complete
  const { isLocked, lockReason } = (() => {
    if (!week) return { isLocked: false, lockReason: null }

    // Past lockout time = locked
    if (new Date(week.lockout_time) < new Date()) {
      return { isLocked: true, lockReason: 'deadline' as const }
    }

    // For weeks 2-4, check if previous week is complete
    if (weekId > 1 && previousWeek && !previousWeek.is_complete) {
      return { isLocked: true, lockReason: 'previous_week' as const }
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
    previousWeek,
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
    refetch: fetchLineup,
  }
}
