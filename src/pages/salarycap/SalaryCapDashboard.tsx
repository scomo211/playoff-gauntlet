import { Link } from 'react-router-dom'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { useSalaryCapSettings, useSalaryCapAllTeams } from '../../hooks/useSalaryCap'
import { CapLedgerBar, CapLedgerLegend, Ticker } from '../../components/ui'
import { BASE_CAP, ROSTER_MAX, money } from '../../lib/cap'
import type { CapSummary } from '../../lib/salarycap-types'

// 2025 Final Standings order
const STANDINGS_ORDER = [
  'Tim Meyers',
  'Scott Moran',
  'Johnny Goodwin',
  'Brent Alexander',
  'Zach Moore',
  'Ryan Hossick',
  'Tyler Bulger',
  'Nick Meyer',
  'Josh Sacks',
  'Nick Scott',
  'Brad Wandell',
  'Corey Whitehead & Rob Green',
]

// Offseason deadline - Sunday, August 16, 2026 at 8:00 PM ET
const ROSTER_LOCK_DEADLINE = new Date('2026-08-16T20:00:00-04:00')
// Progress bar window starts Sunday, August 9, 2026 at 8:00 AM ET (7.5 days total)
const COUNTDOWN_START = new Date('2026-08-09T08:00:00-04:00')

export default function SalaryCapDashboard() {
  const { settings, loading: settingsLoading } = useSalaryCapSettings()
  const { teams, loading: teamsLoading } = useSalaryCapAllTeams()

  const loading = settingsLoading || teamsLoading
  const salaryCap = settings?.salary_cap || BASE_CAP

  // Sort teams by 2025 final standings
  const sortedTeams = [...teams].sort((a, b) => {
    const aIndex = STANDINGS_ORDER.indexOf(a.owner.owner_name)
    const bIndex = STANDINGS_ORDER.indexOf(b.owner.owner_name)
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
  })

  // Transform team data to CapSummary for the ledger bar
  const teamToCapSummary = (team: typeof teams[0]): CapSummary => ({
    baseCap: salaryCap,
    bonusCap: team.totalBonusCap || 0,
    salaries: team.totalSalary,
    deadCap: team.totalDeadCap,
    available: team.capSpace,
  })

  return (
    <SalaryCapLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display font-semibold text-fg">
              Salary Cap League
            </h1>
            <p className="mt-1 font-data text-[13px] text-fg-muted">
              {settings?.current_season} Season · {money(salaryCap)} cap
            </p>
          </div>
          <CapLedgerLegend />
        </div>

        {/* Roster Lock Deadline Ticker - hide once deadline passes */}
        {Date.now() < ROSTER_LOCK_DEADLINE.getTime() && (
          <Ticker
            label="Roster lock deadline"
            target={ROSTER_LOCK_DEADLINE}
            when="Sun, Aug 16, 2026 · 8:00 PM ET"
            windowMs={ROSTER_LOCK_DEADLINE.getTime() - COUNTDOWN_START.getTime()}
          />
        )}

        {/* Teams List */}
        <div className="rounded-panel border border-hairline bg-surface-panel overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[32px_180px_1fr_72px_80px] items-center gap-3 px-4 py-2.5 border-b border-hairline max-[640px]:hidden">
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">#</div>
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">Owner</div>
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">Cap</div>
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle text-right">Available</div>
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle text-right">Roster</div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-6 h-6 bg-surface-well rounded" />
                  <div className="h-5 bg-surface-well rounded w-32" />
                  <div className="flex-1 h-4 bg-surface-well rounded" />
                </div>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-fg-subtle">
              <p>No teams found. Import data to get started.</p>
            </div>
          ) : (
            <div>
              {sortedTeams.map((team, index) => {
                const capSummary = teamToCapSummary(team)
                const lockedInPlayers = team.contracts.filter(c => c.contract_status === 'active').length
                const isOverCap = capSummary.available < 0
                const isTightCap = capSummary.available < 50 && capSummary.available >= 0

                return (
                  <Link
                    key={team.owner.id}
                    to={`/salarycap/team/${team.owner.id}`}
                    className="grid grid-cols-[32px_180px_1fr_72px_80px] items-center gap-3 px-4 py-3
                      border-b border-hairline last:border-none hover:bg-surface-well/50 transition
                      max-[640px]:grid-cols-[32px_1fr] max-[640px]:gap-2"
                  >
                    {/* Rank */}
                    <div className="font-data text-[14px] tabular-nums text-fg-subtle">
                      {index + 1}
                    </div>

                    {/* Owner Name */}
                    <div className="font-semibold text-fg truncate">
                      {team.owner.owner_name}
                    </div>

                    {/* Cap Ledger Bar */}
                    <div className="max-[640px]:col-span-full max-[640px]:col-start-2 max-[640px]:mt-1">
                      <CapLedgerBar cap={capSummary} height={13} />
                    </div>

                    {/* Available Cap */}
                    <div className={`text-right font-data text-[15px] font-bold tabular-nums
                      ${isOverCap ? 'text-flag' : isTightCap ? 'text-amber' : 'text-field-500'}
                      max-[640px]:col-start-2 max-[640px]:text-left max-[640px]:text-[13px]`}
                    >
                      {money(capSummary.available)}
                    </div>

                    {/* Roster Count */}
                    <div className="text-right font-data text-[14px] tabular-nums max-[640px]:hidden">
                      <span className="text-fg">{lockedInPlayers}</span>
                      <span className="text-fg-subtle">/{ROSTER_MAX}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 2026 Franchise Tag Costs */}
        <div className="rounded-card border border-hairline bg-surface-panel p-5">
          <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle mb-4">
            2026 Franchise Tag Cost by Position
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { pos: 'QB', cost: 40 },
              { pos: 'RB', cost: 99 },
              { pos: 'WR', cost: 74 },
              { pos: 'TE', cost: 22 },
            ].map(({ pos, cost }) => (
              <div key={pos}>
                <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                  {pos}
                </div>
                <div className="font-data text-[20px] font-bold tabular-nums text-gold-500 mt-1">
                  {money(cost)}
                </div>
              </div>
            ))}
          </div>
          <p className="font-data text-[10.5px] text-fg-subtle mt-4 text-center">
            Tag cost = MAX(position avg, player's previous salary)
          </p>
        </div>
      </div>
    </SalaryCapLayout>
  )
}
