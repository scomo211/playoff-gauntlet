import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <h1 className="text-5xl font-extrabold text-white tracking-tight sm:text-6xl lg:text-7xl">
            Playoff <span className="text-blue-400">Gauntlet</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-blue-100">
            The ultimate playoff fantasy football challenge. Use each NFL player only once across all 4 playoff weeks. Strategy matters.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-blue-900 bg-white hover:bg-blue-50 transition shadow-lg"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-lg font-semibold rounded-xl text-white hover:bg-white/10 transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="pb-20">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">4</div>
              <div className="mt-2 text-blue-200">Playoff Weeks</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">1x</div>
              <div className="mt-2 text-blue-200">Use Each Player Once</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">$25</div>
              <div className="mt-2 text-blue-200">Per Entry</div>
            </div>
          </div>

          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">How It Works</h2>
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">1</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Pick Your Lineup</h3>
                  <p className="text-blue-200">Select players from teams still in the playoffs. Fill all position slots each week.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">2</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Players Lock After Use</h3>
                  <p className="text-blue-200">Once you start a player, they're locked for the rest of the playoffs. Choose wisely!</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Accumulate Points</h3>
                  <p className="text-blue-200">Your score carries over each week. Highest total after the Super Bowl wins!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
