import { Link } from 'react-router-dom'
import { TeamCapSummary } from '../../types/salarycap'
import CapMeter from './CapMeter'

interface TeamCardProps {
  team: TeamCapSummary
  salaryCap: number
}

export default function TeamCard({ team, salaryCap }: TeamCardProps) {
  const { owner, totalSalary, totalDeadCap, capSpace, playerCount } = team

  return (
    <Link
      to={`/salarycap/team/${owner.id}`}
      className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800 hover:border-slate-600 transition"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-white">{owner.owner_name}</h3>
          {owner.team_name && (
            <p className="text-sm text-slate-500">{owner.team_name}</p>
          )}
        </div>
        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
          {playerCount} players
        </span>
      </div>

      <CapMeter
        totalSalary={totalSalary}
        salaryCap={salaryCap}
        deadCap={totalDeadCap}
        variant="compact"
      />

      <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-sm">
        <span className="text-slate-500">Cap Space</span>
        <span className={`font-medium ${capSpace >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          ${capSpace.toFixed(0)}
        </span>
      </div>
    </Link>
  )
}
