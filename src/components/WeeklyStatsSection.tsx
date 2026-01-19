import { useState } from 'react'
import ValuePlayersTable from './ValuePlayersTable'
import PerfectLineupTable from './PerfectLineupTable'
import ChalkPicksTable from './ChalkPicksTable'
import BoldPicksTable from './BoldPicksTable'
import BoldestLineups from './BoldestLineups'
import DeadManWalking from './DeadManWalking'

export default function WeeklyStatsSection() {
  const [selectedWeek, setSelectedWeek] = useState(2) // Default to Week 2

  return (
    <div className="space-y-6">
      {/* Week Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Weekly Stats</h2>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setSelectedWeek(1)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              selectedWeek === 1
                ? 'bg-field-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Week 1
          </button>
          <button
            onClick={() => setSelectedWeek(2)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              selectedWeek === 2
                ? 'bg-field-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Week 2
          </button>
        </div>
      </div>

      {/* Players of the Week (MVPs/LVPs) */}
      <ValuePlayersTable weekId={selectedWeek} />

      {/* Perfect Lineup vs Sleepers */}
      <PerfectLineupTable weekId={selectedWeek} />

      {/* Chalk Picks of the Week */}
      <ChalkPicksTable weekId={selectedWeek} />

      {/* Bold Picks of the Week */}
      <BoldPicksTable weekId={selectedWeek} />

      {/* Boldest Lineups + Dead Man Walking - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BoldestLineups weekId={selectedWeek} />
        <DeadManWalking weekId={selectedWeek} />
      </div>
    </div>
  )
}
