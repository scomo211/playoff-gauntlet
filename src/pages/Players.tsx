import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Player, Team, Position } from '../types/database'
import Layout from '../components/Layout'

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

export default function Players() {
  const [players, setPlayers] = useState<(Player & { team: Team })[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL')
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch teams
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

      } catch (err) {
        console.error('Failed to fetch players:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredPlayers = players.filter(player => {
    if (selectedPosition !== 'ALL' && player.position !== selectedPosition) return false
    if (selectedTeam !== 'ALL' && player.team_id !== selectedTeam) return false
    if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (!player.team?.is_alive) return false
    return true
  })

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Players</h1>
        <p className="mt-1 text-gray-600">
          Browse available players from teams still in the playoffs
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-64 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
            Position
          </label>
          <select
            id="position"
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value as Position | 'ALL')}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Positions</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="team" className="block text-sm font-medium text-gray-700 mb-1">
            Team
          </label>
          <select
            id="team"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPlayers.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlayers.map(player => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {player.team?.city} {player.team?.name}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {players.length === 0
              ? 'No players loaded yet. Player data will be imported before the playoffs begin.'
              : 'No players match your filters.'}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredPlayers.length} of {players.length} players
      </div>
    </Layout>
  )
}
