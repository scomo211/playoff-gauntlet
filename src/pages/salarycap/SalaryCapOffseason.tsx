import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import SalaryCapPreDraft from './SalaryCapPreDraft'
import { CapLedgerBar } from '../../components/ui'
import {
  useSalaryCapTeam,
  useBonusCap,
  useIsSalaryCapOwner,
  useSalaryCapSettings,
} from '../../hooks/useSalaryCap'
import { supabase } from '../../lib/supabase'

// Constants
const BASE_CAP = 400
const DEAD_CAP_RATE = 0.4
const FA_PICKUP_COST = 5

// Roster lock deadline - Sunday, August 16, 2026 at 8:00 PM ET
const ROSTER_LOCK_DEADLINE = new Date('2026-08-16T20:00:00-04:00')
// Progress bar window starts Sunday, August 9, 2026 at 8:00 AM ET
const COUNTDOWN_START = new Date('2026-08-09T08:00:00-04:00')

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

// Draft availability calendar structure - August 2026
const DRAFT_CALENDAR = [
  { day: 'Tue', date: '18', slots: [{ id: 'tue_19_pm', time: 'PM' }] },
  { day: 'Wed', date: '19', slots: [{ id: 'wed_20_pm', time: 'PM' }] },
  { day: 'Thu', date: '20', slots: [{ id: 'thu_21_pm', time: 'PM' }] },
  { day: 'Fri', date: '21', slots: [{ id: 'fri_22_pm', time: 'PM' }] },
  { day: 'Sat', date: '22', slots: [
    { id: 'sat_23_am', time: 'AM' },
    { id: 'sat_23_mid', time: 'Mid' },
    { id: 'sat_23_pm', time: 'PM' },
  ]},
  { day: 'Sun', date: '23', slots: [
    { id: 'sun_24_mid', time: 'Mid' },
    { id: 'sun_24_pm', time: 'PM' },
  ]},
  { day: 'Mon', date: '24', slots: [{ id: 'mon_25_pm', time: 'PM' }] },
]

// Helpers
function money(n: number): string {
  return n < 0 ? `−$${Math.abs(n)}` : `$${n}`
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('')
}

// Position colors
const POS_COLOR: Record<string, string> = {
  QB: 'text-pos-qb', RB: 'text-pos-rb', WR: 'text-pos-wr',
  TE: 'text-pos-te', K: 'text-pos-k', DEF: 'text-pos-def',
}

// Position sort order: QB → RB → WR → TE → others
const POS_ORDER: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 }

// Sort by position (QB → RB → WR → TE), then by salary descending
function sortByPositionAndSalary<T extends { player?: { position?: string } | null; salary: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const posA = POS_ORDER[a.player?.position || ''] || 99
    const posB = POS_ORDER[b.player?.position || ''] || 99
    if (posA !== posB) return posA - posB
    return b.salary - a.salary // Descending salary within position
  })
}

// Sort FA pickups by position only (all have same $5 cost)
function sortFaPickupsByPosition<T extends { player?: { position?: string } | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const posA = POS_ORDER[a.player?.position || ''] || 99
    const posB = POS_ORDER[b.player?.position || ''] || 99
    return posA - posB
  })
}

// Avatar component matching renders.html exactly
function Avatar({ name, position, size = 'md' }: { name: string; position: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-[30px] h-[30px] rounded-[8px] text-[10.5px]',
    md: 'w-[42px] h-[42px] rounded-[11px] text-[12.5px]',
    lg: 'w-[84px] h-[84px] rounded-[20px] text-[25px]',
  }
  const posSize = {
    sm: 'text-[6px] py-[1px]',
    md: 'text-[7.5px] py-[2px]',
    lg: 'text-[10px] py-[4px] tracking-[0.14em]',
  }
  return (
    <div className={`${sizeClasses[size]} bg-surface-well border border-hairline-strong flex items-center justify-center font-data font-bold text-[#4d5766] flex-none relative overflow-hidden`}>
      {initials(name)}
      <span className={`absolute bottom-0 left-0 right-0 ${posSize[size]} font-bold tracking-[0.1em] bg-[rgba(9,12,17,0.85)] text-center ${POS_COLOR[position] || 'text-fg-subtle'}`}>
        {position}
      </span>
    </div>
  )
}

// Contract dots matching renders.html
function Dots({ years, kind = 'on', dimmed = false }: { years: number; kind?: 'on' | 'tag'; dimmed?: boolean }) {
  return (
    <div className={`flex gap-[9px] ${dimmed ? 'opacity-40' : ''}`}>
      {[0, 1, 2, 3, 4].map(i => (
        <i
          key={i}
          className={`block w-[11px] h-[11px] rounded-full border ${
            i < years
              ? kind === 'tag'
                ? 'bg-gold-500 border-gold-500'
                : 'bg-field-500 border-field-500'
              : i === 0 && years === 0
                ? 'bg-[#242c37] border-amber border-dashed'
                : 'bg-[#242c37] border-[#2c3542]'
          }`}
        />
      ))}
    </div>
  )
}

// Rookie badge
function RookieBadge() {
  return (
    <span className="inline-block font-data text-[9px] font-bold text-gold-500 bg-gold-500/15 px-[5px] py-[1px] rounded-[4px] ml-[6px]">
      R
    </span>
  )
}


// Types for free agent pickups
interface FaPickup {
  id: string
  player_id: string
  player: {
    name: string
    position: string
    nfl_team: string | null
  }
  offseason_decision: 'sign' | 'release' | null
}

export default function SalaryCapOffseason() {
  const { ownerId: routeOwnerId } = useParams<{ ownerId: string }>()
  const { ownerId: myOwnerId } = useIsSalaryCapOwner()
  const { settings } = useSalaryCapSettings()

  // Determine which owner to show - route param or current user's team
  const targetOwnerId = routeOwnerId || myOwnerId
  const isMyTeam = targetOwnerId === myOwnerId

  // Fetch team data - ALL hooks must be called before any conditional returns
  const { owner, contracts, deadCap, loading, error, refetch } = useSalaryCapTeam(targetOwnerId)
  const { bonusCapEntries, net2026: bonusCapTotal } = useBonusCap(targetOwnerId)

  // State for free agent pickups (loaded separately)
  const [faPickups, setFaPickups] = useState<FaPickup[]>([])
  const [faLoading, setFaLoading] = useState(true)

  // Local state for decisions (only editable if viewing own team)
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'cut'>>({})
  const [taggedPlayer, setTaggedPlayer] = useState<string | null>(null)
  const [pickupDecisions, setPickupDecisions] = useState<Record<string, 'sign' | 'release'>>({})
  const [saving, setSaving] = useState(false)

  // Draft availability state
  const [draftAvailability, setDraftAvailability] = useState<string[]>([])
  const [savingAvailability, setSavingAvailability] = useState(false)

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, ROSTER_LOCK_DEADLINE.getTime() - Date.now()))

  // Update countdown every second
  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, ROSTER_LOCK_DEADLINE.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [timeLeft])

  // Fetch free agent pickups for this owner
  useEffect(() => {
    async function fetchPickups() {
      if (!targetOwnerId) {
        setFaPickups([])
        setFaLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('salarycap_free_agent_pickups')
          .select('*, player:salarycap_players(*)')
          .eq('owner_id', targetOwnerId)

        if (error) throw error
        setFaPickups(data || [])
      } catch (err) {
        console.error('Failed to fetch FA pickups:', err)
        setFaPickups([])
      } finally {
        setFaLoading(false)
      }
    }

    fetchPickups()
  }, [targetOwnerId])

  // Fetch draft availability for this owner
  useEffect(() => {
    async function fetchAvailability() {
      if (!targetOwnerId) {
        setDraftAvailability([])
        return
      }

      try {
        const { data } = await supabase
          .from('salarycap_draft_availability')
          .select('selected_slots')
          .eq('owner_id', targetOwnerId)
          .single()

        if (data?.selected_slots) {
          setDraftAvailability(data.selected_slots)
        }
      } catch {
        // Table might not exist or no data yet
        setDraftAvailability([])
      }
    }

    fetchAvailability()
  }, [targetOwnerId])

  // Initialize decisions from contract data
  useEffect(() => {
    if (!contracts.length) return

    const initialDecisions: Record<string, 'keep' | 'cut'> = {}
    contracts.forEach(c => {
      // Use existing offseason_decision if set, otherwise default to 'keep'
      initialDecisions[c.id] = c.offseason_decision === 'cut' ? 'cut' : 'keep'
    })
    setDecisions(initialDecisions)

    // Find if anyone is already franchise tagged
    const tagged = contracts.find(c => c.is_franchise_tagged)
    setTaggedPlayer(tagged?.id || null)
  }, [contracts])

  // Initialize pickup decisions
  useEffect(() => {
    const initialPickupDecisions: Record<string, 'sign' | 'release'> = {}
    faPickups.forEach(p => {
      initialPickupDecisions[p.id] = p.offseason_decision === 'release' ? 'release' : 'sign'
    })
    setPickupDecisions(initialPickupDecisions)
  }, [faPickups])

  // If offseason is finalized, show the pre-draft view instead
  // This must come AFTER all hooks to satisfy React's rules of hooks
  if (settings?.offseason_finalized) {
    return <SalaryCapPreDraft />
  }

  // Filter contracts by status
  const activeContracts = contracts.filter(c => c.contract_status === 'active')
  const expiredContracts = contracts.filter(c => c.contract_status === 'expired')

  // Calculate cap
  const deadCapTotal = deadCap.reduce((sum, d) => sum + d.amount, 0)

  let salaries = 0
  let projectedDeadCap = deadCapTotal
  let keptCount = 0
  let cutCount = 0

  activeContracts.forEach(c => {
    if (decisions[c.id] === 'cut') {
      // Only add THIS YEAR's dead cap hit (future years tracked separately)
      const deadPerYear = Math.ceil(DEAD_CAP_RATE * c.salary)
      projectedDeadCap += deadPerYear
      cutCount++
    } else {
      salaries += c.salary
      keptCount++
    }
  })

  // Add tag cost if someone is tagged
  if (taggedPlayer) {
    const tagged = expiredContracts.find(t => t.id === taggedPlayer)
    if (tagged) {
      // Tag cost = max(position average, previous salary)
      // For now, approximate with previous salary * 1.2 or use stored tag cost
      const tagCost = getTagCost(tagged.player?.position || '', tagged.salary)
      salaries += tagCost
    }
  }

  // Add signed pickups
  const signedPickups = faPickups.filter(p => pickupDecisions[p.id] === 'sign').length
  salaries += signedPickups * FA_PICKUP_COST

  const totalCap = (settings?.salary_cap || BASE_CAP) + bonusCapTotal
  const available = totalCap - salaries - projectedDeadCap

  const capHealth = available < 0 ? 'bad' : available < 50 ? 'warn' : ''

  // Save decisions to database
  const handleSave = async () => {
    if (!isMyTeam || !targetOwnerId) return

    setSaving(true)
    try {
      // Update contract decisions
      for (const [contractId, decision] of Object.entries(decisions)) {
        await supabase
          .from('salarycap_contracts')
          .update({ offseason_decision: decision })
          .eq('id', contractId)
      }

      // Update franchise tag
      // First, remove tag from all contracts
      await supabase
        .from('salarycap_contracts')
        .update({ is_franchise_tagged: false })
        .eq('owner_id', targetOwnerId)

      // Then set tag on selected player
      if (taggedPlayer) {
        await supabase
          .from('salarycap_contracts')
          .update({ is_franchise_tagged: true })
          .eq('id', taggedPlayer)
      }

      // Update FA pickup decisions
      for (const [pickupId, decision] of Object.entries(pickupDecisions)) {
        await supabase
          .from('salarycap_free_agent_pickups')
          .update({ offseason_decision: decision })
          .eq('id', pickupId)
      }

      refetch()
    } catch (err) {
      console.error('Failed to save decisions:', err)
    } finally {
      setSaving(false)
    }
  }

  // Toggle draft availability slot
  const toggleDraftSlot = async (slotId: string) => {
    if (!isMyTeam || !targetOwnerId) return
    setSavingAvailability(true)

    const newSlots = draftAvailability.includes(slotId)
      ? draftAvailability.filter(s => s !== slotId)
      : [...draftAvailability, slotId]

    try {
      const { error } = await supabase
        .from('salarycap_draft_availability')
        .upsert({
          owner_id: targetOwnerId,
          selected_slots: newSlots,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id' })

      if (error) throw error
      setDraftAvailability(newSlots)
    } catch (err) {
      console.error('Error saving availability:', err)
    } finally {
      setSavingAvailability(false)
    }
  }

  if (loading || faLoading) {
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

  return (
    <SalaryCapLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display font-semibold text-[29px] tracking-[-0.02em] text-fg">
            {isMyTeam ? 'My Team' : owner.owner_name}
          </h1>
          <div className="text-fg-muted text-[14px] mt-[5px]">
            {owner.team_name || owner.owner_name} · {settings?.current_season || 2026} Offseason
            {!isMyTeam && <span className="ml-2 text-fg-subtle">(Read-only)</span>}
          </div>
        </div>

        {/* Ticker - hide once deadline passes */}
        {timeLeft > 0 && (() => {
          const totalSecs = Math.floor(timeLeft / 1000)
          const days = Math.floor(totalSecs / 86400)
          const hours = Math.floor((totalSecs % 86400) / 3600)
          const mins = Math.floor((totalSecs % 3600) / 60)
          const secs = totalSecs % 60
          const pad = (n: number) => String(n).padStart(2, '0')

          // Calculate progress based on window from COUNTDOWN_START to ROSTER_LOCK_DEADLINE
          const windowMs = ROSTER_LOCK_DEADLINE.getTime() - COUNTDOWN_START.getTime()
          const pct = Math.min(99, 100 - (timeLeft / windowMs) * 100)

          // Color states
          const isWarn = timeLeft < 3 * 24 * 60 * 60 * 1000 && timeLeft >= 24 * 60 * 60 * 1000
          const isCrit = timeLeft < 24 * 60 * 60 * 1000
          const numColor = isCrit ? 'text-flag animate-pulse' : isWarn ? 'text-amber' : 'text-fg'
          const barColor = isCrit ? 'bg-flag' : isWarn ? 'bg-amber' : 'bg-field-500'

          return (
            <div className="relative flex justify-between items-center gap-4 bg-surface-panel border border-hairline rounded-[13px] px-[18px] py-[15px] overflow-hidden">
              <div>
                <div className="font-data text-[10.5px] tracking-[0.14em] uppercase text-fg-subtle">Rosters lock in</div>
                <div className="text-[12.5px] text-fg-muted mt-1">Sun, Aug 16, 2026 · 8:00 PM ET</div>
              </div>
              <div className={`font-data font-bold text-[26px] tracking-[-0.01em] flex gap-[11px] items-baseline ${numColor}`}>
                {days > 0 && (
                  <span className="tabular-nums">{days}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">d</span></span>
                )}
                <span className="tabular-nums">{pad(hours)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">h</span></span>
                <span className="tabular-nums">{pad(mins)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">m</span></span>
                <span className="tabular-nums">{pad(secs)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">s</span></span>
              </div>
              <div className={`absolute left-0 bottom-0 h-[2px] ${barColor} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          )
        })()}

        {/* Draft Availability - only show for own team */}
        {isMyTeam && (
          <div className="bg-surface-panel border border-hairline rounded-[14px] px-[18px] py-[16px]">
            <div className="flex justify-between items-baseline mb-[14px]">
              <div>
                <h2 className="font-display font-semibold text-[18px]">Draft availability</h2>
                <div className="text-[11.5px] text-fg-subtle mt-[3px]">Select all times you can attend the live draft · August 2026</div>
              </div>
              <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">
                {draftAvailability.length > 0 ? (
                  <span className="text-field-500">{draftAvailability.length} SELECTED</span>
                ) : (
                  <span className="text-amber">NONE SELECTED</span>
                )}
              </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-[8px]">
              {DRAFT_CALENDAR.map(day => {
                const allSelected = day.slots.every(s => draftAvailability.includes(s.id))
                const someSelected = day.slots.some(s => draftAvailability.includes(s.id))

                return (
                  <div
                    key={day.day}
                    className={`rounded-[10px] border overflow-hidden transition ${
                      allSelected
                        ? 'border-field-500 bg-field-500/10'
                        : someSelected
                          ? 'border-field-500/50 bg-surface-well'
                          : 'border-hairline bg-surface-well'
                    }`}
                  >
                    {/* Day header */}
                    <div className="text-center py-[8px] border-b border-hairline">
                      <div className="font-data text-[9px] tracking-[0.1em] uppercase text-fg-subtle">{day.day}</div>
                      <div className="font-data text-[18px] font-bold text-fg tabular-nums">{day.date}</div>
                    </div>

                    {/* Time slots */}
                    <div className={`p-[6px] ${day.slots.length > 1 ? 'space-y-[4px]' : ''}`}>
                      {day.slots.map(slot => {
                        const isSelected = draftAvailability.includes(slot.id)

                        return (
                          <button
                            key={slot.id}
                            onClick={() => toggleDraftSlot(slot.id)}
                            disabled={savingAvailability}
                            className={`w-full py-[8px] px-[4px] rounded-[6px] font-data text-[10px] font-semibold transition ${
                              isSelected
                                ? 'bg-field-500 text-[#04150c]'
                                : 'bg-hairline text-fg-subtle hover:bg-hairline-strong hover:text-fg'
                            } disabled:opacity-50`}
                          >
                            {slot.time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {draftAvailability.length === 0 && (
              <div className="mt-[12px] text-center">
                <p className="font-data text-[11px] text-amber">Please select at least one available time slot</p>
              </div>
            )}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_268px] gap-[26px] items-start max-[900px]:grid-cols-1">
          {/* Main content */}
          <div>
            {/* Under Contract Section */}
            {activeContracts.length > 0 && (
              <div className="mt-0">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Under contract</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Keep at current salary, or cut and take the dead cap hit.</div>
                  </div>
                  <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">{keptCount} KEPT · {cutCount} CUT</div>
                </div>

                {/* Year header */}
                <div className="grid grid-cols-[42px_1fr_112px_54px_126px] gap-[13px] items-center py-[8px] max-[700px]:hidden">
                  <div />
                  <div />
                  <div className="flex gap-[9px]">
                    {["'26", "'27", "'28", "'29", "'30"].map(y => (
                      <span key={y} className="w-[11px] text-center font-data text-[9px] text-fg-subtle">{y}</span>
                    ))}
                  </div>
                  <div />
                  <div />
                </div>

                {/* Contract rows */}
                {sortByPositionAndSalary(activeContracts).map(contract => {
                  const isCut = decisions[contract.id] === 'cut'
                  const deadPerYear = Math.ceil(DEAD_CAP_RATE * contract.salary)
                  const net = contract.salary - deadPerYear // Net freed this year = salary minus per-year dead cap

                  return (
                    <div
                      key={contract.id}
                      className={`grid grid-cols-[42px_1fr_112px_54px_126px] gap-[13px] items-center py-[12px] border-b border-hairline last:border-none max-[700px]:grid-cols-[38px_1fr_62px] max-[700px]:gap-[11px] ${isCut ? 'cutting' : ''}`}
                    >
                      <Avatar name={contract.player?.name || 'Unknown'} position={contract.player?.position || 'NA'} />

                      <div>
                        <div className={`text-[14px] font-semibold ${isCut ? 'line-through text-fg-subtle' : 'text-fg'}`}>
                          {contract.player?.name || 'Unknown Player'}
                          {contract.player?.is_rookie && <RookieBadge />}
                        </div>
                        <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">
                          {contract.player?.nfl_team || 'FA'}
                          {contract.acquisition_year && ` · signed ${contract.acquisition_year}`}
                        </div>
                      </div>

                      <Dots years={contract.years_remaining} dimmed={isCut} />

                      <div className={`text-right font-data font-bold text-[17px] tabular-nums ${isCut ? 'text-fg-subtle' : 'text-fg'}`}>
                        ${contract.salary}
                      </div>

                      {isMyTeam ? (
                        <div className="flex gap-[6px] justify-end max-[700px]:col-span-full max-[700px]:justify-start max-[700px]:mt-[7px]">
                          <button
                            onClick={() => setDecisions(d => ({ ...d, [contract.id]: 'keep' }))}
                            className={`px-[12px] py-[6px] rounded-[7px] text-[11.5px] font-semibold border transition-colors ${
                              !isCut
                                ? 'bg-field-500 border-field-500 text-[#04150c]'
                                : 'bg-transparent border-hairline-strong text-fg-subtle hover:text-fg hover:border-fg-subtle'
                            }`}
                          >
                            Keep
                          </button>
                          <button
                            onClick={() => setDecisions(d => ({ ...d, [contract.id]: 'cut' }))}
                            className={`px-[12px] py-[6px] rounded-[7px] text-[11.5px] font-semibold border transition-colors ${
                              isCut
                                ? 'bg-flag border-flag text-white'
                                : 'bg-transparent border-hairline-strong text-fg-subtle hover:text-fg hover:border-fg-subtle'
                            }`}
                          >
                            Cut
                          </button>
                        </div>
                      ) : (
                        <div className="text-right font-data text-[11px] text-fg-subtle">
                          {isCut ? 'Cutting' : 'Keeping'}
                        </div>
                      )}

                      {/* Impact line when cutting */}
                      {isCut && (
                        <div className="col-start-2 col-end-[-1] font-data text-[11px] text-fg-muted pt-[9px] max-[700px]:col-span-full max-[700px]:col-start-1">
                          Frees <b className={net < 0 ? 'text-flag' : 'text-field-500'}>${contract.salary}</b>
                          {' · '}<i className="not-italic text-flag">${deadPerYear}/yr dead cap through {2025 + contract.years_remaining}</i>
                          {' · net '}<b className={net < 0 ? 'text-flag' : 'text-field-500'}>{net < 0 ? `−$${Math.abs(net)}` : `+$${net}`}</b>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Franchise Tag Section */}
            {expiredContracts.length > 0 && (
              <div className="mt-[34px]">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Franchise tag</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Contracts expired. Tag one for a year at the tag price — the rest hit free agency.</div>
                  </div>
                  <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">PICK ONE</div>
                </div>

                {sortByPositionAndSalary(expiredContracts).map(candidate => {
                  const isTagged = taggedPlayer === candidate.id
                  const isDimmed = taggedPlayer !== null && !isTagged
                  const tagCost = getTagCost(candidate.player?.position || '', candidate.salary)

                  return (
                    <div
                      key={candidate.id}
                      onClick={() => isMyTeam && setTaggedPlayer(isTagged ? null : candidate.id)}
                      className={`grid grid-cols-[42px_1fr_112px_54px_126px] gap-[13px] items-center py-[12px] border-b border-hairline transition-all max-[700px]:grid-cols-[38px_1fr_62px] ${
                        isMyTeam ? 'cursor-pointer' : ''
                      } ${
                        isTagged ? 'bg-gold-500/[0.07] mx-[-12px] px-[12px] rounded-[9px]' : ''
                      } ${isDimmed ? 'opacity-40' : ''}`}
                    >
                      <Avatar name={candidate.player?.name || 'Unknown'} position={candidate.player?.position || 'NA'} />

                      <div>
                        <div className="text-[14px] font-semibold text-fg">
                          {candidate.player?.name || 'Unknown'}
                          {candidate.player?.is_rookie && <RookieBadge />}
                        </div>
                        <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">
                          {candidate.player?.nfl_team || 'FA'} · made ${candidate.salary} last year
                        </div>
                      </div>

                      <Dots years={1} kind="tag" dimmed={isDimmed} />

                      <div className="text-right font-data font-bold text-[17px] tabular-nums text-gold-500">
                        ${tagCost}
                      </div>

                      <div className="flex items-center gap-[8px] justify-end font-data text-[11.5px] text-fg-subtle">
                        <span>tag</span>
                        <span className={`w-[18px] h-[18px] rounded-full border-2 flex-none ${
                          isTagged
                            ? 'border-gold-500'
                            : 'border-hairline-strong'
                        }`} style={isTagged ? { background: 'radial-gradient(circle, #E8B437 42%, transparent 45%)' } : {}} />
                      </div>
                    </div>
                  )
                })}

                {/* Tag nobody option */}
                {isMyTeam && (
                  <div
                    onClick={() => setTaggedPlayer(null)}
                    className="flex justify-between items-center py-[12px] text-[12.5px] text-fg-subtle cursor-pointer hover:text-fg"
                  >
                    <span>Tag nobody — let all go to free agency</span>
                    <div className="flex items-center gap-[8px] font-data text-[11.5px]">
                      <span className={`w-[18px] h-[18px] rounded-full border-2 flex-none ${
                        taggedPlayer === null
                          ? 'border-field-500'
                          : 'border-hairline-strong'
                      }`} style={taggedPlayer === null ? { background: 'radial-gradient(circle, #2E9E63 42%, transparent 45%)' } : {}} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Free Agent Pickups Section */}
            {faPickups.length > 0 && (
              <div className="mt-[34px]">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Free agent pickups</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Signed off waivers last season. Keep for ${FA_PICKUP_COST} on a one-year deal, or release.</div>
                  </div>
                  <div className="font-data text-[10.5px] tracking-[0.1em] text-fg-subtle">{signedPickups} OF {faPickups.length} KEPT</div>
                </div>

                {sortFaPickupsByPosition(faPickups).map(pickup => {
                  const isReleased = pickupDecisions[pickup.id] === 'release'

                  return (
                    <div
                      key={pickup.id}
                      className={`grid grid-cols-[42px_1fr_112px_54px_126px] gap-[13px] items-center py-[12px] border-b border-hairline last:border-none max-[700px]:grid-cols-[38px_1fr_62px] ${isReleased ? 'opacity-45' : ''}`}
                    >
                      <Avatar name={pickup.player?.name || 'Unknown'} position={pickup.player?.position || 'NA'} />

                      <div>
                        <div className="text-[14px] font-semibold text-fg">{pickup.player?.name || 'Unknown'}</div>
                        <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">{pickup.player?.nfl_team || 'FA'}</div>
                      </div>

                      <Dots years={1} dimmed={isReleased} />

                      <div className="text-right font-data font-bold text-[17px] tabular-nums text-fg">${FA_PICKUP_COST}</div>

                      {isMyTeam ? (
                        <div className="flex gap-[6px] justify-end">
                          <button
                            onClick={() => setPickupDecisions(d => ({ ...d, [pickup.id]: 'sign' }))}
                            className={`px-[12px] py-[6px] rounded-[7px] text-[11.5px] font-semibold border transition-colors ${
                              !isReleased
                                ? 'bg-field-500 border-field-500 text-[#04150c]'
                                : 'bg-transparent border-hairline-strong text-fg-subtle hover:text-fg'
                            }`}
                          >
                            Sign
                          </button>
                          <button
                            onClick={() => setPickupDecisions(d => ({ ...d, [pickup.id]: 'release' }))}
                            className={`px-[12px] py-[6px] rounded-[7px] text-[11.5px] font-semibold border transition-colors ${
                              isReleased
                                ? 'bg-hairline-strong border-hairline-strong text-fg'
                                : 'bg-transparent border-hairline-strong text-fg-subtle hover:text-fg'
                            }`}
                          >
                            Release
                          </button>
                        </div>
                      ) : (
                        <div className="text-right font-data text-[11px] text-fg-subtle">
                          {isReleased ? 'Releasing' : 'Signing'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Submit bar - only show for own team */}
            {isMyTeam && (
              <div className="sticky bottom-[14px] bg-[rgba(21,27,36,0.97)] backdrop-blur-[14px] border border-hairline-strong rounded-[14px] px-[18px] py-[14px] mt-[30px] flex justify-between items-center gap-[14px] flex-wrap">
                <div className="text-[12.5px] text-fg-muted">
                  <b className="text-fg">{cutCount}</b> cut
                  {' · '}{taggedPlayer ? <>tagging <b className="text-fg">{expiredContracts.find(t => t.id === taggedPlayer)?.player?.name}</b></> : <><b className="text-fg">no</b> franchise tag</>}
                  {faPickups.length > 0 && <>{' · '}<b className="text-fg">{signedPickups}</b> of {faPickups.length} free agents kept</>}
                  {' · '}<b className={draftAvailability.length > 0 ? 'text-fg' : 'text-amber'}>{draftAvailability.length}</b> draft date{draftAvailability.length !== 1 ? 's' : ''} selected
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-field-500 text-[#04150c] font-bold text-[13.5px] px-[22px] py-[11px] rounded-full hover:bg-field-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save decisions'}
                </button>
              </div>
            )}

            {/* Dead Cap Section */}
            {deadCap.length > 0 && (
              <div className="mt-[34px]" id="secDead">
                <div className="flex justify-between items-baseline pb-[10px] border-b border-hairline-strong mb-[3px]">
                  <div>
                    <h2 className="font-display font-semibold text-[18px]">Dead cap</h2>
                    <div className="text-[11.5px] text-fg-subtle mt-[3px]">Players you cut whose salary still counts against you. Nothing to decide — this is history.</div>
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
                  const perYear = entry.amount_2026 || 0 // Simplified - should calculate actual per-year
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

            {/* Empty state if no contracts */}
            {activeContracts.length === 0 && expiredContracts.length === 0 && faPickups.length === 0 && (
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
                <CapLedgerBar cap={{ baseCap: settings?.salary_cap || BASE_CAP, bonusCap: bonusCapTotal, salaries, deadCap: projectedDeadCap, available }} />
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

                {(deadCap.length > 0 || projectedDeadCap > 0) && (
                  <div
                    onClick={() => document.getElementById('secDead')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex justify-between items-center py-[6px] font-data text-[11.5px] text-fg-muted cursor-pointer hover:text-fg group"
                  >
                    <span className="flex items-center gap-[6px]">
                      <i className="w-[8px] h-[8px] rounded-[2px] bg-flag" />
                      Dead cap
                      <span className="text-fg-subtle text-[10px] group-hover:text-fg">→</span>
                    </span>
                    <span className="font-bold tabular-nums text-flag">−${projectedDeadCap}</span>
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
            </div>
          </div>
        </div>
      </div>
    </SalaryCapLayout>
  )
}
