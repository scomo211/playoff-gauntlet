import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../../lib/playerImages'

interface PlayerUsage {
  player_id: string
  player_name: string
  team_name: string
  position: string
  count: number
  percentage: number
  week_points: number
}

interface WeekStats {
  week_id: number
  week_name: string
  total_lineups: number
  submitted_lineups: number
  players: PlayerUsage[]
}

interface EntryWithPlayer {
  entry_id: string
  entry_name: string
  display_name: string
  lineup_points: number
}

export default function AdminPlayerStats() {
  const [weeks, setWeeks] = useState<{ id: number; name: string }[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [stats, setStats] = useState<WeekStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'most_used' | 'least_used' | 'most_points' | 'least_points'>('most_used')

  // Modal state for viewing entries with a player
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerUsage | null>(null)
  const [entriesWithPlayer, setEntriesWithPlayer] = useState<EntryWithPlayer[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  // Fetch weeks
  useEffect(() => {
    async function fetchWeeks() {
      const { data } = await supabase
        .from('weeks')
        .select('id, name')
        .order('id')

      if (data) {
        setWeeks(data)
        // Find current week
        const { data: currentWeek } = await supabase
          .from('weeks')
          .select('id')
          .eq('is_current', true)
          .single()

        if (currentWeek) setSelectedWeek(currentWeek.id)
      }
    }
    fetchWeeks()
  }, [])

  // Fetch player usage stats for selected week
  useEffect(() => {
    async function fetchStats() {
      setLoading(true)

      try {
        // Get week info
        const { data: weekData } = await supabase
          .from('weeks')
          .select('id, name')
          .eq('id', selectedWeek)
          .single()

        if (!weekData) return

        // Get all lineups for this week
        const { data: lineupsData } = await supabase
          .from('lineups')
          .select('id, is_submitted, entry:entries!inner(is_active)')
          .eq('week_id', selectedWeek)

        // Filter to only active entries
        const activeLineups = lineupsData?.filter(l => (l.entry as any)?.is_active) || []
        const submittedLineups = activeLineups.filter(l => l.is_submitted)
        const lineupIds = submittedLineups.map(l => l.id)

        if (lineupIds.length === 0) {
          setStats({
            week_id: weekData.id,
            week_name: weekData.name,
            total_lineups: activeLineups.length,
            submitted_lineups: 0,
            players: [],
          })
          setLoading(false)
          return
        }

        // Get all lineup_players for these lineups
        const { data: lineupPlayersData } = await supabase
          .from('lineup_players')
          .select(`
            player_id,
            player:players(
              id,
              name,
              position,
              team:teams(name)
            )
          `)
          .in('lineup_id', lineupIds)

        // Get player weekly stats for this week
        const { data: playerStatsData } = await supabase
          .from('player_weekly_stats')
          .select('player_id, total_points')
          .eq('week_id', selectedWeek)

        // Create a map of player_id to total_points
        const playerPointsMap = new Map<string, number>()
        playerStatsData?.forEach(stat => {
          playerPointsMap.set(stat.player_id, stat.total_points || 0)
        })

        // Count player usage
        const playerCounts = new Map<string, {
          player_id: string
          player_name: string
          team_name: string
          position: string
          count: number
          week_points: number
        }>()

        lineupPlayersData?.forEach(lp => {
          const player = lp.player as any
          if (!player) return

          const existing = playerCounts.get(player.id)
          if (existing) {
            existing.count++
          } else {
            playerCounts.set(player.id, {
              player_id: player.id,
              player_name: player.name,
              team_name: player.team?.name || 'Unknown',
              position: player.position,
              count: 1,
              week_points: playerPointsMap.get(player.id) || 0,
            })
          }
        })

        // Convert to array with percentages
        const totalSubmitted = submittedLineups.length
        const playersArray: PlayerUsage[] = Array.from(playerCounts.values()).map(p => ({
          ...p,
          percentage: (p.count / totalSubmitted) * 100,
        }))

        setStats({
          week_id: weekData.id,
          week_name: weekData.name,
          total_lineups: activeLineups.length,
          submitted_lineups: totalSubmitted,
          players: playersArray,
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    if (selectedWeek) fetchStats()
  }, [selectedWeek])

  // Fetch entries that used the selected player
  useEffect(() => {
    async function fetchEntriesWithPlayer() {
      if (!selectedPlayer) {
        setEntriesWithPlayer([])
        return
      }

      setEntriesLoading(true)
      try {
        // Get all lineup_players for this player in this week
        const { data: lineupPlayersData } = await supabase
          .from('lineup_players')
          .select(`
            lineup_id,
            lineup:lineups!inner(
              id,
              total_points,
              week_id,
              entry:entries!inner(
                id,
                entry_name,
                is_active,
                profile:profiles(display_name)
              )
            )
          `)
          .eq('player_id', selectedPlayer.player_id)

        if (!lineupPlayersData) {
          setEntriesWithPlayer([])
          return
        }

        // Filter to only the selected week and active entries
        const entries: EntryWithPlayer[] = lineupPlayersData
          .filter(lp => {
            const lineup = lp.lineup as any
            return lineup?.week_id === selectedWeek && lineup?.entry?.is_active
          })
          .map(lp => {
            const lineup = lp.lineup as any
            const entry = lineup?.entry
            const profile = entry?.profile as any
            return {
              entry_id: entry?.id,
              entry_name: entry?.entry_name || 'Unknown',
              display_name: Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name || 'Unknown',
              lineup_points: lineup?.total_points || 0,
            }
          })
          .sort((a, b) => b.lineup_points - a.lineup_points)

        setEntriesWithPlayer(entries)
      } catch (err) {
        console.error('Failed to fetch entries with player:', err)
        setEntriesWithPlayer([])
      } finally {
        setEntriesLoading(false)
      }
    }

    fetchEntriesWithPlayer()
  }, [selectedPlayer, selectedWeek])

  // Filter and sort players
  const filteredPlayers = stats?.players
    .filter(p => positionFilter === 'ALL' || p.position === positionFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'most_used': return b.percentage - a.percentage
        case 'least_used': return a.percentage - b.percentage
        case 'most_points': return b.week_points - a.week_points
        case 'least_points': return a.week_points - b.week_points
        default: return 0
      }
    }) || []

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Player Usage Stats</h1>
        <p className="mt-1 text-gray-600">See which players are most/least used in lineups</p>
      </div>

      {/* Week selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {weeks.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedWeek(w.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              w.id === selectedWeek
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {w.name}
          </button>
        ))}
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Active Entries</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_lineups}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Submitted Lineups</div>
            <div className="text-2xl font-bold text-green-600">{stats.submitted_lineups}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Unique Players Used</div>
            <div className="text-2xl font-bold text-blue-600">{stats.players.length}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2">
          {positions.map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pos === positionFilter
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'most_used' | 'least_used' | 'most_points' | 'least_points')}
          className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="most_used">Most Used First</option>
          <option value="least_used">Least Used First</option>
          <option value="most_points">Most Points First</option>
          <option value="least_points">Least Points First</option>
        </select>
      </div>

      {/* Player list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No player data available for this week
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => setSortBy(sortBy === 'most_used' ? 'least_used' : 'most_used')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Times Used
                    {(sortBy === 'most_used' || sortBy === 'least_used') && (
                      <span className="text-blue-600">
                        {sortBy === 'most_used' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => setSortBy(sortBy === 'most_points' ? 'least_points' : 'most_points')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Points
                    {(sortBy === 'most_points' || sortBy === 'least_points') && (
                      <span className="text-blue-600">
                        {sortBy === 'most_points' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => setSortBy(sortBy === 'most_used' ? 'least_used' : 'most_used')}
                >
                  <div className="flex items-center gap-1">
                    Usage %
                    {(sortBy === 'most_used' || sortBy === 'least_used') && (
                      <span className="text-blue-600">
                        {sortBy === 'most_used' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlayers.map((player, index) => (
                <tr
                  key={player.player_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedPlayer(player)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                      <img
                        src={getPlayerHeadshotUrl(player.player_id)}
                        alt={player.player_name}
                        className="w-10 h-10 rounded-full bg-gray-200 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{player.player_name}</div>
                        <div className="text-sm text-gray-500">{player.team_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      player.position === 'QB' ? 'bg-red-100 text-red-800' :
                      player.position === 'RB' ? 'bg-blue-100 text-blue-800' :
                      player.position === 'WR' ? 'bg-green-100 text-green-800' :
                      player.position === 'TE' ? 'bg-yellow-100 text-yellow-800' :
                      player.position === 'K' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {player.count}
                    </span>
                    <span className="text-sm text-gray-500">
                      /{stats?.submitted_lineups}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {player.week_points.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[200px]">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              player.percentage >= 75 ? 'bg-red-500' :
                              player.percentage >= 50 ? 'bg-yellow-500' :
                              player.percentage >= 25 ? 'bg-blue-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${player.percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-14 text-right">
                        {player.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredPlayers.length} players • Click a player to see entries
      </div>

      {/* Modal for viewing entries with selected player */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={getPlayerHeadshotUrl(selectedPlayer.player_id)}
                  alt={selectedPlayer.player_name}
                  className="w-12 h-12 rounded-full bg-gray-200 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                  }}
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedPlayer.player_name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedPlayer.team_name} • {selectedPlayer.position} • {selectedPlayer.week_points.toFixed(1)} pts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="text-sm text-gray-500 mb-3">
                {entriesWithPlayer.length} {entriesWithPlayer.length === 1 ? 'entry' : 'entries'} started this player
              </div>

              {entriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : entriesWithPlayer.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No entries found with this player
                </div>
              ) : (
                <div className="space-y-2">
                  {entriesWithPlayer.map((entry) => (
                    <Link
                      key={entry.entry_id}
                      to={`/entries/${entry.entry_id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      onClick={() => setSelectedPlayer(null)}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{entry.entry_name}</div>
                        <div className="text-sm text-gray-500">{entry.display_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{entry.lineup_points.toFixed(1)}</div>
                        <div className="text-xs text-gray-500">lineup pts</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
