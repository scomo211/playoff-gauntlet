import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { CapLedgerBar, PlayerAvatar, RookieBadge } from '../../components/ui'
import {
  useSalaryCapTeam,
  useBonusCap,
  useIsSalaryCapOwner,
  useSalaryCapSettings,
} from '../../hooks/useSalaryCap'
import { ROSTER_MAX, BASE_CAP, money } from '../../lib/cap'

// Draft date: Sunday, August 23rd, 2026 at 8:00 PM ET
const DRAFT_DATE = new Date('2026-08-23T20:00:00-04:00')

// 2026 Franchise tag costs by position
const TAG_COST_BY_POSITION: Record<string, number> = {
  QB: 40,
  RB: 99,
  WR: 74,
  TE: 22,
}

// Calculate franchise tag cost: MAX(position average, player's previous salary)
function getTagCost(position: string, previousSalary: number): number {
  const positionAvg = TAG_COST_BY_POSITION[position] || 0
  return Math.max(positionAvg, previousSalary)
}

// Position labels for grouping
const POSITIONS = [
  { key: 'QB', label: 'Quarterbacks' },
  { key: 'RB', label: 'Running Backs' },
  { key: 'WR', label: 'Wide Receivers' },
  { key: 'TE', label: 'Tight Ends' },
]


// Contract dots
function Dots({ years, isTag = false }: { years: number; isTag?: boolean }) {
  return (
    <div className="flex gap-[9px]">
      {[0, 1, 2, 3, 4].map(i => (
        <i
          key={i}
          className={`block w-[11px] h-[11px] rounded-full border ${
            i < years
              ? isTag
                ? 'bg-gold-500 border-gold-500'
                : 'bg-field-500 border-field-500'
              : 'bg-[#242c37] border-[#2c3542]'
          }`}
        />
      ))}
    </div>
  )
}

// Franchise tag badge
function TagBadge() {
  return (
    <span className="inline-block font-data text-[9px] font-bold text-gold-500 bg-gold-500/15 px-[5px] py-[1px] rounded-[4px] ml-[6px]">
      TAG
    </span>
  )
}


// Empty roster slot placeholder
function EmptySlot() {
  return (
    <div className="grid grid-cols-[42px_1fr_112px_54px] gap-[13px] items-center py-[12px] border-b border-hairline last:border-none max-[700px]:grid-cols-[38px_1fr] max-[700px]:gap-[11px]">
      <div className="w-[42px] h-[42px] rounded-[11px] bg-surface-well border border-dashed border-hairline-strong flex items-center justify-center max-[700px]:w-[38px] max-[700px]:h-[38px]">
        <span className="text-fg-subtle text-[18px]">?</span>
      </div>
      <div>
        <div className="text-[14px] font-semibold text-fg-subtle italic">Empty roster slot</div>
        <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">Fill in draft</div>
      </div>
      <div className="flex gap-[9px] max-[700px]:hidden">
        {[0, 1, 2, 3, 4].map(i => (
          <i key={i} className="block w-[11px] h-[11px] rounded-full border border-dashed border-hairline-strong bg-transparent" />
        ))}
      </div>
      <div className="text-right font-data font-bold text-[17px] tabular-nums text-fg-subtle max-[700px]:hidden">—</div>
    </div>
  )
}

// Position colors for section headers
const POS_COLOR: Record<string, string> = {
  QB: 'text-pos-qb',
  RB: 'text-pos-rb',
  WR: 'text-pos-wr',
  TE: 'text-pos-te',
}

interface Contract {
  id: string
  player_id: string
  salary: number
  years_remaining: number
  is_franchise_tagged: boolean
  acquisition_year: number | null
  player?: {
    name: string
    position: string
    nfl_team: string | null
    is_rookie?: boolean
    sleeper_player_id?: string
  } | null
}

export default function SalaryCapPreDraft() {
  const { ownerId: routeOwnerId } = useParams<{ ownerId: string }>()
  const { ownerId: myOwnerId, loading: ownerLoading } = useIsSalaryCapOwner()
  const { settings } = useSalaryCapSettings()

  // Determine which owner to show
  const targetOwnerId = routeOwnerId || myOwnerId
  const isMyTeam = targetOwnerId === myOwnerId

  // Fetch team data
  const { owner, contracts, deadCap, loading: teamLoading, error } = useSalaryCapTeam(targetOwnerId)
  const { bonusCapEntries, net2026: bonusCapTotal } = useBonusCap(targetOwnerId)

  // Combined loading state
  const loading = ownerLoading || teamLoading

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, DRAFT_DATE.getTime() - Date.now()))

  // Update countdown every second
  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, DRAFT_DATE.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [timeLeft])

  // Show loading state BEFORE any data calculations
  if (loading) {
    return (
      <SalaryCapLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-field-500" />
        </div>
      </SalaryCapLayout>
    )
  }

  if (error || !owner) {
    return (
      <SalaryCapLayout>
        <div className="text-center py-16">
          <h1 className="text-xl font-semibold text-fg mb-2">Team not found</h1>
          <p className="text-fg-muted">{error || 'This team does not exist.'}</p>
        </div>
      </SalaryCapLayout>
    )
  }

  // Now safe to calculate - data is loaded
  // Include both active contracts AND franchise-tagged players (who have expired status but are still on roster)
  const rosterContracts = (contracts || []).filter(c =>
    c.contract_status === 'active' || c.is_franchise_tagged
  ) as Contract[]

  // Helper to get effective salary (tag cost for tagged players, regular salary otherwise)
  const getEffectiveSalary = (contract: Contract): number => {
    if (contract.is_franchise_tagged) {
      return getTagCost(contract.player?.position || '', contract.salary)
    }
    return contract.salary
  }

  // For sorting, we need contracts with their effective salary
  const contractsWithEffectiveSalary = rosterContracts.map(c => ({
    ...c,
    effectiveSalary: getEffectiveSalary(c)
  }))

  const contractsByPosition = POSITIONS.reduce((acc, pos) => {
    const posContracts = contractsWithEffectiveSalary.filter(c => c.player?.position === pos.key)
    // Sort by effective salary descending
    acc[pos.key] = posContracts.sort((a, b) => b.effectiveSalary - a.effectiveSalary)
    return acc
  }, {} as Record<string, (Contract & { effectiveSalary: number })[]>)

  const rosterCount = rosterContracts.length
  const emptySlots = ROSTER_MAX - rosterCount

  const deadCapTotal = (deadCap || []).reduce((sum, d) => sum + d.amount, 0)
  // Sum effective salaries (using tag cost for franchise-tagged players)
  const salaries = contractsWithEffectiveSalary.reduce((sum, c) => sum + c.effectiveSalary, 0)
  const totalCap = (settings?.salary_cap || BASE_CAP) + bonusCapTotal
  const available = totalCap - salaries - deadCapTotal

  const capHealth = available < 0 ? 'bad' : available < 50 ? 'warn' : ''

  return (
    <SalaryCapLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display font-semibold text-[29px] tracking-[-0.02em] text-fg">
            {isMyTeam ? 'My Team' : owner.owner_name}
          </h1>
          <div className="text-fg-muted text-[14px] mt-[5px]">
            {owner.team_name || owner.owner_name} · {settings?.current_season || 2026} Pre-Draft
          </div>
        </div>

        {/* Draft Countdown */}
        {timeLeft > 0 && (() => {
          const totalSecs = Math.floor(timeLeft / 1000)
          const days = Math.floor(totalSecs / 86400)
          const hours = Math.floor((totalSecs % 86400) / 3600)
          const mins = Math.floor((totalSecs % 3600) / 60)
          const secs = totalSecs % 60
          const pad = (n: number) => String(n).padStart(2, '0')

          const isCrit = timeLeft < 24 * 60 * 60 * 1000
          const isWarn = timeLeft < 3 * 24 * 60 * 60 * 1000 && !isCrit
          const numColor = isCrit ? 'text-gold-500 animate-pulse' : isWarn ? 'text-gold-500' : 'text-fg'

          return (
            <div className="bg-surface-panel border border-hairline rounded-[13px] px-[18px] py-[15px]">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="font-data text-[10.5px] tracking-[0.14em] uppercase text-fg-subtle">The Draft begins in</div>
                  <div className="text-[12.5px] text-fg-muted mt-1">Sun, Aug 23, 2026 · 8:00 PM ET</div>
                </div>
                <div className={`font-data font-bold text-[26px] tracking-[-0.01em] flex gap-[11px] items-baseline ${numColor}`}>
                  {days > 0 && (
                    <span className="tabular-nums">{days}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">d</span></span>
                  )}
                  <span className="tabular-nums">{pad(hours)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">h</span></span>
                  <span className="tabular-nums">{pad(mins)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">m</span></span>
                  <span className="tabular-nums">{pad(secs)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">s</span></span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_268px] gap-[26px] items-start max-[900px]:grid-cols-1">
          {/* Main content */}
          <div>
            {/* Roster Section */}
            <div className="mt-0">
              <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                <div>
                  <h2 className="font-display font-semibold text-[18px]">Roster</h2>
                  <div className="text-[11.5px] text-fg-subtle mt-[3px]">Your locked roster heading into the draft.</div>
                </div>
                <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">
                  {rosterCount} / {ROSTER_MAX} FILLED
                </div>
              </div>

              {/* Year header */}
              <div className="grid grid-cols-[42px_1fr_112px_54px] gap-[13px] items-center py-[8px] max-[700px]:hidden">
                <div />
                <div />
                <div className="flex gap-[9px]">
                  {["'26", "'27", "'28", "'29", "'30"].map(y => (
                    <span key={y} className="w-[11px] text-center font-data text-[9px] text-fg-subtle">{y}</span>
                  ))}
                </div>
                <div />
              </div>

              {/* Position groups */}
              {POSITIONS.map(pos => {
                const posContracts = contractsByPosition[pos.key]
                if (posContracts.length === 0) return null

                return (
                  <div key={pos.key} className="mb-[20px]">
                    {/* Position header */}
                    <div className="flex items-center gap-[10px] py-[8px] border-b border-hairline">
                      <span className={`font-data text-[10px] font-bold tracking-[0.14em] uppercase ${POS_COLOR[pos.key]}`}>
                        {pos.label}
                      </span>
                      <span className="font-data text-[10px] text-fg-subtle">{posContracts.length}</span>
                    </div>

                    {/* Player rows */}
                    {posContracts.map(contract => (
                      <div
                        key={contract.id}
                        className="grid grid-cols-[42px_1fr_112px_54px] gap-[13px] items-center py-[12px] border-b border-hairline last:border-none max-[700px]:grid-cols-[38px_1fr] max-[700px]:gap-[11px]"
                      >
                        <PlayerAvatar
                          name={contract.player?.name || 'Unknown'}
                          position={(contract.player?.position || 'QB') as 'QB' | 'RB' | 'WR' | 'TE'}
                          sleeperId={contract.player?.sleeper_player_id}
                          size="md"
                        />

                        <div>
                          <div className="text-[14px] font-semibold text-fg">
                            {contract.player?.name || 'Unknown Player'}
                            {contract.player?.is_rookie && <RookieBadge />}
                            {contract.is_franchise_tagged && <TagBadge />}
                          </div>
                          <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">
                            {contract.player?.nfl_team || 'FA'}
                            {contract.is_franchise_tagged
                              ? ' · franchise tag'
                              : contract.acquisition_year && ` · signed ${contract.acquisition_year}`
                            }
                          </div>
                        </div>

                        {/* Franchise tags are 1-year deals */}
                        <Dots years={contract.is_franchise_tagged ? 1 : contract.years_remaining} isTag={contract.is_franchise_tagged} />

                        <div className={`text-right font-data font-bold text-[17px] tabular-nums ${contract.is_franchise_tagged ? 'text-gold-500' : 'text-fg'}`}>
                          ${contract.effectiveSalary}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Empty roster slots */}
              {emptySlots > 0 && (
                <div className="mt-[20px]">
                  <div className="flex items-center gap-[10px] py-[8px] border-b border-hairline">
                    <span className="font-data text-[10px] font-bold tracking-[0.14em] uppercase text-fg-subtle">
                      Empty Slots
                    </span>
                    <span className="font-data text-[10px] text-fg-subtle">{emptySlots}</span>
                  </div>

                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <EmptySlot key={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Dead Cap Section */}
            {deadCap.length > 0 && (
              <div className="mt-[34px]" id="secDead">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Dead cap</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Players you cut whose salary still counts against you.</div>
                  </div>
                  <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">{deadCap.length} CARRIED</div>
                </div>

                {/* Ledger header */}
                <div className="grid grid-cols-[1fr_78px_68px_78px_74px] gap-[12px] items-center py-[9px] border-b border-hairline max-[700px]:grid-cols-[1fr_74px_74px]">
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle">Player</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right">Cut</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right max-[700px]:hidden">Per year</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right max-[700px]:hidden">Through</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right">Remaining</span>
                </div>

                {deadCap.map(entry => (
                  <div key={entry.id} className="grid grid-cols-[1fr_78px_68px_78px_74px] gap-[12px] items-center py-[11px] border-b border-hairline last:border-none max-[700px]:grid-cols-[1fr_74px_74px]">
                    <div>
                      <div className="text-[13.5px] font-semibold text-fg">{entry.player_name}</div>
                    </div>
                    <div className="font-data text-[12.5px] text-fg-muted text-right">{entry.cut_year}</div>
                    <div className="font-data text-[12.5px] text-flag text-right max-[700px]:hidden">${entry.amount}</div>
                    <div className="font-data text-[12.5px] text-fg-muted text-right max-[700px]:hidden">{entry.cut_year + entry.years_remaining}</div>
                    <div className="font-data text-[14px] font-bold text-flag text-right">${entry.amount * entry.years_remaining}</div>
                  </div>
                ))}

                <div className="flex justify-between pt-[13px] font-data text-[12px] text-fg-muted">
                  <span>Counting against {settings?.current_season || 2026} cap</span>
                  <b className="text-[15px] tabular-nums text-flag">−${deadCapTotal}</b>
                </div>
              </div>
            )}

            {/* Bonus Cap Section */}
            {bonusCapEntries.length > 0 && (
              <div className="mt-[34px]" id="secBonus">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Bonus cap</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Cap traded to or from other owners in past years, spread over five seasons.</div>
                  </div>
                  <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">{bonusCapEntries.length} ACTIVE</div>
                </div>

                {/* Ledger header */}
                <div className="grid grid-cols-[1fr_78px_68px_78px_74px] gap-[12px] items-center py-[9px] border-b border-hairline max-[700px]:grid-cols-[1fr_74px_74px]">
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle">Counterparty</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right">Traded</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right max-[700px]:hidden">Per year</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right max-[700px]:hidden">Through</span>
                  <span className="font-data text-[9.5px] tracking-[0.1em] uppercase text-fg-subtle text-right">{settings?.current_season || 2026}</span>
                </div>

                {bonusCapEntries.map(entry => {
                  const perYear = entry.amount_2026 || 0
                  const currentYearAmount = entry.amount_2026 || 0

                  return (
                    <div key={entry.id} className="grid grid-cols-[1fr_78px_68px_78px_74px] gap-[12px] items-center py-[11px] border-b border-hairline last:border-none max-[700px]:grid-cols-[1fr_74px_74px]">
                      <div>
                        <div className="text-[13.5px] font-semibold text-fg">
                          {entry.corresponding_owner?.owner_name || 'Unknown'}
                        </div>
                      </div>
                      <div className="font-data text-[12.5px] text-fg-muted text-right">{entry.trade_year}</div>
                      <div className={`font-data text-[12.5px] text-right max-[700px]:hidden ${perYear > 0 ? 'text-field-500' : 'text-flag'}`}>
                        {perYear > 0 ? '+' : ''}${Math.abs(perYear)}
                      </div>
                      <div className="font-data text-[12.5px] text-fg-muted text-right max-[700px]:hidden">2030</div>
                      <div className={`font-data text-[14px] font-bold text-right ${currentYearAmount > 0 ? 'text-field-500' : 'text-flag'}`}>
                        {currentYearAmount > 0 ? '+' : ''}${Math.abs(currentYearAmount)}
                      </div>
                    </div>
                  )
                })}

                <div className="flex justify-between pt-[13px] font-data text-[12px] text-fg-muted">
                  <span>Added to {settings?.current_season || 2026} cap</span>
                  <b className={`text-[15px] tabular-nums ${bonusCapTotal > 0 ? 'text-field-500' : 'text-flag'}`}>
                    {bonusCapTotal > 0 ? '+' : ''}${Math.abs(bonusCapTotal)}
                  </b>
                </div>
              </div>
            )}

            {/* Empty state */}
            {rosterContracts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-fg-muted">No contracts found for this team.</p>
              </div>
            )}
          </div>

          {/* Sticky Cap Widget */}
          <div className="sticky top-[64px] max-[900px]:static">
            <div className="bg-surface-panel border border-hairline rounded-[14px] px-[18px] py-[16px]">
              <div className="font-data text-[10.5px] tracking-[0.14em] uppercase text-fg-subtle">Available cap</div>
              <div className={`font-data font-bold text-[30px] tracking-[-0.02em] leading-none mt-1 ${
                capHealth === 'bad' ? 'text-flag' : capHealth === 'warn' ? 'text-amber' : 'text-field-500'
              }`}>
                {money(available)}
              </div>

              <div className="mt-[12px]">
                <CapLedgerBar cap={{ baseCap: settings?.salary_cap || BASE_CAP, bonusCap: bonusCapTotal, salaries, deadCap: deadCapTotal, available }} />
              </div>

              <div className="mt-[14px] border-t border-hairline pt-[11px] space-y-[6px]">
                <div className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted">
                  <span>Base cap</span>
                  <span className="font-bold text-fg tabular-nums">${settings?.salary_cap || BASE_CAP}</span>
                </div>

                {bonusCapEntries.length > 0 && (
                  <div
                    onClick={() => document.getElementById('secBonus')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted cursor-pointer hover:text-fg group"
                  >
                    <span className="flex items-center gap-[6px]">
                      Bonus cap
                      <span className="text-fg-subtle text-[10px] group-hover:text-fg">→</span>
                    </span>
                    <span className={`font-bold tabular-nums ${bonusCapTotal > 0 ? 'text-field-500' : 'text-flag'}`}>
                      {bonusCapTotal > 0 ? '+' : ''}${Math.abs(bonusCapTotal)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted">
                  <span className="flex items-center gap-[6px]">
                    <i className="w-[8px] h-[8px] rounded-[2px] bg-salary" />
                    Salaries
                  </span>
                  <span className="font-bold text-fg tabular-nums">−${salaries}</span>
                </div>

                {(deadCap.length > 0 || deadCapTotal > 0) && (
                  <div
                    onClick={() => document.getElementById('secDead')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted cursor-pointer hover:text-fg group"
                  >
                    <span className="flex items-center gap-[6px]">
                      <i className="w-[8px] h-[8px] rounded-[2px] bg-flag" />
                      Dead cap
                      <span className="text-fg-subtle text-[10px] group-hover:text-fg">→</span>
                    </span>
                    <span className="font-bold tabular-nums text-flag">−${deadCapTotal}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-[9px] font-data text-[11.5px] text-fg-muted border-t border-hairline mt-[7px]">
                  <span>Available</span>
                  <span className={`font-bold text-[13px] tabular-nums ${
                    capHealth === 'bad' ? 'text-flag' : capHealth === 'warn' ? 'text-amber' : 'text-field-500'
                  }`}>
                    {money(available)}
                  </span>
                </div>
              </div>

              {/* Roster summary */}
              <div className="mt-[14px] border-t border-hairline pt-[11px]">
                <div className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted">
                  <span>Roster spots</span>
                  <span className="font-bold text-fg tabular-nums">{rosterCount} / {ROSTER_MAX}</span>
                </div>
                <div className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted">
                  <span>Empty slots</span>
                  <span className="font-bold text-amber tabular-nums">{emptySlots}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SalaryCapLayout>
  )
}
