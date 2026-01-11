import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Player, Team, Position } from '../types/database'
import { createPlayerKey } from '../lib/projections'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'
import { getOpponentInfo } from '../lib/matchups'
import { useGameStatus } from '../hooks/useGameStatus'
import { GameStatus } from '../lib/schedule'
import Layout from '../components/Layout'
import PlayoffBracket from '../components/PlayoffBracket'
import AnimatedScore from '../components/AnimatedScore'

// Game status indicator component
function GameStatusIndicator({ status, eliminated }: { status: GameStatus | 'bye'; eliminated?: boolean }) {
  if (eliminated) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-900/50 text-red-400 border border-red-500/30">
        ELIM
      </span>
    )
  }

  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
        </span>
        LIVE
      </span>
    )
  }

  return null
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

type SortField = 'name' | 'totalPoints' | 'projectedPoints'
type SortDirection = 'asc' | 'desc'

interface PlayerStats {
  player_id: string
  total_points: number
  pass_cmp?: number
  pass_att?: number
  pass_yards?: number
  pass_td?: number
  rush_att?: number
  rush_yards?: number
  rush_td?: number
  receptions?: number
  rec_yards?: number
  rec_td?: number
  // Kicker stats
  fg_made_yards?: number
  xp_made?: number
  xp_missed?: number
  // Defense stats
  def_pts_allowed?: number
  def_sacks?: number
  def_int?: number
  def_fumble_rec?: number
  def_safety?: number
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

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

// Format player stats as inline text
function formatPlayerStats(stats: PlayerStats | undefined, position?: string): string {
  if (!stats) return ''

  const parts: string[] = []

  // Kicker stats: "FG: 66 yds, XP: 2/2"
  if (position === 'K') {
    const fgYards = stats.fg_made_yards || 0
    const xpMade = stats.xp_made || 0
    const xpMissed = stats.xp_missed || 0
    const xpAtt = xpMade + xpMissed
    if (fgYards > 0 || xpAtt > 0) {
      if (fgYards > 0) parts.push(`FG: ${fgYards} yds`)
      if (xpAtt > 0) parts.push(`XP: ${xpMade}/${xpAtt}`)
    }
    return parts.join(', ')
  }

  // Defense stats: "17 PA, 2 sacks, 1 INT"
  if (position === 'DEF') {
    const ptsAllowed = stats.def_pts_allowed || 0
    const sacks = stats.def_sacks || 0
    const ints = stats.def_int || 0
    const fumbles = stats.def_fumble_rec || 0
    const safeties = stats.def_safety || 0

    parts.push(`${ptsAllowed} PA`)
    if (sacks > 0) parts.push(`${sacks} sack${sacks !== 1 ? 's' : ''}`)
    if (ints > 0) parts.push(`${ints} INT`)
    if (fumbles > 0) parts.push(`${fumbles} FR`)
    if (safeties > 0) parts.push(`${safeties} safety`)
    return parts.join(', ')
  }

  // Passing stats: "14/18, 179 yd, 1 TD"
  if ((stats.pass_att || 0) > 0 || (stats.pass_yards || 0) > 0 || (stats.pass_td || 0) > 0) {
    parts.push(`${stats.pass_cmp || 0}/${stats.pass_att || 0}, ${stats.pass_yards || 0} yd, ${stats.pass_td || 0} TD`)
  }

  // Rushing stats: "3 car, 97 yd, 1 TD"
  if ((stats.rush_att || 0) > 0 || (stats.rush_yards || 0) !== 0 || (stats.rush_td || 0) > 0) {
    parts.push(`${stats.rush_att || 0} car, ${stats.rush_yards || 0} yd, ${stats.rush_td || 0} TD`)
  }

  // Receiving stats: "2 rec, 18 yd, 1 TD"
  if ((stats.receptions || 0) > 0 || (stats.rec_yards || 0) > 0 || (stats.rec_td || 0) > 0) {
    parts.push(`${stats.receptions || 0} rec, ${stats.rec_yards || 0} yd, ${stats.rec_td || 0} TD`)
  }

  return parts.join(' | ')
}

export default function Players() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<(Player & { team: Team })[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [playerStats, setPlayerStats] = useState<Map<string, number>>(new Map())
  const [weeklyStats, setWeeklyStats] = useState<Map<string, PlayerStats>>(new Map())
  const [projections, setProjections] = useState<Map<string, number>>(new Map())
  const [currentWeekId, setCurrentWeekId] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL')
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('totalPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [depthChartTeam, setDepthChartTeam] = useState<Team | null>(null)
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set())
  const [hasSingleEntry, setHasSingleEntry] = useState(false)

  const { getStatus: getGameStatus } = useGameStatus(currentWeekId)

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
          .select('player_id, total_points, week_id, pass_cmp, pass_att, pass_yards, pass_td, rush_att, rush_yards, rush_td, receptions, rec_yards, rec_td, fg_made_yards, xp_made, xp_missed, def_pts_allowed, def_sacks, def_int, def_fumble_rec, def_safety')

        if (statsData) {
          const statsMap = new Map<string, number>()
          const weeklyMap = new Map<string, PlayerStats>()
          statsData.forEach((stat: PlayerStats & { week_id: number }) => {
            const current = statsMap.get(stat.player_id) || 0
            statsMap.set(stat.player_id, current + stat.total_points)
            // Store current week's detailed stats
            if (stat.week_id === weekId) {
              weeklyMap.set(stat.player_id, stat)
            }
          })
          setPlayerStats(statsMap)
          setWeeklyStats(weeklyMap)
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

  // Fetch user's used players if they have only one entry
  useEffect(() => {
    async function fetchUsedPlayers() {
      if (!user) return

      // Get user's entries
      const { data: entries } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!entries || entries.length !== 1) {
        setHasSingleEntry(false)
        setUsedPlayerIds(new Set())
        return
      }

      setHasSingleEntry(true)
      const entryId = entries[0].id

      // Get used players for this entry
      const { data: usedPlayers } = await supabase
        .from('used_players')
        .select('player_id')
        .eq('entry_id', entryId)

      if (usedPlayers) {
        setUsedPlayerIds(new Set(usedPlayers.map(up => up.player_id)))
      }
    }

    fetchUsedPlayers()
  }, [user])

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

  // Get opponent display text for a team
  const getOpponentDisplay = (team: Team | undefined): string => {
    if (!team) return ''
    const info = getOpponentInfo(team, currentWeekId, teams)
    return info.displayText
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

  // Get depth chart for a team (sorted by total points - consistent order across weeks)
  const getDepthChart = (team: Team) => {
    const teamPlayers = players.filter(p => p.team_id === team.id)

    // Sort by total points scored (descending) - consistent ordering
    const sortByTotalPoints = (a: Player, b: Player) => {
      const aPts = playerStats.get(a.id) || 0
      const bPts = playerStats.get(b.id) || 0
      return bPts - aPts
    }

    const qbs = teamPlayers.filter(p => p.position === 'QB').sort(sortByTotalPoints).slice(0, 2)
    const rbs = teamPlayers.filter(p => p.position === 'RB').sort(sortByTotalPoints).slice(0, 3)
    const wrs = teamPlayers.filter(p => p.position === 'WR').sort(sortByTotalPoints).slice(0, 6)
    const tes = teamPlayers.filter(p => p.position === 'TE').sort(sortByTotalPoints).slice(0, 3)
    const ks = teamPlayers.filter(p => p.position === 'K').sort(sortByTotalPoints).slice(0, 1)

    return { qbs, rbs, wrs, tes, ks }
  }

  // Filter and sort players (include bye team players and eliminated players)
  const filteredPlayers = useMemo(() => {
    let result = players.filter(player => {
      if (selectedPosition !== 'ALL' && player.position !== selectedPosition) return false
      if (selectedTeam !== 'ALL' && player.team_id !== selectedTeam) return false
      if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })

    // Sort: bye week players at the end, but eliminated players mixed in normally
    result.sort((a, b) => {
      // Only push bye week players to the end (they'll play later)
      const aOnBye = isTeamOnBye(a.team)
      const bOnBye = isTeamOnBye(b.team)
      if (aOnBye && !bOnBye) return 1
      if (!aOnBye && bOnBye) return -1

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
      {/* Playoff Bracket */}
      <PlayoffBracket onTeamClick={(team) => setDepthChartTeam(team)} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Players</h1>
        <p className="mt-1 text-slate-400">
          Browse available players from teams still in the playoffs
        </p>
      </div>

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
                  const gameStatus = !unavailable ? getGameStatus(player.team?.id, player.team?.playoff_seed) : 'upcoming'
                  const isLive = gameStatus === 'live'
                  const isFinal = gameStatus === 'final'
                  const stats = weeklyStats.get(player.id)
                  const statsText = formatPlayerStats(stats, player.position)
                  return (
                    <tr key={player.id} className={`transition-colors ${
                      isLive ? 'bg-green-500/10' :
                      isFinal ? 'bg-slate-500/10' :
                      onBye ? 'opacity-50' : 'hover:bg-slate-800/30'
                    }`}>
                      <td className="pl-4 pr-2 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <img
                            src={getPlayerHeadshotUrl(player.id)}
                            alt={player.name}
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 object-cover ${eliminated ? 'grayscale opacity-70' : onBye ? 'grayscale' : ''}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${eliminated ? 'text-slate-300' : onBye ? 'text-slate-500' : 'text-white'}`}>{player.name}</span>
                              <GameStatusIndicator status={gameStatus} eliminated={eliminated} />
                            </div>
                            <div className={`text-xs truncate ${unavailable ? 'text-slate-500' : 'text-slate-500'}`}>
                              {player.team?.city} {player.team?.name}
                              {!unavailable && getOpponentDisplay(player.team) && (
                                <span className="text-slate-600 ml-1">• {getOpponentDisplay(player.team)}</span>
                              )}
                            </div>
                            {statsText && (
                              <div className={`text-xs mt-0.5 hidden sm:block ${eliminated ? 'text-slate-400' : 'text-slate-500'}`}>{statsText}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-1 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-1.5">
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-lg text-xs font-medium border ${onBye ? 'bg-slate-800 text-slate-500 border-slate-700' : eliminated ? 'bg-slate-800/50 text-slate-400 border-slate-600' : POSITION_COLORS[player.position]}`}>
                            {player.position}
                          </span>
                          {onBye && !eliminated && (
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-slate-700 text-slate-400">
                              BYE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                        <AnimatedScore
                          value={totalPts}
                          className={`text-sm font-medium inline-block px-1 py-0.5 rounded ${eliminated ? 'text-slate-300' : onBye ? 'text-slate-600' : totalPts > 0 ? 'text-white' : 'text-slate-500'}`}
                        />
                      </td>
                      <td className="pl-1 pr-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                        {unavailable ? (
                          <span className="text-sm font-medium text-slate-600">—</span>
                        ) : projPts > 0 ? (
                          <AnimatedScore
                            value={projPts}
                            className="text-sm font-medium text-emerald-400 inline-block px-1 py-0.5 rounded"
                          />
                        ) : (
                          <span className="text-sm font-medium text-slate-500">—</span>
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

      {/* Depth Chart Modal */}
      {depthChartTeam && (() => {
        const depth = getDepthChart(depthChartTeam)
        const eliminated = !depthChartTeam.is_alive

        const PlayerRow = ({ player, label }: { player: Player; label?: string }) => {
          const pts = playerStats.get(player.id) || 0
          const isUsed = hasSingleEntry && usedPlayerIds.has(player.id)
          return (
            <div className="flex items-center gap-3 py-2">
              <img
                src={getPlayerHeadshotUrl(player.id)}
                alt={player.name}
                className={`w-10 h-10 rounded-full bg-slate-700 object-cover flex-shrink-0 ${eliminated ? 'grayscale' : ''}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium truncate ${eliminated ? 'text-slate-400' : 'text-white'}`}>
                    {player.name}
                  </span>
                  {isUsed && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-500/30 flex-shrink-0">
                      USED
                    </span>
                  )}
                </div>
                {label && (
                  <div className="text-xs text-slate-500">{label}</div>
                )}
              </div>
              <div className={`text-sm font-medium ${pts > 0 ? 'text-field-400' : 'text-slate-500'}`}>
                <AnimatedScore value={pts} className="inline-block px-1 py-0.5 rounded" /> pts
              </div>
            </div>
          )
        }

        const PositionSection = ({ title, players: posPlayers, labels }: { title: string; players: Player[]; labels?: string[] }) => (
          <div className="mb-4">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${POSITION_COLORS[title as Position] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                {title}
              </span>
            </div>
            <div className="space-y-1">
              {posPlayers.map((player, i) => (
                <PlayerRow key={player.id} player={player} label={labels?.[i]} />
              ))}
              {posPlayers.length === 0 && (
                <div className="text-sm text-slate-500 py-2">No players</div>
              )}
            </div>
          </div>
        )

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setDepthChartTeam(null)}
            />
            <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 p-4 border-b border-slate-700 bg-slate-800/50">
                <img
                  src={getTeamLogoUrl(depthChartTeam.id)}
                  alt={depthChartTeam.name}
                  className={`w-12 h-12 object-contain ${eliminated ? 'grayscale opacity-50' : ''}`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex-1">
                  <h2 className={`text-lg font-bold ${eliminated ? 'text-slate-400' : 'text-white'}`}>
                    {depthChartTeam.city} {depthChartTeam.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Depth Chart</span>
                    {eliminated && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 border border-red-500/30">
                        ELIMINATED
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDepthChartTeam(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-4 flex-1">
                <PositionSection title="QB" players={depth.qbs} labels={['Starter', 'Backup']} />
                <PositionSection title="RB" players={depth.rbs} />
                <PositionSection title="WR" players={depth.wrs} />
                <PositionSection title="TE" players={depth.tes} />
                <PositionSection title="K" players={depth.ks} />
              </div>
            </div>
          </div>
        )
      })()}
    </Layout>
  )
}
