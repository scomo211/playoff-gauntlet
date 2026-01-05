import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { useAdminTeams } from '../../hooks/useAdmin'

export default function AdminTeams() {
  const { teams, loading, eliminateTeam, reinstateTeam } = useAdminTeams()
  const [selectedWeek, setSelectedWeek] = useState(1)

  const afcTeams = teams.filter(t => t.conference === 'AFC')
  const nfcTeams = teams.filter(t => t.conference === 'NFC')

  const handleEliminate = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId)
    if (!confirm(`Eliminate ${team?.city} ${team?.name}?`)) return
    await eliminateTeam(teamId, selectedWeek)
  }

  const handleReinstate = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId)
    if (!confirm(`Reinstate ${team?.city} ${team?.name}?`)) return
    await reinstateTeam(teamId)
  }

  const TeamCard = ({ team }: { team: typeof teams[0] }) => (
    <div
      className={`p-4 rounded-lg border-2 transition ${
        team.is_alive
          ? 'bg-white border-green-200'
          : 'bg-gray-100 border-gray-200 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">
            {team.city} {team.name}
          </div>
          <div className="text-sm text-gray-500">{team.id}</div>
        </div>
        <div>
          {team.is_alive ? (
            <button
              onClick={() => handleEliminate(team.id)}
              className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              Eliminate
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Out Week {team.eliminated_week}
              </span>
              <button
                onClick={() => handleReinstate(team.id)}
                className="px-3 py-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition"
              >
                Reinstate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="mt-1 text-gray-600">Manage playoff team elimination status</p>
      </div>

      {/* Week Selector */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Elimination Week
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedWeek === week
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Week {week}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Select which week to record when eliminating a team
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* AFC */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">AFC</h2>
              <span className="text-sm text-gray-500">
                {afcTeams.filter(t => t.is_alive).length} alive
              </span>
            </div>
            <div className="space-y-3">
              {afcTeams.map(team => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </div>

          {/* NFC */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">NFC</h2>
              <span className="text-sm text-gray-500">
                {nfcTeams.filter(t => t.is_alive).length} alive
              </span>
            </div>
            <div className="space-y-3">
              {nfcTeams.map(team => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">Team Elimination</p>
            <p className="mt-1">
              When a team is eliminated, their players will no longer be available for selection in future weeks.
              Players already in submitted lineups will still score points.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
