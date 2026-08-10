import { useState } from 'react'
import ValuePlayersTable from './ValuePlayersTable'
import PerfectLineupTable from './PerfectLineupTable'
import ChalkPicksTable from './ChalkPicksTable'
import BoldPicksTable from './BoldPicksTable'
import BoldestLineups from './BoldestLineups'
import DeadManWalking from './DeadManWalking'

export default function WeeklyStatsSection() {
  const [selectedWeek, setSelectedWeek] = useState(4) // Default to Week 4 (Super Bowl)

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
            Wk 1
          </button>
          <button
            onClick={() => setSelectedWeek(2)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              selectedWeek === 2
                ? 'bg-field-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wk 2
          </button>
          <button
            onClick={() => setSelectedWeek(3)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              selectedWeek === 3
                ? 'bg-field-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wk 3
          </button>
          <button
            onClick={() => setSelectedWeek(4)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              selectedWeek === 4
                ? 'bg-field-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wk 4
          </button>
        </div>
      </div>

      {/* Chalk Picks of the Week */}
      <ChalkPicksTable weekId={selectedWeek} />

      {/* Bold Picks of the Week */}
      <BoldPicksTable weekId={selectedWeek} />

      {/* Boldest Lineups + Dead Man Walking - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BoldestLineups weekId={selectedWeek} />
        <DeadManWalking weekId={selectedWeek} />
      </div>

      {/* Players of the Week (MVPs/LVPs) */}
      <ValuePlayersTable weekId={selectedWeek} />

      {/* Perfect Lineup vs Sleepers */}
      <PerfectLineupTable weekId={selectedWeek} />
    </div>
  )
}
