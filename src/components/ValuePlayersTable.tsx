import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Position } from '../types/database'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'

interface PlayerValue {
  player_id: string
  player_name: string
  position: Position
  team_name: string
  team_id: string
  total_points: number
  pick_count: number
  percentage: number
  // Stats
  pass_yards: number
  pass_td: number
  rush_yards: number
  rush_td: number
  receptions: number
  rec_yards: number
  rec_td: number
  fg_made_yards: number
  xp_made: number
  def_pts_allowed: number
  def_sacks: number
  def_int: number
  def_fumble_rec: number
}

interface ValuePlayersTableProps {
  weekId: number
}

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

export default function ValuePlayersTable({ weekId }: ValuePlayersTableProps) {
  const [mvps, setMvps] = useState<PlayerValue[]>([])
  const [lvps, setLvps] = useState<PlayerValue[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLineups, setTotalLineups] = useState(0)

  useEffect(() => {
    async function fetchValuePlayers() {
      setLoading(true)

      // First get all submitted lineups for this week (matching AdminPlayerStats approach)
      const { data: submittedLineups, error: lineupError } = await supabase
        .from('lineups')
        .select('id')
        .eq('week_id', weekId)
        .eq('is_submitted', true)

      if (lineupError || !submittedLineups || submittedLineups.length === 0) {
        setMvps([])
        setLvps([])
        setTotalLineups(0)
        setLoading(false)
        return
      }

      const lineupIds = submittedLineups.map(l => l.id)
      const lineupCount = submittedLineups.length
      setTotalLineups(lineupCount)

      // Get all lineup players for these specific lineups
      const { data: lineupPlayers, error: lpError } = await supabase
        .from('lineup_players')
        .select(`
          player_id,
          player:players(
            name,
            position,
            team:teams(id, name)
          )
        `)
        .in('lineup_id', lineupIds)

      if (lpError) {
        console.error('Error fetching lineup players:', lpError)
        setLoading(false)
        return
      }

      // Get player stats for this week
      const { data: statsData, error: statsError } = await supabase
        .from('player_weekly_stats')
        .select('*')
        .eq('week_id', weekId)

      if (statsError) {
        console.error('Error fetching player stats:', statsError)
        setLoading(false)
        return
      }

      // Create stats lookup map
      const statsMap = new Map<string, typeof statsData[0]>()
      statsData?.forEach(stat => {
        statsMap.set(stat.player_id, stat)
      })

      // Count occurrences per player and collect stats
      const playerCounts: Record<string, {
        player_id: string
        player_name: string
        position: Position
        team_name: string
        team_id: string
        count: number
        total_points: number
        pass_yards: number
        pass_td: number
        rush_yards: number
        rush_td: number
        receptions: number
        rec_yards: number
        rec_td: number
        fg_made_yards: number
        xp_made: number
        def_pts_allowed: number
        def_sacks: number
        def_int: number
        def_fumble_rec: number
      }> = {}

      lineupPlayers?.forEach((lp) => {
        const playerData = lp.player
        if (!playerData) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = Array.isArray(playerData) ? playerData[0] : playerData as any
        if (!player) return

        const teamData = player.team
        const team = Array.isArray(teamData) ? teamData[0] : teamData

        const playerId = lp.player_id
        const stats = statsMap.get(playerId)

        if (!playerCounts[playerId]) {
          playerCounts[playerId] = {
            player_id: playerId,
            player_name: player.name,
            position: player.position as Position,
            team_name: team?.name || 'FA',
            team_id: team?.id || '',
            count: 0,
            total_points: stats?.total_points || 0,
            pass_yards: stats?.pass_yards || 0,
            pass_td: stats?.pass_td || 0,
            rush_yards: stats?.rush_yards || 0,
            rush_td: stats?.rush_td || 0,
            receptions: stats?.receptions || 0,
            rec_yards: stats?.rec_yards || 0,
            rec_td: stats?.rec_td || 0,
            fg_made_yards: stats?.fg_made_yards || 0,
            xp_made: stats?.xp_made || 0,
            def_pts_allowed: stats?.def_pts_allowed || 0,
            def_sacks: stats?.def_sacks || 0,
            def_int: stats?.def_int || 0,
            def_fumble_rec: stats?.def_fumble_rec || 0,
          }
        }
        playerCounts[playerId].count++
      })

      // Convert to array with percentages
      const allPlayers = Object.values(playerCounts).map(p => ({
        ...p,
        pick_count: p.count,
        percentage: Math.round((p.count / lineupCount) * 100)
      }))

      // Manual overrides for specific weeks/positions where we want specific players featured
      const MVP_OVERRIDES: Record<number, Partial<Record<Position, string[]>>> = {
        2: {
          WR: ['9504'], // Kayshon Boutte should be WR2 for Week 2
        }
      }

      // MVPs: High points relative to ownership - true value finds
      // Calculate "value score" = points / ownership%
      // Higher = better value (scored a lot but wasn't popular)
      // Require minimum 5 points to filter out flukes
      const getMvpsByPosition = (position: Position, count: number): PlayerValue[] => {
        const overrides = MVP_OVERRIDES[weekId]?.[position] || []
        const overridePlayers: PlayerValue[] = []
        for (const id of overrides) {
          const player = allPlayers.find(p => p.player_id === id)
          if (player && player.total_points >= 5) {
            overridePlayers.push(player)
          }
        }

        const algorithmPicks = allPlayers
          .filter(p => p.position === position && p.total_points >= 5 && !overrides.includes(p.player_id))
          .map(p => ({
            ...p,
            // Value score: points per ownership point
            // Use max(ownership, 1) to avoid division by zero
            valueScore: p.total_points / Math.max(p.percentage, 1)
          }))
          .sort((a, b) => b.valueScore - a.valueScore)

        // Combine: overrides first, then fill remaining slots with algorithm picks
        const combined: PlayerValue[] = [...overridePlayers]
        for (const pick of algorithmPicks) {
          if (combined.length >= count) break
          if (!combined.find(p => p.player_id === pick.player_id)) {
            combined.push(pick)
          }
        }
        return combined.slice(0, count)
      }

      // LVPs: High ownership AND bad performance - true busts
      // Calculate "bust score" = ownership% * (avg_points - actual_points)
      // This rewards both high ownership AND large underperformance
      const getLvpsByPosition = (position: Position, count: number): PlayerValue[] => {
        const positionPlayers = allPlayers.filter(p => p.position === position && p.total_points > 0)
        if (positionPlayers.length === 0) return []

        // Calculate average points for this position
        const avgPoints = positionPlayers.reduce((sum, p) => sum + p.total_points, 0) / positionPlayers.length

        // Filter to players who underperformed (below average) AND had meaningful ownership (5%+)
        return positionPlayers
          .filter(p => p.total_points < avgPoints && p.percentage >= 5)
          .map(p => ({
            ...p,
            // Bust score: ownership * underperformance amount
            // Higher = bigger bust (more people started them AND they did worse)
            bustScore: p.percentage * (avgPoints - p.total_points)
          }))
          .sort((a, b) => b.bustScore - a.bustScore) // Highest bust score first
          .slice(0, count)
      }

      const mvpPicks: PlayerValue[] = [
        ...getMvpsByPosition('QB', 1),
        ...getMvpsByPosition('RB', 2),
        ...getMvpsByPosition('WR', 2),
        ...getMvpsByPosition('TE', 1),
        ...getMvpsByPosition('K', 1),
        ...getMvpsByPosition('DEF', 1),
      ]

      const lvpPicks: PlayerValue[] = [
        ...getLvpsByPosition('QB', 1),
        ...getLvpsByPosition('RB', 2),
        ...getLvpsByPosition('WR', 2),
        ...getLvpsByPosition('TE', 1),
        ...getLvpsByPosition('K', 1),
        ...getLvpsByPosition('DEF', 1),
      ]

      setMvps(mvpPicks)
      setLvps(lvpPicks)
      setLoading(false)
    }

    fetchValuePlayers()
  }, [weekId])

  // Format stats based on position
  const formatStats = (player: PlayerValue): string => {
    if (player.position === 'QB') {
      const parts = []
      if (player.pass_yards > 0 || player.pass_td > 0) {
        parts.push(`${player.pass_yards} yd, ${player.pass_td} TD`)
      }
      if (player.rush_yards > 0 || player.rush_td > 0) {
        parts.push(`${player.rush_yards} rush yd`)
      }
      return parts.join(' | ') || '--'
    }
    if (player.position === 'RB') {
      const parts = []
      if (player.rush_yards > 0 || player.rush_td > 0) {
        parts.push(`${player.rush_yards} yd, ${player.rush_td} TD`)
      }
      if (player.receptions > 0) {
        parts.push(`${player.receptions} rec, ${player.rec_yards} yd`)
      }
      return parts.join(' | ') || '--'
    }
    if (player.position === 'WR' || player.position === 'TE') {
      if (player.receptions > 0 || player.rec_yards > 0 || player.rec_td > 0) {
        return `${player.receptions} rec, ${player.rec_yards} yd, ${player.rec_td} TD`
      }
      return '--'
    }
    if (player.position === 'K') {
      if (player.fg_made_yards > 0 || player.xp_made > 0) {
        return `${player.fg_made_yards} FG yd, ${player.xp_made} XP`
      }
      return '--'
    }
    if (player.position === 'DEF') {
      const parts = [`${player.def_pts_allowed} PA`]
      if (player.def_sacks > 0) parts.push(`${player.def_sacks} sack`)
      if (player.def_int > 0) parts.push(`${player.def_int} INT`)
      if (player.def_fumble_rec > 0) parts.push(`${player.def_fumble_rec} FR`)
      return parts.join(', ')
    }
    return '--'
  }

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

  // Table row component
  const PlayerRow = ({ player, isMvp }: { player: PlayerValue; isMvp: boolean }) => {
    const isDefense = player.position === 'DEF'

    return (
      <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition">
        <td className="py-3 pl-3 pr-2">
          <div className="flex items-center gap-2">
            <img
              src={isDefense ? getTeamLogoUrl(player.team_id) : getPlayerHeadshotUrl(player.player_id)}
              alt={player.player_name}
              className={`w-10 h-10 object-cover bg-slate-700 ${isDefense ? 'rounded-lg p-1' : 'rounded-full'}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
              }}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate max-w-[120px]" title={player.player_name}>
                {player.player_name}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getPositionStyle(player.position)}`}>
                  {player.position}
                </span>
                <span className="text-xs text-slate-500">{player.team_id}</span>
              </div>
            </div>
          </div>
        </td>
        <td className="py-3 px-2 hidden sm:table-cell">
          <div className="text-xs text-slate-400 max-w-[150px] truncate" title={formatStats(player)}>
            {formatStats(player)}
          </div>
        </td>
        <td className="py-3 px-2 text-center">
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            isMvp
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {player.percentage}%
          </span>
        </td>
        <td className="py-3 pl-2 pr-3 text-right">
          <span className={`text-sm font-bold ${
            isMvp
              ? 'text-green-400'
              : player.total_points < 5 ? 'text-red-400' : 'text-slate-300'
          }`}>
            {player.total_points.toFixed(1)}
          </span>
        </td>
      </tr>
    )
  }

  if (loading) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Players Of The Week</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  if (totalLineups === 0) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Players Of The Week</h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No submitted lineups yet for Week {weekId}
        </p>
      </div>
    )
  }

  return (
    <div className="card-solid p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Players Of The Week</h3>
        <span className="text-xs text-slate-500">
          {totalLineups} lineups
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MVPs - High Points, Low Ownership */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <h4 className="text-sm font-semibold text-green-400">Most Valuable Players</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3">Highest scoring players with low ownership</p>
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="py-2 pl-3 pr-2 text-left font-medium">Player</th>
                  <th className="py-2 px-2 text-left font-medium hidden sm:table-cell">Stats</th>
                  <th className="py-2 px-2 text-center font-medium">Own%</th>
                  <th className="py-2 pl-2 pr-3 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {mvps.map((player) => (
                  <PlayerRow key={player.player_id} player={player} isMvp={true} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LVPs - Low Points, High Ownership */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <h4 className="text-sm font-semibold text-red-400">Least Valuable Players</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3">Popular picks that underperformed</p>
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="py-2 pl-3 pr-2 text-left font-medium">Player</th>
                  <th className="py-2 px-2 text-left font-medium hidden sm:table-cell">Stats</th>
                  <th className="py-2 px-2 text-center font-medium">Own%</th>
                  <th className="py-2 pl-2 pr-3 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {lvps.map((player) => (
                  <PlayerRow key={player.player_id} player={player} isMvp={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          MVPs: High points with low ownership = great value finds. LVPs: Popular picks that busted.
        </p>
      </div>
    </div>
  )
}
