import { useState, useMemo } from 'react'
import Layout from '../components/Layout'
import AnimatedScore from '../components/AnimatedScore'
import AnimatedLeaderboardRow from '../components/AnimatedLeaderboardRow'
import { useToast } from '../contexts/ToastContext'

interface Entry {
  id: string
  name: string
  score: number
}

export default function TestAnimations() {
  const { testMiniToast, testBigPlayToast } = useToast()

  // State for leaderboard demo
  const [entries, setEntries] = useState<Entry[]>([
    { id: '1', name: 'The Commish', score: 125.5 },
    { id: '2', name: 'Go Birds', score: 122.2 },
    { id: '3', name: 'Septic Squad', score: 118.8 },
    { id: '4', name: 'Purple Tears', score: 115.0 },
    { id: '5', name: 'Hailstorm', score: 110.5 },
  ])

  // State for simple score demos
  const [score1, setScore1] = useState(125.5)
  const [score2, setScore2] = useState(89.2)
  const [score3, setScore3] = useState(156.8)

  // Sort entries by score to get ranks
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.score - a.score)
  }, [entries])

  // Get rank for each entry
  const getRank = (id: string) => {
    return sortedEntries.findIndex(e => e.id === id) + 1
  }

  const addPointsToEntry = (id: string, amount: number) => {
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, score: e.score + amount } : e
    ))
  }

  const simulateRankChange = () => {
    // Pick a random entry that's not #1 and give them a big boost
    const notFirst = entries.filter(e => getRank(e.id) > 1)
    if (notFirst.length > 0) {
      const lucky = notFirst[Math.floor(Math.random() * notFirst.length)]
      addPointsToEntry(lucky.id, 15 + Math.random() * 10)
    }
  }

  const addPoints = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter(prev => prev + amount)
  }

  const simulateScoreUpdate = () => {
    // Random updates to all scores
    setScore1(prev => prev + Math.random() * 10)
    setScore2(prev => prev + Math.random() * 8)
    setScore3(prev => prev + Math.random() * 12)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Animation Test Page</h1>
        <p className="text-slate-400 mb-8">Test the score and rank animations before they go live</p>

        {/* Toast Notifications */}
        <div className="card-solid p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Toast Notifications</h2>
          <p className="text-slate-400 text-sm mb-4">
            Test the play update toasts that appear during games
          </p>
          <div className="flex gap-3">
            <button
              onClick={testMiniToast}
              className="flex-1 btn-secondary py-3"
            >
              Test Mini Toasts
            </button>
            <button
              onClick={testBigPlayToast}
              className="flex-1 btn-primary py-3"
            >
              Test Big Play Toasts
            </button>
          </div>
        </div>

        {/* Rank Change Animation */}
        <div className="card-solid p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Rank Change Animation</h2>
          <p className="text-slate-400 text-sm mb-4">
            Add points to an entry to make them jump up the leaderboard
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="min-w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Entry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Points</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedEntries.map((entry) => {
                  const rank = getRank(entry.id)
                  return (
                    <AnimatedLeaderboardRow
                      key={entry.id}
                      entryId={entry.id}
                      rank={rank}
                      className="hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <span className="text-field-400 font-bold">{rank}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{entry.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AnimatedScore
                          value={entry.score}
                          className="text-lg font-bold text-field-400 inline-block px-2 py-1 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => addPointsToEntry(entry.id, 6.5)}
                            className="px-2 py-1 text-xs bg-field-600 hover:bg-field-500 rounded text-white"
                          >
                            +TD
                          </button>
                          <button
                            onClick={() => addPointsToEntry(entry.id, 15)}
                            className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-white"
                          >
                            +15
                          </button>
                        </div>
                      </td>
                    </AnimatedLeaderboardRow>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <button
              onClick={simulateRankChange}
              className="w-full btn-primary py-3"
            >
              Simulate Random Rank Jump
            </button>
          </div>
        </div>

        {/* Entry Page Style (Total Points Box) */}
        <div className="card-solid p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Entry Page Total Points</h2>

          <div className="flex justify-center">
            <div className="bg-gradient-to-br from-field-500/20 to-field-600/10 border border-field-500/30 rounded-xl px-8 py-6 text-center shadow-lg shadow-field-500/10">
              <div className="text-xs font-medium text-field-300 uppercase tracking-wider mb-2">Total Points</div>
              <AnimatedScore
                value={score1}
                className="text-4xl font-bold text-white inline-block px-3 py-1 rounded"
              />
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => addPoints(setScore1, 6.5)}
              className="px-4 py-2 bg-field-600 hover:bg-field-500 rounded-lg text-white font-medium"
            >
              Add TD (+6.5)
            </button>
            <button
              onClick={() => addPoints(setScore1, 1)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium"
            >
              Add +1
            </button>
          </div>
        </div>

        {/* Score Comparison */}
        <div className="card-solid p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Multiple Scores</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Entry A</div>
              <AnimatedScore
                value={score1}
                className="text-2xl font-bold text-white inline-block px-2 py-1 rounded"
              />
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Entry B</div>
              <AnimatedScore
                value={score2}
                className="text-2xl font-bold text-white inline-block px-2 py-1 rounded"
              />
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Entry C</div>
              <AnimatedScore
                value={score3}
                className="text-2xl font-bold text-white inline-block px-2 py-1 rounded"
              />
            </div>
          </div>
        </div>

        {/* Bulk Update */}
        <div className="card-solid p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Simulate Live Update</h2>
          <p className="text-slate-400 text-sm mb-4">
            Click to simulate multiple scores updating at once (like during a game)
          </p>
          <button
            onClick={simulateScoreUpdate}
            className="w-full btn-primary py-3"
          >
            Simulate Score Updates
          </button>
        </div>

        {/* Reset */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setScore1(125.5)
              setScore2(89.2)
              setScore3(156.8)
              setEntries([
                { id: '1', name: 'The Commish', score: 125.5 },
                { id: '2', name: 'Go Birds', score: 122.2 },
                { id: '3', name: 'Septic Squad', score: 118.8 },
                { id: '4', name: 'Purple Tears', score: 115.0 },
                { id: '5', name: 'Hailstorm', score: 110.5 },
              ])
            }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Reset all scores
          </button>
        </div>
      </div>
    </Layout>
  )
}
