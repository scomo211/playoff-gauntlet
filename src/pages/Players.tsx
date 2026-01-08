import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Player, Team, Position } from '../types/database'
import { createPlayerKey } from '../lib/projections'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'
import Layout from '../components/Layout'
import PlayoffBracket from '../components/PlayoffBracket'

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

type SortField = 'name' | 'totalPoints' | 'projectedPoints'
type SortDirection = 'asc' | 'desc'

interface PlayerStats {
  player_id: string
  total_points: number
}

interface Projection {
  player_name: string
  team_id: string
  fantasy_points: number
}

const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-red-500/10 text-red-400 border-red-500/20',
  RB: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  WR: 'bg-green-500/10 text-green-400 border-green-500/20',
  TE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  K: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DEF: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function Players() {
  const [players, setPlayers] = useState<(Player & { team: Team })[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [playerStats, setPlayerStats] = useState<Map<string, number>>(new Map())
  const [projections, setProjections] = useState<Map<string, number>>(new Map())
  const [currentWeekId, setCurrentWeekId] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL')
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('projectedPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch current week
        const { data: weekData } = await supabase
          .from('weeks')
          .select('id')
          .eq('is_current', true)
          .single()

        const weekId = weekData?.id || 1
        setCurrentWeekId(weekId)

        // Fetch teams (all alive teams, including those on bye)
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('is_alive', true)
          .order('city', { ascending: true })

        if (teamsError) throw teamsError
        setTeams(teamsData)

        // Fetch players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select(`
            *,
            team:teams(*)
          `)
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (playersError) throw playersError
        setPlayers(playersData as (Player & { team: Team })[])

        // Fetch player stats (total points from all weeks)
        const { data: statsData } = await supabase
          .from('player_weekly_stats')
          .select('player_id, total_points')

        if (statsData) {
          const statsMap = new Map<string, number>()
          statsData.forEach((stat: PlayerStats) => {
            const current = statsMap.get(stat.player_id) || 0
            statsMap.set(stat.player_id, current + stat.total_points)
          })
          setPlayerStats(statsMap)
        }

        // Fetch projections for current week
        const { data: projData } = await supabase
          .from('projections')
          .select('player_name, team_id, fantasy_points')
          .eq('week_id', weekId)

        if (projData) {
          const projMap = new Map<string, number>()
          projData.forEach((proj: Projection) => {
            const key = `${proj.player_name}|${proj.team_id.toUpperCase()}`
            projMap.set(key, proj.fantasy_points)
          })
          setProjections(projMap)
        }

      } catch (err) {
        console.error('Failed to fetch players:', err)
        setError(err instanceof Error ? err.message : 'Failed to load players')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Helper to get projection for a player
  const getProjection = (player: Player & { team: Team }): number => {
    if (!player.team_id) return 0
    const key = createPlayerKey(player.name, player.team_id)
    return projections.get(key) || 0
  }

  // Helper to get total points for a player
  const getTotalPoints = (player: Player): number => {
    return playerStats.get(player.id) || 0
  }

  // Helper to check if team is on bye this week
  const isTeamOnBye = (team: Team | undefined): boolean => {
    if (!team || !team.is_alive) return false
    // Wild Card week: seed 1 teams have bye
    if (currentWeekId === 1 && team.playoff_seed === 1) return true
    return false
  }

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Check if player's team is eliminated
  const isTeamEliminated = (team: Team | undefined): boolean => {
    return team ? !team.is_alive : true
  }

  // Filter and sort players (include bye team players and eliminated players)
  const filteredPlayers = useMemo(() => {
    let result = players.filter(player => {
      if (selectedPosition !== 'ALL' && player.position !== selectedPosition) return false
      if (selectedTeam !== 'ALL' && player.team_id !== selectedTeam) return false
      if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })

    // Sort: unavailable players (eliminated/bye) at the end
    result.sort((a, b) => {
      // First sort by availability status
      const aEliminated = isTeamEliminated(a.team)
      const bEliminated = isTeamEliminated(b.team)
      const aOnBye = isTeamOnBye(a.team)
      const bOnBye = isTeamOnBye(b.team)
      const aUnavailable = aEliminated || aOnBye
      const bUnavailable = bEliminated || bOnBye
      if (aUnavailable && !bUnavailable) return 1
      if (!aUnavailable && bUnavailable) return -1

      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'totalPoints':
          comparison = getTotalPoints(a) - getTotalPoints(b)
          break
        case 'projectedPoints':
          comparison = getProjection(a) - getProjection(b)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [players, selectedPosition, selectedTeam, searchQuery, sortField, sortDirection, projections, playerStats, currentWeekId])

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Players</h1>
        <p className="mt-1 text-slate-400">
          Browse available players from teams still in the playoffs
        </p>
      </div>

      {/* Playoff Bracket */}
      <PlayoffBracket />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2 sm:gap-4">
        <div className="flex-1 min-w-0 sm:flex-none">
          <label htmlFor="search" className="hidden sm:block text-sm font-medium text-slate-400 mb-1.5">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full sm:w-48 px-3 py-2 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-transparent transition text-sm"
          />
        </div>

        <div className="flex-shrink-0">
          <label htmlFor="position" className="hidden sm:block text-sm font-medium text-slate-400 mb-1.5">
            Position
          </label>
          <select
            id="position"
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value as Position | 'ALL')}
            className="px-3 py-2 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-transparent transition text-sm"
          >
            <option value="ALL">All</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0">
          <label htmlFor="team" className="hidden sm:block text-sm font-medium text-slate-400 mb-1.5">
            Team
          </label>
          <select
            id="team"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-3 py-2 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-transparent transition text-sm"
          >
            <option value="ALL">All</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Table */}
      <div className="card-solid overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-400 mb-2">Failed to load players</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : filteredPlayers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th
                    className="pl-4 pr-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Player
                      {sortField === 'name' && (
                        <span className="text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-1 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Pos
                  </th>
                  <th
                    className="px-1 sm:px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('totalPoints')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      {sortField === 'totalPoints' && (
                        <span className="text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="pl-1 pr-4 sm:px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('projectedPoints')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Proj
                      {sortField === 'projectedPoints' && (
                        <span className="text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredPlayers.map(player => {
                  const totalPts = getTotalPoints(player)
                  const projPts = getProjection(player)
                  const eliminated = isTeamEliminated(player.team)
                  const onBye = isTeamOnBye(player.team)
                  const unavailable = eliminated || onBye
                  return (
                    <tr key={player.id} className={`transition-colors ${unavailable ? 'opacity-50' : 'hover:bg-slate-800/30'}`}>
                      <td className="pl-4 pr-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <img
                            src={getPlayerHeadshotUrl(player.id)}
                            alt={player.name}
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 object-cover ${unavailable ? 'grayscale' : ''}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                            }}
                          />
                          <div className="min-w-0">
                            <div className={`text-sm font-medium truncate ${unavailable ? 'text-slate-500' : 'text-white'}`}>{player.name}</div>
                            <div className={`text-xs truncate ${unavailable ? 'text-slate-600' : 'text-slate-500'}`}>
                              {player.team?.city} {player.team?.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-1 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-1.5">
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-lg text-xs font-medium border ${unavailable ? 'bg-slate-800 text-slate-500 border-slate-700' : POSITION_COLORS[player.position]}`}>
                            {player.position}
                          </span>
                          {eliminated && (
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-red-900/50 text-red-400 border border-red-500/30">
                              ELIM
                            </span>
                          )}
                          {onBye && !eliminated && (
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-slate-700 text-slate-400">
                              BYE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${unavailable ? 'text-slate-600' : totalPts > 0 ? 'text-white' : 'text-slate-500'}`}>
                          {totalPts.toFixed(1)}
                        </span>
                      </td>
                      <td className="pl-1 pr-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                        {unavailable ? (
                          <span className="text-sm font-medium text-slate-600">—</span>
                        ) : (
                          <span className={`text-sm font-medium ${projPts > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {projPts > 0 ? projPts.toFixed(1) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            {players.length === 0
              ? 'No players loaded yet. Player data will be imported before the playoffs begin.'
              : 'No players match your filters.'}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-slate-500">
        Showing {filteredPlayers.length} of {players.length} players
      </div>
    </Layout>
  )
}
