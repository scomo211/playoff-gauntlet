import { useState } from 'react'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import TeamCard from '../../components/salarycap/TeamCard'
import { useSalaryCapSettings, useSalaryCapAllTeams } from '../../hooks/useSalaryCap'

type SortOption = 'name' | 'capSpace' | 'salary' | 'players'

export default function SalaryCapTeams() {
  const { settings } = useSalaryCapSettings()
  const { teams, loading } = useSalaryCapAllTeams()
  const [sortBy, setSortBy] = useState<SortOption>('name')

  const sortedTeams = [...teams].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.owner.owner_name.localeCompare(b.owner.owner_name)
      case 'capSpace':
        return b.capSpace - a.capSpace
      case 'salary':
        return b.totalSalary - a.totalSalary
      case 'players':
        return b.playerCount - a.playerCount
      default:
        return 0
    }
  })

  return (
    <SalaryCapLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">All Teams</h1>
            <p className="text-slate-400 mt-1">{teams.length} teams in the league</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="name">Name</option>
              <option value="capSpace">Cap Space</option>
              <option value="salary">Total Salary</option>
              <option value="players">Player Count</option>
            </select>
          </div>
        </div>

        {/* Teams Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-slate-700 rounded w-1/2 mb-3" />
                <div className="h-2 bg-slate-700 rounded mb-3" />
                <div className="h-4 bg-slate-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No teams found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTeams.map((team) => (
              <TeamCard
                key={team.owner.id}
                team={team}
                salaryCap={settings?.salary_cap || 400}
              />
            ))}
          </div>
        )}
      </div>
    </SalaryCapLayout>
  )
}
