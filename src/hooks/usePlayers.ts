import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Player, Team, Position } from '../types/database'

export interface PlayerWithTeam extends Omit<Player, 'team'> {
  team: Team | null
}

export function usePlayers() {
  const [players, setPlayers] = useState<PlayerWithTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const { data, error } = await supabase
          .from('players')
          .select(`
            *,
            team:teams(*)
          `)
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error
        setPlayers(data as PlayerWithTeam[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch players')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  // Get players filtered by position and alive teams
  const getAvailablePlayers = (position: Position, usedPlayerIds: Set<string>) => {
    return players.filter(player =>
      player.position === position &&
      player.team?.is_alive &&
      !usedPlayerIds.has(player.id)
    )
  }

  // Get all players for a position (including used ones for display)
  const getPlayersByPosition = (position: Position) => {
    return players.filter(player =>
      player.position === position &&
      player.team?.is_alive
    )
  }

  return {
    players,
    loading,
    error,
    getAvailablePlayers,
    getPlayersByPosition,
  }
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTeams() {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .order('city', { ascending: true })

        if (error) throw error
        setTeams(data)
      } catch (err) {
        console.error('Failed to fetch teams:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  const aliveTeams = teams.filter(t => t.is_alive)

  return { teams, aliveTeams, loading }
}
