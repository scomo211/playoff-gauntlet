import { Link } from 'react-router-dom'
import CountdownTimer from '../components/CountdownTimer'

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-field-950 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-field-900/20 via-transparent to-transparent" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Nav */}
          <nav className="flex items-center justify-between py-6">
            <div className="flex items-center gap-2.5">
              <img src="/favicon.png" alt="Playoff Gauntlet" className="w-8 h-8" />
              <span className="text-lg font-bold text-white tracking-tight">Playoff Gauntlet</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="btn-primary"
              >
                Get Started
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="pt-20 pb-32 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-field-500/10 border border-field-500/20 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-field-400 animate-pulse" />
              <span className="text-sm font-medium text-field-400">2026 NFL Playoffs</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight">
              Playoff
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-field-400 to-field-600">
                Gauntlet
              </span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 leading-relaxed">
              Didn't make the fantasy playoffs? Perfect. Welcome to the Gauntlet.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white bg-field-600 hover:bg-field-500 transition-all shadow-lg shadow-field-500/25"
              >
                Enter the Gauntlet
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#rules"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white border border-slate-700 hover:bg-slate-800 transition-all"
              >
                View Rules
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      <CountdownTimer variant="landing" />

      {/* Stats Section */}
      <div className="border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white">4</div>
              <div className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-wider">Weeks</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-field-400">1x</div>
              <div className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-wider">Use Each Player</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gold-400">$25</div>
              <div className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-wider">Per Entry</div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-sm font-semibold text-field-400 uppercase tracking-wider">How It Works</h2>
          <p className="mt-2 text-3xl font-bold text-white">Simple rules. Deep strategy.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="card p-6 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-field-500/10 border border-field-500/20 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-field-400">1</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Draft Your Lineup</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Pick players from playoff teams each week. Fill QB, RB, WR, TE, K, and DEF slots.
            </p>
          </div>

          <div className="card p-6 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-gold-400">2</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Players Lock After Use</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Once you start a player, they're locked for the rest of the playoffs. Choose wisely.
            </p>
          </div>

          <div className="card p-6 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-slate-400">3</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Highest Score Wins</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Accumulate points across all 4 weeks. Top scorers after the Super Bowl take the prize.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div id="rules" className="border-t border-slate-800 bg-slate-900/30 scroll-mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-sm font-semibold text-field-400 uppercase tracking-wider">Rules & Scoring</h2>
            <p className="mt-2 text-3xl font-bold text-white">Everything you need to know</p>
          </div>

          {/* Overview */}
          <section className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4">Overview</h3>
            <div className="card-solid p-6">
              <p className="text-slate-300 mb-4">
                Playoff Gauntlet is a playoff fantasy football game where <strong className="text-white">each NFL player can only be used once</strong> across all 4 playoff weeks. The winner is whoever accumulates the most points by the end of the Super Bowl.
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li><strong className="text-white">Player Pool:</strong> All NFL players from teams still alive in the playoffs</li>
                <li><strong className="text-white">Key Mechanic:</strong> Once you use a player in your lineup, they're locked and cannot be used again</li>
                <li><strong className="text-white">Strategy:</strong> Balance scoring now vs. saving players for later rounds</li>
                <li><strong className="text-white">Entry Fee:</strong> $25 per entry (unlimited entries allowed)</li>
              </ul>
            </div>
          </section>

          {/* Roster Requirements */}
          <section className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4">Roster Requirements</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Weeks 1-3</h4>
                <p className="text-sm text-slate-500 mb-3">Wild Card, Divisional, Conference Championships</p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">QB</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">RB</td>
                      <td className="py-2 text-right font-medium text-slate-300">3</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">WR</td>
                      <td className="py-2 text-right font-medium text-slate-300">4</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">TE</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">K</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">DEF</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold text-white">Total</td>
                      <td className="py-2 text-right font-bold text-field-400">15</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Week 4</h4>
                <p className="text-sm text-slate-500 mb-3">Super Bowl</p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">QB</td>
                      <td className="py-2 text-right font-medium text-slate-300">1</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">RB</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">WR</td>
                      <td className="py-2 text-right font-medium text-slate-300">2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">TE</td>
                      <td className="py-2 text-right font-medium text-slate-300">1</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">K</td>
                      <td className="py-2 text-right font-medium text-slate-300">1</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">DEF</td>
                      <td className="py-2 text-right font-medium text-slate-300">1</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold text-white">Total</td>
                      <td className="py-2 text-right font-bold text-field-400">8</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Scoring */}
          <section className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4">Scoring System</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Passing */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Passing</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Passing Yards</td>
                      <td className="py-2 text-right font-medium text-slate-300">0.04/yard</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Passing TD</td>
                      <td className="py-2 text-right font-medium text-field-400">+6</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Interception</td>
                      <td className="py-2 text-right font-medium text-red-400">-2</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">2PT Conversion</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rushing */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Rushing</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Rushing Yards</td>
                      <td className="py-2 text-right font-medium text-slate-300">0.1/yard</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Rushing TD</td>
                      <td className="py-2 text-right font-medium text-field-400">+6</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">2PT Conversion</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Receiving */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Receiving (PPR)</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Reception</td>
                      <td className="py-2 text-right font-medium text-field-400">+0.5</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Receiving Yards</td>
                      <td className="py-2 text-right font-medium text-slate-300">0.1/yard</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Receiving TD</td>
                      <td className="py-2 text-right font-medium text-field-400">+6</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">2PT Conversion</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Kicking */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Kicking</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Field Goal</td>
                      <td className="py-2 text-right font-medium text-slate-300">0.1/yard</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Extra Point Made</td>
                      <td className="py-2 text-right font-medium text-field-400">+1</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">Extra Point Missed</td>
                      <td className="py-2 text-right font-medium text-red-400">-1</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Defense */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Team Defense</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Fumble Recovery</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Interception</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">Sack</td>
                      <td className="py-2 text-right font-medium text-field-400">+1</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">Safety</td>
                      <td className="py-2 text-right font-medium text-field-400">+2</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Points Allowed */}
              <div className="card-solid p-6">
                <h4 className="font-semibold text-white mb-3">Points Allowed (DEF)</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">0-6 pts</td>
                      <td className="py-2 text-right font-medium text-field-400">+10</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">7-13 pts</td>
                      <td className="py-2 text-right font-medium text-field-400">+7</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">14-20 pts</td>
                      <td className="py-2 text-right font-medium text-field-400">+4</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">21-27 pts</td>
                      <td className="py-2 text-right font-medium text-field-400">+1</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-400">28-34 pts</td>
                      <td className="py-2 text-right font-medium text-slate-400">0</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-400">35+ pts</td>
                      <td className="py-2 text-right font-medium text-red-400">-1 to -3</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Misc scoring */}
            <div className="mt-6 card-solid p-6">
              <h4 className="font-semibold text-white mb-3">Miscellaneous</h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Fumble Lost</span>
                  <span className="font-medium text-red-400">-2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Punt Return TD</span>
                  <span className="font-medium text-field-400">+6</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kick Return TD</span>
                  <span className="font-medium text-field-400">+6</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payouts */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-4">Payouts</h3>
            <div className="card-solid p-6">
              <p className="text-slate-300 mb-4">
                Payout spots scale based on total entries:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-500">1-49 entries</div>
                  <div className="font-semibold text-white">Top 4</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-500">50-59 entries</div>
                  <div className="font-semibold text-white">Top 5</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-500">60-69 entries</div>
                  <div className="font-semibold text-white">Top 6</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-500">100+ entries</div>
                  <div className="font-semibold text-white">Top 10</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                <strong className="text-slate-300">Tiebreaker:</strong> Most points scored during Super Bowl week. If still tied, co-champions split the position.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to compete?</h2>
          <p className="text-slate-400 mb-8">Create your entry and prove your playoff instincts.</p>
          <Link
            to="/signup"
            className="btn-primary px-8 py-3 text-base"
          >
            Get Started Now
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-slate-600">
            Playoff Gauntlet &middot; Not affiliated with the NFL
          </p>
        </div>
      </footer>
    </div>
  )
}
