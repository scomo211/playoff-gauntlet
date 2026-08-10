import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { useSalaryCapSettings } from '../../hooks/useSalaryCap'

export default function SalaryCapRules() {
  const { settings } = useSalaryCapSettings()

  return (
    <SalaryCapLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">League Rules</h1>
          <p className="text-slate-400 mt-1">Bobby 3-Stix Memorial Salary Cap League</p>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          {/* League Setup */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">League Setup</h2>
            <ul className="space-y-2 text-slate-300">
              <li>12 team league</li>
              <li>${settings?.salary_cap || 400} salary cap (soft cap)</li>
              <li>{settings?.roster_size || 24} roster spots</li>
              <li>9 starters: 1 QB, 2 RB, 3 WR, 1 TE, 2 Flex (WR/RB/TE)</li>
              <li>0.5 PPR scoring, 6 points for Pass TD</li>
              <li>$100 annual dues</li>
            </ul>
          </section>

          {/* Salary Cap */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Salary Cap</h2>
            <p className="text-slate-300 mb-4">
              The salary cap is a "soft cap" — it only matters before the regular season starts.
              Once the season begins, you can go over the cap through trades, waivers, or free agency.
              However, you must get back under the cap before the following season's draft.
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm font-mono text-slate-400">
              Available Cap = (${settings?.salary_cap || 400} + Bonus Cap) - (Rostered Salaries + Dead Cap)
            </div>
          </section>

          {/* Contracts */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Player Contracts</h2>
            <ul className="space-y-2 text-slate-300">
              <li>After the draft, assign contracts to all newly acquired players</li>
              <li>Standard contracts: <strong>1, 2, or 3 years</strong> at the auction price</li>
              <li>Rookies: up to <strong>5 years</strong></li>
              <li>Contract price stays the same for the entire duration</li>
              <li>When a contract expires, the player returns to the auction pool</li>
            </ul>
          </section>

          {/* Dead Cap */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Dead Cap</h2>
            <p className="text-slate-300 mb-4">
              If you cut a player before their contract expires, you incur dead cap:
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm font-mono text-slate-400 mb-4">
              Dead Cap = {settings?.dead_cap_percent || 40}% of salary × years remaining
            </div>
            <p className="text-slate-400 text-sm">
              Example: Cut a player with $100 salary and 2 years remaining = $40/year × 2 years = $80 total dead cap
            </p>
          </section>

          {/* Franchise Tag */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Franchise Tag</h2>
            <p className="text-slate-300 mb-4">
              Each team can franchise tag one player on an expiring contract. The cap hit is:
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm font-mono text-slate-400">
              Tag Cost = MAX(average of top 5 at position, player's previous salary)
            </div>
          </section>

          {/* Free Agent Extensions */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Free Agent Extensions</h2>
            <p className="text-slate-300 mb-4">
              Players picked up via FAAB or free agency can be extended with a 1-year deal at:
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm font-mono text-slate-400 mb-4">
              Extension Cost = MAX(${settings?.fa_extension_base || 5}, {settings?.fa_extension_percent || 25}% of previous salary)
            </div>
            <p className="text-slate-400 text-sm">
              The {settings?.fa_extension_percent || 25}% rule applies to players who were previously under contract (the "Michael Thomas rule").
            </p>
          </section>

          {/* Key Dates */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Key Dates</h2>
            <ul className="space-y-2 text-slate-300">
              <li><strong>July 1st</strong> — Roster Cuts deadline (must be under cap)</li>
              <li><strong>August</strong> — The Draft (live, in-person auction)</li>
              <li><strong>Pre-Season</strong> — Player Contract deadline</li>
              <li><strong>Week 13</strong> — Trade deadline</li>
              <li><strong>Week 15-17</strong> — Playoffs (top 6 teams)</li>
            </ul>
          </section>

          {/* Payouts */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Payouts</h2>
            <ul className="space-y-2 text-slate-300">
              <li>Regular Season Winner: $300</li>
              <li>Playoff Winner: $700</li>
              <li>Playoff Runner-Up: $100</li>
              <li>Dynasty Pot: $100/year (win back-to-back or 2 of 3 to claim)</li>
            </ul>
          </section>
        </div>
      </div>
    </SalaryCapLayout>
  )
}
