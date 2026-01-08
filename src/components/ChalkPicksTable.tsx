import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Position } from '../types/database'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'
import { areLineupsLocked } from '../lib/kickoff'

interface ChalkPick {
  player_id: string
  player_name: string
  position: Position
  team_name: string
  team_id: string
  pick_count: number
  percentage: number
}

interface ChalkPicksTableProps {
  weekId: number
}

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

export default function ChalkPicksTable({ weekId }: ChalkPicksTableProps) {
  const [picks, setPicks] = useState<ChalkPick[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLineups, setTotalLineups] = useState(0)

  useEffect(() => {
    async function fetchChalkPicks() {
      setLoading(true)

      // First get total submitted lineups for this week
      const { count: lineupCount } = await supabase
        .from('lineups')
        .select('*', { count: 'exact', head: true })
        .eq('week_id', weekId)
        .eq('is_submitted', true)

      setTotalLineups(lineupCount || 0)

      if (!lineupCount || lineupCount === 0) {
        setPicks([])
        setLoading(false)
        return
      }

      // Get all lineup players for submitted lineups this week with player and team info
      const { data: lineupPlayers, error } = await supabase
        .from('lineup_players')
        .select(`
          player_id,
          lineup:lineups!inner(week_id, is_submitted),
          player:players(
            name,
            position,
            team:teams(id, name)
          )
        `)
        .eq('lineup.week_id', weekId)
        .eq('lineup.is_submitted', true)

      if (error) {
        console.error('Error fetching chalk picks:', error)
        setLoading(false)
        return
      }

      // Count occurrences per player
      const playerCounts: Record<string, {
        player_id: string
        player_name: string
        position: Position
        team_name: string
        team_id: string
        count: number
      }> = {}

      lineupPlayers?.forEach((lp) => {
        // Handle Supabase join structure - player comes as array or object
        const playerData = lp.player
        if (!playerData) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = Array.isArray(playerData) ? playerData[0] : playerData as any
        if (!player) return

        // Team is also a join result
        const teamData = player.team
        const team = Array.isArray(teamData) ? teamData[0] : teamData

        const playerId = lp.player_id
        if (!playerCounts[playerId]) {
          playerCounts[playerId] = {
            player_id: playerId,
            player_name: player.name,
            position: player.position as Position,
            team_name: team?.name || 'FA',
            team_id: team?.id || '',
            count: 0
          }
        }
        playerCounts[playerId].count++
      })

      // Convert to array and calculate percentages
      const allPicks = Object.values(playerCounts).map(p => ({
        ...p,
        pick_count: p.count,
        percentage: Math.round((p.count / lineupCount) * 100)
      }))

      // Get most popular by position
      // Need: 1 QB, 2 RB, 2 WR, 1 TE, 1 DEF
      const getTopByPosition = (position: Position, count: number): ChalkPick[] => {
        return allPicks
          .filter(p => p.position === position)
          .sort((a, b) => b.pick_count - a.pick_count)
          .slice(0, count)
      }

      const chalkPicks: ChalkPick[] = [
        ...getTopByPosition('QB', 1),
        ...getTopByPosition('RB', 2),
        ...getTopByPosition('WR', 2),
        ...getTopByPosition('TE', 1),
        ...getTopByPosition('DEF', 1),
      ]

      setPicks(chalkPicks)
      setLoading(false)
    }

    fetchChalkPicks()
  }, [weekId])

  // Position badge colors
  const getPositionStyle = (position: Position) => {
    switch (position) {
      case 'QB': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'RB': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'WR': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'TE': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'DEF': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  // Get ownership percentage badge style based on percentage
  const getOwnershipStyle = (percentage: number) => {
    if (percentage >= 70) {
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    } else if (percentage >= 50) {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    } else {
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    }
  }

  // Player card component
  const PlayerCard = ({ pick }: { pick: ChalkPick }) => {
    const isDefense = pick.position === 'DEF'

    return (
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition group">
        {/* Position badge */}
        <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-xs font-bold border ${getPositionStyle(pick.position)}`}>
          {pick.position}
        </div>

        {/* Ownership percentage badge - top right */}
        <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded text-xs font-bold border ${getOwnershipStyle(pick.percentage)}`}>
          {pick.percentage}%
        </div>

        {/* Player image - large and centered */}
        <div className="relative pt-3 px-3">
          <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28">
            <img
              src={isDefense ? getTeamLogoUrl(pick.team_id) : getPlayerHeadshotUrl(pick.player_id)}
              alt={pick.player_name}
              className={`w-full h-full object-cover bg-slate-700 ${isDefense ? 'rounded-xl p-2' : 'rounded-full'}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
              }}
            />
            {/* Team logo overlay for non-defense */}
            {!isDefense && pick.team_id && (
              <img
                src={getTeamLogoUrl(pick.team_id)}
                alt={pick.team_name}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 p-0.5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        </div>

        {/* Player info */}
        <div className="p-3 text-center">
          <div className="text-sm font-semibold text-white truncate" title={pick.player_name}>
            {pick.player_name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {pick.team_name}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Chalk Picks of the Week</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  if (totalLineups === 0) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Chalk Picks of the Week</h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No submitted lineups yet for Week {weekId}
        </p>
      </div>
    )
  }

  // Hide results until lineups are locked
  if (!areLineupsLocked()) {
    return (
      <div className="card-solid p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Chalk Picks of the Week</h3>
          <span className="text-xs text-slate-500">
            {totalLineups} lineups
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-slate-400 text-sm text-center">
            Results revealed at kickoff
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-solid p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Chalk Picks of the Week</h3>
        <span className="text-xs text-slate-500">
          {totalLineups} lineups
        </span>
      </div>

      {/* Player cards grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {picks.map((pick) => (
          <PlayerCard key={pick.player_id} pick={pick} />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Most popular picks among all entries
        </p>
      </div>
    </div>
  )
}
