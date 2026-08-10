import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import CapMeter from '../../components/salarycap/CapMeter'
import RosterTable from '../../components/salarycap/RosterTable'
import { useSalaryCapSettings, useSalaryCapMyTeam } from '../../hooks/useSalaryCap'

export default function SalaryCapMyTeam() {
  const { settings } = useSalaryCapSettings()
  const { owner, contracts, deadCap, totalSalary, totalDeadCap, loading, error } = useSalaryCapMyTeam()

  if (loading) {
    return (
      <SalaryCapLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-1/3" />
          <div className="h-24 bg-slate-800 rounded" />
          <div className="h-64 bg-slate-800 rounded" />
        </div>
      </SalaryCapLayout>
    )
  }

  if (!owner) {
    return (
      <SalaryCapLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">No Team Found</h2>
          <p className="text-slate-400 mb-4">
            Your account is not linked to a Salary Cap League team.
          </p>
          <p className="text-slate-500 text-sm">
            Contact the commissioner to get your account linked.
          </p>
        </div>
      </SalaryCapLayout>
    )
  }

  return (
    <SalaryCapLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{owner.owner_name}</h1>
            {owner.team_name && (
              <p className="text-slate-400">{owner.team_name}</p>
            )}
          </div>
          <div className="text-sm text-slate-400">
            {settings?.current_season} Season
          </div>
        </div>

        {/* Cap Overview */}
        {settings && (
          <CapMeter
            totalSalary={totalSalary}
            salaryCap={settings.salary_cap}
            deadCap={totalDeadCap}
            variant="full"
          />
        )}

        {/* Dead Cap Section (if any) */}
        {deadCap.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Dead Cap</h3>
            <div className="space-y-2">
              {deadCap.map((dc) => (
                <div key={dc.id} className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">{dc.player_name}</span>
                  <div className="text-right">
                    <span className="text-red-400">${dc.amount}/yr</span>
                    <span className="text-slate-500 ml-2">({dc.years_remaining} yrs)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roster */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="font-medium text-white">Roster ({contracts.length} players)</h3>
          </div>
          <RosterTable contracts={contracts} />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}
      </div>
    </SalaryCapLayout>
  )
}
