import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Position, POSITION_SLOTS } from '../types/database'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'

interface PlayerStats {
  player_id: string
  player_name: string
  position: Position
  team_id: string
  team_name: string
  total_points: number
  projected_points: number
  pick_count: number
  percentage: number
}

interface PerfectLineupTableProps {
  weekId: number
}

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

export default function PerfectLineupTable({ weekId }: PerfectLineupTableProps) {
  const [perfectLineup, setPerfectLineup] = useState<PlayerStats[]>([])
  const [sleepersLineup, setSleepersLineup] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLineups, setTotalLineups] = useState(0)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // Get total submitted lineups for this week
      const { count: lineupCount } = await supabase
        .from('lineups')
        .select('*', { count: 'exact', head: true })
        .eq('week_id', weekId)
        .eq('is_submitted', true)

      setTotalLineups(lineupCount || 0)

      if (!lineupCount || lineupCount === 0) {
        setPerfectLineup([])
        setSleepersLineup([])
        setLoading(false)
        return
      }

      // Get player stats for this week
      const { data: statsData, error: statsError } = await supabase
        .from('player_weekly_stats')
        .select('player_id, total_points')
        .eq('week_id', weekId)

      if (statsError) {
        console.error('Error fetching player stats:', statsError)
        setLoading(false)
        return
      }

      // Get projections for this week
      const { data: projectionsData } = await supabase
        .from('projections')
        .select('player_name, fantasy_points, team_id')
        .eq('week_id', weekId)

      // Create projections map by player name (lowercase for matching)
      const projectionsMap = new Map<string, number>()
      projectionsData?.forEach(p => {
        projectionsMap.set(p.player_name.toLowerCase(), p.fantasy_points || 0)
      })

      // Get all lineup players for submitted lineups this week
      const { data: lineupPlayers } = await supabase
        .from('lineup_players')
        .select(`
          player_id,
          lineup:lineups!inner(week_id, is_submitted),
          player:players(
            id,
            name,
            position,
            team:teams(id, name)
          )
        `)
        .eq('lineup.week_id', weekId)
        .eq('lineup.is_submitted', true)

      // Create stats lookup map
      const statsMap = new Map<string, number>()
      statsData?.forEach(stat => {
        statsMap.set(stat.player_id, stat.total_points || 0)
      })

      // Count player occurrences and gather stats
      const playerDataMap = new Map<string, PlayerStats>()

      lineupPlayers?.forEach((lp) => {
        const playerData = lp.player
        if (!playerData) return

        const player = Array.isArray(playerData) ? playerData[0] : playerData as any
        if (!player) return

        const teamData = player.team
        const team = Array.isArray(teamData) ? teamData[0] : teamData

        const playerId = lp.player_id
        const existing = playerDataMap.get(playerId)

        if (existing) {
          existing.pick_count++
        } else {
          const points = statsMap.get(playerId) || 0
          const projected = projectionsMap.get(player.name.toLowerCase()) || 0

          playerDataMap.set(playerId, {
            player_id: playerId,
            player_name: player.name,
            position: player.position as Position,
            team_id: team?.id || '',
            team_name: team?.name || 'FA',
            total_points: points,
            projected_points: projected,
            pick_count: 1,
            percentage: 0,
          })
        }
      })

      // Also add players with stats who weren't picked (for sleepers calculation)
      const { data: allPlayersWithStats } = await supabase
        .from('player_weekly_stats')
        .select(`
          player_id,
          total_points,
          player:players(
            id,
            name,
            position,
            team:teams(id, name)
          )
        `)
        .eq('week_id', weekId)
        .gt('total_points', 0)

      allPlayersWithStats?.forEach((stat) => {
        if (playerDataMap.has(stat.player_id)) return

        const playerData = stat.player
        if (!playerData) return

        const player = Array.isArray(playerData) ? playerData[0] : playerData as any
        if (!player) return

        const teamData = player.team
        const team = Array.isArray(teamData) ? teamData[0] : teamData
        const projected = projectionsMap.get(player.name.toLowerCase()) || 0

        playerDataMap.set(stat.player_id, {
          player_id: stat.player_id,
          player_name: player.name,
          position: player.position as Position,
          team_id: team?.id || '',
          team_name: team?.name || 'FA',
          total_points: stat.total_points || 0,
          projected_points: projected,
          pick_count: 0,
          percentage: 0,
        })
      })

      // Calculate percentages
      const allPlayers = Array.from(playerDataMap.values()).map(p => ({
        ...p,
        percentage: Math.round((p.pick_count / lineupCount) * 100)
      }))

      // Get position slots for the week
      const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]

      // Build perfect lineup - top scorers at each position
      const perfect: PlayerStats[] = []
      for (const [position, slotNames] of Object.entries(slots)) {
        const positionPlayers = allPlayers
          .filter(p => p.position === position)
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, slotNames.length)
        perfect.push(...positionPlayers)
      }

      // Manual overrides for sleepers lineup
      const SLEEPER_OVERRIDES: Record<number, Partial<Record<string, string[]>>> = {
        2: {
          QB: ['4943'], // Sam Darnold instead of Josh Allen for Week 2
          RB: ['12534'], // Kyle Monangai as RB3 for Week 2
        }
      }

      // Build sleepers lineup - players who outperformed projections significantly
      // with low ownership but high actual points
      const sleepers: PlayerStats[] = []
      for (const [position, slotNames] of Object.entries(slots)) {
        const overrideIds = SLEEPER_OVERRIDES[weekId]?.[position] || []
        const overridePlayers: PlayerStats[] = []
        for (const id of overrideIds) {
          const player = allPlayers.find(p => p.player_id === id)
          if (player && player.total_points > 0) {
            overridePlayers.push(player)
          }
        }

        const positionPlayers = allPlayers
          .filter(p => p.position === position && p.total_points > 0 && !overrideIds.includes(p.player_id))
          .map(p => ({
            ...p,
            // Outperformance score: actual points - projected points
            // Higher = bigger surprise
            outperformance: p.total_points - p.projected_points,
            // Value score: high points + low ownership + outperformance
            sleeperScore: p.total_points * (1 - p.percentage / 100) + (p.total_points - p.projected_points)
          }))
          .filter(p => {
            // Must have outperformed projection OR have very low ownership
            return p.outperformance > 0 || p.percentage < 20
          })
          .sort((a, b) => {
            // Sort by sleeper score - rewards high points, low ownership, and outperformance
            return b.sleeperScore - a.sleeperScore
          })

        // Combine: overrides first, then fill remaining slots
        const combined: PlayerStats[] = [...overridePlayers]
        for (const pick of positionPlayers) {
          if (combined.length >= slotNames.length) break
          if (!combined.find(p => p.player_id === pick.player_id)) {
            combined.push(pick)
          }
        }
        sleepers.push(...combined.slice(0, slotNames.length))
      }

      setPerfectLineup(perfect)
      setSleepersLineup(sleepers)
      setLoading(false)
    }

    fetchData()
  }, [weekId])

  // Position badge colors
  const getPositionStyle = (position: Position) => {
    switch (position) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'RB': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'WR': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'TE': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'K': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'DEF': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  // Player row component
  const PlayerRow = ({ player, showOutperformance = false }: { player: PlayerStats; showOutperformance?: boolean }) => {
    const isDefense = player.position === 'DEF'
    const outperformance = player.total_points - player.projected_points

    return (
      <div className="flex items-center justify-between py-2 px-3 border-b border-slate-800 last:border-b-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <img
            src={isDefense ? getTeamLogoUrl(player.team_id) : getPlayerHeadshotUrl(player.player_id)}
            alt={player.player_name}
            className={`w-8 h-8 object-cover bg-slate-700 flex-shrink-0 ${isDefense ? 'rounded-lg p-0.5' : 'rounded-full'}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate" title={player.player_name}>
              {player.player_name}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] px-1 py-0.5 rounded border font-medium ${getPositionStyle(player.position)}`}>
                {player.position}
              </span>
              <span className="text-xs text-slate-500">{player.team_id}</span>
              {showOutperformance && player.projected_points > 0 && (
                <span className={`text-[10px] ${outperformance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({outperformance > 0 ? '+' : ''}{outperformance.toFixed(1)} vs proj)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-slate-500">{player.percentage}%</span>
          <span className="text-sm font-bold text-field-400 w-12 text-right">
            {player.total_points.toFixed(1)}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Wildcard Weekend Lineup Review</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  if (totalLineups === 0) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Wildcard Weekend Lineup Review</h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No submitted lineups yet for Week {weekId}
        </p>
      </div>
    )
  }

  const perfectTotal = perfectLineup.reduce((sum, p) => sum + p.total_points, 0)
  const sleepersTotal = sleepersLineup.reduce((sum, p) => sum + p.total_points, 0)

  return (
    <div className="card-solid p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Lineups Of The Week</h3>
        <span className="text-xs text-slate-500">
          {totalLineups} lineups
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfect Lineup */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-field-500"></div>
              <h4 className="text-sm font-semibold text-field-400">Perfect Lineup</h4>
            </div>
            <span className="text-sm font-bold text-field-400">{perfectTotal.toFixed(1)} pts</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">The optimal lineup with top scorers at each position</p>
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            {perfectLineup.map((player) => (
              <PlayerRow key={player.player_id} player={player} />
            ))}
          </div>
        </div>

        {/* Sleepers Lineup */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <h4 className="text-sm font-semibold text-orange-400">The Shitty Roster That Destroyed Yours</h4>
            </div>
            <span className="text-sm font-bold text-orange-400">{sleepersTotal.toFixed(1)} pts</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Low-owned players who massively outperformed projections</p>
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            {sleepersLineup.map((player) => (
              <PlayerRow key={player.player_id} player={player} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Perfect: Highest scorers at each position. Shitty Roster: Sleepers who beat their projections with low ownership.
        </p>
      </div>
    </div>
  )
}
