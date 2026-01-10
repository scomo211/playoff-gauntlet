import { useState } from 'react'
import Layout from '../components/Layout'
import AnimatedScore from '../components/AnimatedScore'

export default function TestAnimations() {
  const [score1, setScore1] = useState(125.5)
  const [score2, setScore2] = useState(89.2)
  const [score3, setScore3] = useState(156.8)

  const randomChange = (current: number) => {
    const change = (Math.random() - 0.3) * 20 // Bias towards increases
    return Math.max(0, current + change)
  }

  const simulateScoreUpdate = () => {
    setScore1(prev => randomChange(prev))
    setScore2(prev => randomChange(prev))
    setScore3(prev => randomChange(prev))
  }

  const addPoints = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter(prev => prev + amount)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Animation Test Page</h1>
        <p className="text-slate-400 mb-8">Test the score animations before they go live</p>

        {/* Leaderboard Style */}
        <div className="card-solid p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Leaderboard Style</h2>

          <div className="space-y-3">
            {[
              { rank: 1, name: 'The Commish', score: score1, setScore: setScore1 },
              { rank: 2, name: 'Go Birds', score: score2, setScore: setScore2 },
              { rank: 3, name: 'Septic Squad', score: score3, setScore: setScore3 },
            ].map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between py-3 px-4 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span className="text-field-400 font-bold w-6">{entry.rank}</span>
                  <span className="text-white font-medium">{entry.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => addPoints(entry.setScore, 6.5)}
                    className="px-2 py-1 text-xs bg-field-600 hover:bg-field-500 rounded text-white"
                  >
                    +TD
                  </button>
                  <button
                    onClick={() => addPoints(entry.setScore, 0.1)}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white"
                  >
                    +0.1
                  </button>
                  <AnimatedScore
                    value={entry.score}
                    className="text-lg font-bold text-field-400 min-w-[80px] text-right inline-block px-2 py-1 rounded"
                  />
                </div>
              </div>
            ))}
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
