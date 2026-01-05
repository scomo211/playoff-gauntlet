import { Link } from 'react-router-dom'

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
              <svg className="w-8 h-8 text-field-400" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="16" rx="14" ry="9" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
                <path d="M16 9v14" stroke="#0d1117" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M13 11l3 2 3-2M13 15l3 2 3-2M13 19l3 2 3-2" stroke="#0d1117" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
              <span className="text-sm font-medium text-field-400">2025 NFL Playoffs</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight">
              Playoff
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-field-400 to-field-600">
                Gauntlet
              </span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 leading-relaxed">
              The ultimate playoff fantasy challenge. Use each NFL player only once across all 4 weeks. Strategy meets skill.
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
              <Link
                to="/rules"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl text-white border border-slate-700 hover:bg-slate-800 transition-all"
              >
                View Rules
              </Link>
            </div>
          </div>
        </div>
      </div>

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
