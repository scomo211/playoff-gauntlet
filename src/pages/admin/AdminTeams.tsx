import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import AdminPlayoffBracket from '../../components/AdminPlayoffBracket'
import { useAdminTeams } from '../../hooks/useAdmin'
import { Team } from '../../types/database'

export default function AdminTeams() {
  const { teams, loading, eliminateTeam, reinstateTeam } = useAdminTeams()
  const [selectedWeek, setSelectedWeek] = useState(1)

  const handleSelectWinner = async (_winner: Team, loser: Team, round: string) => {
    // Determine the week based on the round
    let week = selectedWeek
    if (round === 'wildcard') week = 1
    else if (round === 'divisional') week = 2
    else if (round === 'championship') week = 3
    else if (round === 'superbowl') week = 4

    await eliminateTeam(loser.id, week)
  }

  const handleReinstate = async (team: Team) => {
    await reinstateTeam(team.id)
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="mt-1 text-gray-600">Select winners in each matchup to eliminate teams</p>
      </div>

      {/* Week Selector for manual overrides */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Playoff Week
        </label>
        <div className="flex gap-2">
          {[
            { week: 1, label: 'Wild Card' },
            { week: 2, label: 'Divisional' },
            { week: 3, label: 'Championship' },
            { week: 4, label: 'Super Bowl' },
          ].map(({ week, label }) => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedWeek === week
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Teams eliminated from the bracket will be recorded for the appropriate week
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <AdminPlayoffBracket
          onSelectWinner={handleSelectWinner}
          onReinstate={handleReinstate}
        />
      )}

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {teams.filter(t => t.is_alive).length}
          </div>
          <div className="text-sm text-gray-500">Teams Remaining</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {teams.filter(t => !t.is_alive).length}
          </div>
          <div className="text-sm text-gray-500">Teams Eliminated</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-500">
            {teams.filter(t => t.conference === 'AFC' && t.is_alive).length}
          </div>
          <div className="text-sm text-gray-500">AFC Remaining</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">
            {teams.filter(t => t.conference === 'NFC' && t.is_alive).length}
          </div>
          <div className="text-sm text-gray-500">NFC Remaining</div>
        </div>
      </div>

      {/* Eliminated Teams List */}
      {teams.some(t => !t.is_alive) && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Eliminated Teams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams
              .filter(t => !t.is_alive)
              .sort((a, b) => (a.eliminated_week || 0) - (b.eliminated_week || 0))
              .map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team.id.toLowerCase()}.png`}
                      alt={team.name}
                      className="w-8 h-8 object-contain grayscale opacity-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-500 line-through">
                        {team.city} {team.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Eliminated Week {team.eliminated_week}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => reinstateTeam(team.id)}
                    className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition"
                  >
                    Reinstate
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
