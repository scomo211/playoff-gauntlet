import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import PositionBadge from '../../components/salarycap/PositionBadge'
import PlayerAvatar from '../../components/salarycap/PlayerAvatar'
import RookieBadge from '../../components/salarycap/RookieBadge'
import { isDeadlinePassed } from '../../components/salarycap/DeadlineBanner'
import { useSalaryCapSettings, useIsSalaryCapOwner } from '../../hooks/useSalaryCap'
import { supabase } from '../../lib/supabase'
import { calculateDeadCap } from '../../types/salarycap'

// Draft availability calendar structure
const DRAFT_CALENDAR = [
  { day: 'Tue', date: '18', slots: [{ id: 'tue_18_pm', time: 'PM' }] },
  { day: 'Wed', date: '19', slots: [{ id: 'wed_19_pm', time: 'PM' }] },
  { day: 'Thu', date: '20', slots: [{ id: 'thu_20_pm', time: 'PM' }] },
  { day: 'Fri', date: '21', slots: [{ id: 'fri_21_pm', time: 'PM' }] },
  { day: 'Sat', date: '22', slots: [
    { id: 'sat_22_am', time: 'AM' },
    { id: 'sat_22_mid', time: 'Midday' },
    { id: 'sat_22_pm', time: 'PM' },
  ]},
  { day: 'Sun', date: '23', slots: [
    { id: 'sun_23_mid', time: 'Midday' },
    { id: 'sun_23_pm', time: 'PM' },
  ]},
  { day: 'Mon', date: '24', slots: [{ id: 'mon_24_pm', time: 'PM' }] },
]

interface Contract {
  id: string
  player_id: string
  owner_id: string
  salary: number
  years_total: number
  years_remaining: number
  contract_status: string
  offseason_decision: string
  dead_cap_if_cut: number
  is_franchise_tagged: boolean
  player: { name: string; position: string; nfl_team: string | null; sleeper_player_id: string; is_rookie: boolean }
}

interface FreeAgentPickup {
  id: string
  player_id: string
  owner_id: string
  offseason_decision: string
  player: { name: string; position: string; nfl_team: string | null; sleeper_player_id: string; is_rookie: boolean }
}

interface Owner {
  id: string
  owner_name: string
  team_name: string | null
}

interface DeadCap {
  id: string
  owner_id: string
  player_name: string
  amount: number
  years_remaining: number
  original_salary: number
  drafted_year: number
}

interface BonusCap {
  id: string
  owner_id: string
  corresponding_owner_name: string
  trade_year: number
  amount_2026: number
  amount_2027: number
  amount_2028: number
  amount_2029: number
  amount_2030: number
}

// Franchise tag costs by position
const FRANCHISE_TAG_COSTS: Record<string, number> = {
  QB: 40,
  RB: 99,
  WR: 74,
  TE: 22,
}

// Format currency with correct negative sign placement: -$5 not $-5
function formatBonusCap(amount: number, showPlus = true): string {
  if (amount === 0) return '-'
  if (amount > 0) return showPlus ? `+$${amount}` : `$${amount}`
  return `-$${Math.abs(amount)}`
}

function getFranchiseTagCost(position: string, previousSalary: number): number {
  const positionCost = FRANCHISE_TAG_COSTS[position] || 0
  return Math.max(positionCost, previousSalary)
}

// Donut chart component with math equation layout
function CapDonutChart({
  salaries,
  deadCap,
  bonusCap = 0,
  totalCap
}: {
  salaries: number
  deadCap: number
  bonusCap?: number
  totalCap: number
}) {
  const available = Math.max(0, totalCap + bonusCap - salaries - deadCap)

  // For the donut, show proportions including bonus cap
  // Use absolute value of bonus cap for visual representation
  const absBonusCap = Math.abs(bonusCap)
  const total = salaries + deadCap + available + absBonusCap
  const salaryPct = total > 0 ? (salaries / total) * 100 : 0
  const deadCapPct = total > 0 ? (deadCap / total) * 100 : 0
  const bonusCapPct = total > 0 ? (absBonusCap / total) * 100 : 0
  const availablePct = total > 0 ? (available / total) * 100 : 100

  const radius = 50
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius

  const availableDash = (availablePct / 100) * circumference
  const salaryDash = (salaryPct / 100) * circumference
  const deadCapDash = (deadCapPct / 100) * circumference
  const bonusCapDash = (bonusCapPct / 100) * circumference

  let offset = 0
  const segments = []

  // Green = Available (shown first)
  if (available > 0) {
    segments.push({ color: '#22c55e', dash: availableDash, offset })
    offset += availableDash
  }
  // Amber = Committed Salaries
  if (salaries > 0) {
    segments.push({ color: '#f59e0b', dash: salaryDash, offset })
    offset += salaryDash
  }
  // Red = Dead Cap
  if (deadCap > 0) {
    segments.push({ color: '#ef4444', dash: deadCapDash, offset })
    offset += deadCapDash
  }
  // Blue = Bonus Cap (shown for both positive and negative)
  if (bonusCap !== 0) {
    segments.push({ color: '#3b82f6', dash: bonusCapDash, offset })
    offset += bonusCapDash
  }

  return (
    <div className="flex items-center gap-6">
      {/* Donut Chart - Left Side */}
      <div className="flex-shrink-0">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset + circumference / 4}
              strokeLinecap="butt"
            />
          ))}
          <text x="65" y="62" textAnchor="middle" className="fill-white text-xl font-bold">${available}</text>
          <text x="65" y="78" textAnchor="middle" className="fill-slate-400 text-[10px]">Available</text>
        </svg>
      </div>

      {/* Math Equation - Right Side */}
      <div className="flex-1 space-y-1 text-sm font-mono">
        {/* Salary Cap */}
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Salary Cap</span>
          <span className="text-white font-medium">${totalCap}</span>
        </div>
        {/* Salaries */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-400">Salaries</span>
          </div>
          <span className="text-amber-400 font-medium">-${salaries}</span>
        </div>
        {/* Dead Cap */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-slate-400">Dead Cap</span>
          </div>
          <span className="text-red-400 font-medium">-${deadCap}</span>
        </div>
        {/* Bonus Cap - only show if non-zero */}
        {bonusCap !== 0 && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-400">Bonus Cap</span>
            </div>
            <span className={bonusCap > 0 ? 'text-emerald-400' : 'text-red-400'}>
              {formatBonusCap(bonusCap)}
            </span>
          </div>
        )}
        {/* Divider */}
        <div className="border-t border-slate-600 my-1" />
        {/* Available */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-white font-semibold">Available</span>
          </div>
          <span className="text-emerald-400 font-bold text-base">${available}</span>
        </div>
      </div>
    </div>
  )
}

// Years dots component
function YearsDots({ years }: { years: number }) {
  return (
    <div className="flex gap-1 justify-end" title={`${years} year${years !== 1 ? 's' : ''} remaining`}>
      {Array.from({ length: Math.min(years, 4) }).map((_, i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400" />
      ))}
      {Array.from({ length: Math.max(0, 4 - years) }).map((_, i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full bg-slate-700" />
      ))}
    </div>
  )
}

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE']

function sortByPositionAndSalary<T extends { player: { position: string }; salary?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const posA = POSITION_ORDER.indexOf(a.player?.position || 'TE')
    const posB = POSITION_ORDER.indexOf(b.player?.position || 'TE')
    if (posA !== posB) return posA - posB
    return (b.salary || 0) - (a.salary || 0)
  })
}

function sortFAByPosition<T extends { player: { position: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const posA = POSITION_ORDER.indexOf(a.player?.position || 'TE')
    const posB = POSITION_ORDER.indexOf(b.player?.position || 'TE')
    return posA - posB
  })
}

export default function SalaryCapTeamDetail() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const { settings } = useSalaryCapSettings()
  const { ownerId: myOwnerId } = useIsSalaryCapOwner()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [freeAgentPickups, setFreeAgentPickups] = useState<FreeAgentPickup[]>([])
  const [deadCap, setDeadCap] = useState<DeadCap[]>([])
  const [bonusCap, setBonusCap] = useState<BonusCap[]>([])
  const [draftAvailability, setDraftAvailability] = useState<string[]>([])
  const [savingAvailability, setSavingAvailability] = useState(false)

  // Check if viewing own team and if editing is allowed
  const isOwnTeam = myOwnerId === ownerId
  const deadlinePassed = isDeadlinePassed()
  const isLocked = settings?.offseason_finalized || false
  const canEdit = isOwnTeam && !deadlinePassed && !isLocked

  const underContract = sortByPositionAndSalary(contracts.filter(c => c.contract_status === 'active'))
  const expiredContracts = sortByPositionAndSalary(contracts.filter(c => c.contract_status === 'expired'))
  const sortedFreeAgentPickups = sortFAByPosition(freeAgentPickups)

  useEffect(() => {
    async function loadData() {
      if (!ownerId) return

      try {
        // Fetch owner
        const { data: ownerData } = await supabase
          .from('salarycap_owners')
          .select('id, owner_name, team_name')
          .eq('id', ownerId)
          .single()

        setOwner(ownerData)

        // Fetch contracts
        const { data: contractsData } = await supabase
          .from('salarycap_contracts')
          .select('*, player:salarycap_players(name, position, nfl_team, sleeper_player_id, is_rookie)')
          .eq('owner_id', ownerId)

        setContracts(contractsData || [])

        // Fetch free agent pickups
        const { data: faData } = await supabase
          .from('salarycap_free_agent_pickups')
          .select('*, player:salarycap_players(name, position, nfl_team, sleeper_player_id, is_rookie)')
          .eq('owner_id', ownerId)

        setFreeAgentPickups(faData || [])

        // Fetch dead cap
        const { data: deadCapData } = await supabase
          .from('salarycap_dead_cap')
          .select('*')
          .eq('owner_id', ownerId)
          .gt('years_remaining', 0)
          .order('amount', { ascending: false })

        setDeadCap(deadCapData || [])

        // Fetch bonus cap
        try {
          const { data: bonusCapData } = await supabase
            .from('salarycap_bonus_cap')
            .select('*')
            .eq('owner_id', ownerId)
            .order('trade_year', { ascending: false })

          setBonusCap(bonusCapData || [])
        } catch {
          // Table might not exist yet
          setBonusCap([])
        }

        // Fetch draft availability
        try {
          const { data: availabilityData } = await supabase
            .from('salarycap_draft_availability')
            .select('selected_slots')
            .eq('owner_id', ownerId)
            .single()

          if (availabilityData?.selected_slots) {
            setDraftAvailability(availabilityData.selected_slots)
          }
        } catch {
          // Table might not exist or no data yet
          setDraftAvailability([])
        }
      } catch (err) {
        console.error('Error loading team data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [ownerId])

  // Update contract decision (keep/cut)
  const updateContractDecision = async (contractId: string, decision: string) => {
    if (!isOwnTeam) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('salarycap_contracts')
        .update({ offseason_decision: decision })
        .eq('id', contractId)

      if (error) throw error

      setContracts(prev => prev.map(c =>
        c.id === contractId ? { ...c, offseason_decision: decision } : c
      ))
    } catch (err) {
      console.error('Error updating decision:', err)
      alert('Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  // Update free agent decision (sign/release)
  const updateFreeAgentDecision = async (faId: string, decision: string) => {
    if (!isOwnTeam) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('salarycap_free_agent_pickups')
        .update({ offseason_decision: decision })
        .eq('id', faId)

      if (error) throw error

      setFreeAgentPickups(prev => prev.map(fa =>
        fa.id === faId ? { ...fa, offseason_decision: decision } : fa
      ))
    } catch (err) {
      console.error('Error updating decision:', err)
      alert('Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  // Toggle draft availability slot
  const toggleDraftSlot = async (slotId: string) => {
    if (!isOwnTeam || !ownerId) return
    setSavingAvailability(true)
    const newSlots = draftAvailability.includes(slotId)
      ? draftAvailability.filter(s => s !== slotId)
      : [...draftAvailability, slotId]

    try {
      const { error } = await supabase
        .from('salarycap_draft_availability')
        .upsert({
          owner_id: ownerId,
          selected_slots: newSlots,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id' })

      if (error) throw error
      setDraftAvailability(newSlots)
    } catch (err) {
      console.error('Error saving availability:', err)
      alert('Failed to save availability')
    } finally {
      setSavingAvailability(false)
    }
  }

  // Handle franchise tag selection
  const selectFranchiseTag = async (contractId: string | null) => {
    if (!isOwnTeam) return
    setSaving(true)
    try {
      // First release all expired contracts
      for (const c of expiredContracts) {
        if (c.offseason_decision !== 'release') {
          await supabase
            .from('salarycap_contracts')
            .update({ offseason_decision: 'release' })
            .eq('id', c.id)
        }
      }

      // Then tag the selected one (if any)
      if (contractId) {
        await supabase
          .from('salarycap_contracts')
          .update({ offseason_decision: 'franchise_tag' })
          .eq('id', contractId)
      }

      setContracts(prev => prev.map(c => {
        if (c.contract_status !== 'expired') return c
        return c.id === contractId
          ? { ...c, offseason_decision: 'franchise_tag' }
          : { ...c, offseason_decision: 'release' }
      }))
    } catch (err) {
      console.error('Error updating franchise tag:', err)
      alert('Failed to save franchise tag selection')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SalaryCapLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </SalaryCapLayout>
    )
  }

  if (!owner) {
    return (
      <SalaryCapLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white mb-2">Team Not Found</h2>
          <Link to="/salarycap/teams" className="text-emerald-400 hover:text-emerald-300">
            View all teams
          </Link>
        </div>
      </SalaryCapLayout>
    )
  }

  const totalSalaryKept = underContract
    .filter(c => c.offseason_decision === 'keep' || c.offseason_decision === 'pending')
    .reduce((sum, c) => sum + c.salary, 0)

  // Franchise tag salary (from expired contracts being tagged)
  const franchiseTagSalary = expiredContracts
    .filter(c => c.offseason_decision === 'franchise_tag')
    .reduce((sum, c) => sum + getFranchiseTagCost(c.player?.position || '', c.salary), 0)

  // Free agent signing salary ($5 each)
  const freeAgentSigningSalary = freeAgentPickups
    .filter(fa => fa.offseason_decision === 'sign_fa')
    .length * 5

  // Total projected salary
  const totalProjectedSalary = totalSalaryKept + franchiseTagSalary + freeAgentSigningSalary

  // Dead cap from cuts made this offseason
  const deadCapFromCuts = underContract
    .filter(c => c.offseason_decision === 'cut')
    .reduce((sum, c) => sum + calculateDeadCap(c.salary, c.years_remaining), 0)

  // Dead cap from previous years (already in salarycap_dead_cap table)
  const deadCapFromPrevious = deadCap.reduce((sum, dc) => sum + dc.amount, 0)

  const totalDeadCap = deadCapFromCuts + deadCapFromPrevious

  // Bonus cap for 2026
  const totalBonusCap2026 = bonusCap.reduce((sum, bc) => sum + (bc.amount_2026 || 0), 0)

  const groupByPosition = <T extends { player: { position: string } }>(items: T[]) => {
    const groups: Record<string, T[]> = { QB: [], RB: [], WR: [], TE: [] }
    items.forEach(item => {
      const pos = item.player?.position || 'TE'
      if (groups[pos]) groups[pos].push(item)
    })
    return groups
  }

  const underContractByPos = groupByPosition(underContract)
  const expiredByPos = groupByPosition(expiredContracts)
  const faByPos = groupByPosition(sortedFreeAgentPickups)

  // Check completion status
  const allUnderContractDecided = underContract.every(c => c.offseason_decision !== 'pending')
  const franchiseTagDecided = expiredContracts.length === 0 ||
    expiredContracts.some(c => c.offseason_decision === 'franchise_tag') ||
    expiredContracts.every(c => c.offseason_decision === 'release')
  const allFreeAgentsDecided = freeAgentPickups.every(fa => fa.offseason_decision !== 'pending')

  return (
    <SalaryCapLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link to="/salarycap" className="text-sm text-slate-400 hover:text-white mb-2 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">{owner.owner_name}</h1>
            <p className="text-slate-400 mt-1">{settings?.current_season} Offseason</p>
          </div>
          {isOwnTeam && (
            <button
              onClick={() => {
                if (deadlinePassed) return
                const allComplete = allUnderContractDecided && franchiseTagDecided && allFreeAgentsDecided && draftAvailability.length > 0
                if (allComplete) {
                  alert('Your selections have been saved! You can return anytime to make changes before the deadline.')
                } else {
                  alert('Please complete all sections before submitting.')
                }
              }}
              disabled={deadlinePassed}
              className={`px-5 py-2.5 rounded-lg font-semibold transition ${
                deadlinePassed
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : allUnderContractDecided && franchiseTagDecided && allFreeAgentsDecided && draftAvailability.length > 0
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {deadlinePassed ? 'Deadline Passed' : saving || savingAvailability ? 'Saving...' : 'Submit Decisions'}
            </button>
          )}
        </div>

        {/* Checklist & Cap Chart - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Checklist Progress (Read-only) */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Offseason Progress</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  allUnderContractDecided ? 'bg-emerald-500' : 'bg-slate-700'
                }`}>
                  {allUnderContractDecided && <span className="text-white text-sm">✓</span>}
                </div>
                <span className={allUnderContractDecided ? 'text-emerald-400' : 'text-slate-300'}>
                  Contract Decisions ({underContract.filter(c => c.offseason_decision !== 'pending').length}/{underContract.length})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  franchiseTagDecided ? 'bg-emerald-500' : 'bg-slate-700'
                }`}>
                  {franchiseTagDecided && <span className="text-white text-sm">✓</span>}
                </div>
                <span className={franchiseTagDecided ? 'text-emerald-400' : 'text-slate-300'}>
                  Franchise Tag ({expiredContracts.length} eligible)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  allFreeAgentsDecided ? 'bg-emerald-500' : 'bg-slate-700'
                }`}>
                  {allFreeAgentsDecided && <span className="text-white text-sm">✓</span>}
                </div>
                <span className={allFreeAgentsDecided ? 'text-emerald-400' : 'text-slate-300'}>
                  Free Agent Pickups ({freeAgentPickups.filter(fa => fa.offseason_decision !== 'pending').length}/{freeAgentPickups.length})
                </span>
              </div>
              {isOwnTeam && (
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    draftAvailability.length > 0 ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}>
                    {draftAvailability.length > 0 && <span className="text-white text-sm">✓</span>}
                  </div>
                  <span className={draftAvailability.length > 0 ? 'text-emerald-400' : 'text-slate-300'}>
                    Draft Availability ({draftAvailability.length} slots selected)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Cap Donut Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 text-center">Projected 2026 Cap</h2>
            <CapDonutChart
              salaries={totalProjectedSalary}
              deadCap={totalDeadCap}
              bonusCap={totalBonusCap2026}
              totalCap={settings?.salary_cap || 400}
            />
          </div>
        </div>

        {/* ===== DRAFT AVAILABILITY (own team only) ===== */}
        {isOwnTeam && (
          <div className="bg-slate-800/50 border-2 border-emerald-500/50 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-emerald-500/20 border-b border-emerald-500/30">
              <h2 className="text-xl font-bold text-emerald-400">DRAFT AVAILABILITY</h2>
              <p className="text-sm text-slate-400 mt-1">Select ALL dates/times you're available for the in-person draft</p>
            </div>

            <div className="p-4">
              {/* Calendar header */}
              <div className="text-center text-slate-400 text-sm font-medium mb-2">August 2025</div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {DRAFT_CALENDAR.map(day => {
                  const allSelected = day.slots.every(s => draftAvailability.includes(s.id))
                  const someSelected = day.slots.some(s => draftAvailability.includes(s.id))

                  return (
                    <div
                      key={day.day}
                      className={`rounded-lg border-2 overflow-hidden transition ${
                        allSelected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : someSelected
                            ? 'border-emerald-500/50 bg-slate-800'
                            : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      {/* Day header */}
                      <div className="text-center py-2 border-b border-slate-700/50">
                        <div className="text-xs text-slate-500 uppercase">{day.day}</div>
                        <div className="text-lg font-bold text-white">{day.date}</div>
                      </div>

                      {/* Time slots */}
                      <div className={`p-2 ${day.slots.length > 1 ? 'space-y-1' : ''}`}>
                        {day.slots.map(slot => {
                          const isSelected = draftAvailability.includes(slot.id)

                          return (
                            <button
                              key={slot.id}
                              onClick={() => toggleDraftSlot(slot.id)}
                              disabled={savingAvailability || deadlinePassed}
                              className={`w-full py-2 px-1 rounded text-xs font-medium transition ${
                                deadlinePassed
                                  ? isSelected ? 'bg-emerald-500/50 text-white/70' : 'bg-slate-700/30 text-slate-500'
                                  : isSelected
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                              }`}
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
              <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                {draftAvailability.length === 0 ? (
                  <p className="text-amber-400 text-sm">Please select at least one available time slot</p>
                ) : (
                  <p className="text-emerald-400 text-sm">
                    {draftAvailability.length} time slot{draftAvailability.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== UNDER CONTRACT ===== */}
        <div className="bg-slate-800/50 border-2 border-blue-500/50 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-500/20 border-b border-blue-500/30">
            <h2 className="text-xl font-bold text-blue-400">UNDER CONTRACT ({underContract.length})</h2>
            {isOwnTeam && (
              <p className="text-sm text-slate-400 mt-1">These players are signed for 2026. Decide: Keep or Cut (cutting incurs dead cap)</p>
            )}
          </div>

          {underContract.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No players under contract</div>
          ) : (
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2 pl-2">Pos</th>
                    <th className="pb-2">Player</th>
                    <th className="pb-2 text-right">Salary</th>
                    <th className="pb-2 text-right">Contract</th>
                    <th className="pb-2 text-right">Dead Cap</th>
                    <th className="pb-2 text-right pr-2">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {POSITION_ORDER.map(pos => (
                    underContractByPos[pos]?.map((contract, idx) => (
                      <tr key={contract.id} className={`border-t border-slate-700 ${idx === 0 && pos !== 'QB' ? 'border-t-2 border-slate-600' : ''}`}>
                        <td className="py-2 pl-2">
                          <PositionBadge position={contract.player?.position || ''} size="sm" />
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar
                              sleeperId={contract.player?.sleeper_player_id}
                              name={contract.player?.name || ''}
                            />
                            <span className="text-white font-medium">{contract.player?.name}</span>
                            {contract.player?.nfl_team && (
                              <span className="text-xs text-slate-500">{contract.player.nfl_team}</span>
                            )}
                            {contract.player?.is_rookie && <RookieBadge />}
                          </div>
                        </td>
                        <td className="py-2 text-right text-emerald-400 font-medium">${contract.salary}</td>
                        <td className="py-2 text-right">
                          <YearsDots years={contract.years_remaining} />
                        </td>
                        <td className="py-2 text-right text-red-400">${calculateDeadCap(contract.salary, contract.years_remaining)}</td>
                        <td className="py-2 text-right pr-2">
                          {canEdit ? (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => updateContractDecision(contract.id, 'keep')}
                                disabled={saving}
                                className={`px-2 py-1 rounded text-xs font-medium transition ${
                                  contract.offseason_decision === 'keep'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                Keep
                              </button>
                              <button
                                onClick={() => updateContractDecision(contract.id, 'cut')}
                                disabled={saving}
                                className={`px-2 py-1 rounded text-xs font-medium transition ${
                                  contract.offseason_decision === 'cut'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                Cut
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              contract.offseason_decision === 'keep' ? 'bg-emerald-500/20 text-emerald-400' :
                              contract.offseason_decision === 'cut' ? 'bg-red-500/20 text-red-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {contract.offseason_decision === 'keep' ? 'Keep' :
                               contract.offseason_decision === 'cut' ? 'Cut' : 'Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== FRANCHISE TAG ELIGIBLE ===== */}
        <div className="bg-slate-800/50 border-2 border-amber-500/50 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-amber-500/20 border-b border-amber-500/30">
            <h2 className="text-xl font-bold text-amber-400">FRANCHISE TAG ({expiredContracts.length} eligible)</h2>
            {isOwnTeam && (
              <p className="text-sm text-slate-400 mt-1">Select ONE player to franchise tag, or choose none. All others go to auction.</p>
            )}
          </div>

          {expiredContracts.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No players with expired contracts</div>
          ) : canEdit ? (
            // Interactive selection for own team
            <div className="p-4 space-y-2">
              {/* No tag option */}
              <button
                onClick={() => selectFranchiseTag(null)}
                disabled={saving}
                className={`w-full p-3 rounded-lg border-2 transition flex items-center gap-3 ${
                  expiredContracts.every(c => c.offseason_decision === 'release')
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  expiredContracts.every(c => c.offseason_decision === 'release')
                    ? 'border-amber-500 bg-amber-500'
                    : 'border-slate-500'
                }`}>
                  {expiredContracts.every(c => c.offseason_decision === 'release') && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-slate-300 font-medium">No franchise tag (release all to auction)</span>
              </button>

              {/* Player options */}
              {POSITION_ORDER.map(pos => (
                expiredByPos[pos]?.map(contract => {
                  const isSelected = contract.offseason_decision === 'franchise_tag'
                  const canTag = !contract.is_franchise_tagged
                  const tagCost = getFranchiseTagCost(contract.player?.position || '', contract.salary)

                  return (
                    <button
                      key={contract.id}
                      onClick={() => canTag && selectFranchiseTag(contract.id)}
                      disabled={saving || !canTag}
                      className={`w-full p-3 rounded-lg border-2 transition flex items-center gap-3 ${
                        !canTag
                          ? 'border-slate-800 opacity-50 cursor-not-allowed'
                          : isSelected
                            ? 'border-amber-500 bg-amber-500/20'
                            : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-amber-500 bg-amber-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <PositionBadge position={contract.player?.position || ''} size="sm" />
                      <PlayerAvatar
                        sleeperId={contract.player?.sleeper_player_id}
                        name={contract.player?.name || ''}
                      />
                      <span className="text-white font-medium flex-1 text-left">
                        {contract.player?.name}
                        {contract.player?.nfl_team && (
                          <span className="ml-2 text-xs text-slate-500">{contract.player.nfl_team}</span>
                        )}
                      </span>
                      {contract.is_franchise_tagged && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                          Can't tag (tagged last year)
                        </span>
                      )}
                      <span className="text-amber-400 font-medium">${tagCost}</span>
                      {tagCost > contract.salary && (
                        <span className="text-xs text-slate-500">(was ${contract.salary})</span>
                      )}
                    </button>
                  )
                })
              ))}
            </div>
          ) : (
            // Read-only table for other teams
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2 pl-2">Pos</th>
                    <th className="pb-2">Player</th>
                    <th className="pb-2 text-right">Tag Cost</th>
                    <th className="pb-2 text-right pr-2">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {POSITION_ORDER.map(pos => (
                    expiredByPos[pos]?.map((contract, idx) => {
                      const tagCost = getFranchiseTagCost(contract.player?.position || '', contract.salary)
                      return (
                        <tr key={contract.id} className={`border-t border-slate-700 ${idx === 0 && pos !== 'QB' ? 'border-t-2 border-slate-600' : ''}`}>
                          <td className="py-2 pl-2">
                            <PositionBadge position={contract.player?.position || ''} size="sm" />
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar
                                sleeperId={contract.player?.sleeper_player_id}
                                name={contract.player?.name || ''}
                              />
                              <span className="text-white font-medium">{contract.player?.name}</span>
                              {contract.player?.nfl_team && (
                                <span className="text-xs text-slate-500">{contract.player.nfl_team}</span>
                              )}
                              {contract.player?.is_rookie && <RookieBadge />}
                            </div>
                          </td>
                          <td className="py-2 text-right text-amber-400">${tagCost}</td>
                          <td className="py-2 text-right pr-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              contract.offseason_decision === 'franchise_tag' ? 'bg-amber-500/20 text-amber-400' :
                              contract.offseason_decision === 'release' ? 'bg-red-500/20 text-red-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {contract.offseason_decision === 'franchise_tag' ? 'Tagged' :
                               contract.offseason_decision === 'release' ? 'Release' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== FREE AGENT PICKUPS ===== */}
        <div className="bg-slate-800/50 border-2 border-purple-500/50 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-purple-500/20 border-b border-purple-500/30">
            <h2 className="text-xl font-bold text-purple-400">FREE AGENT PICKUPS ({freeAgentPickups.length})</h2>
            {isOwnTeam && (
              <p className="text-sm text-slate-400 mt-1">Mid-season additions. Sign for $5 one-year deal or release to auction.</p>
            )}
          </div>

          {freeAgentPickups.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No free agent pickups</div>
          ) : (
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2 pl-2">Pos</th>
                    <th className="pb-2">Player</th>
                    <th className="pb-2 text-right">Cost if Signed</th>
                    <th className="pb-2 text-right pr-2">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {POSITION_ORDER.map(pos => (
                    faByPos[pos]?.map((fa, idx) => (
                      <tr key={fa.id} className={`border-t border-slate-700 ${idx === 0 && pos !== 'QB' ? 'border-t-2 border-slate-600' : ''}`}>
                        <td className="py-2 pl-2">
                          <PositionBadge position={fa.player?.position || ''} size="sm" />
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar
                              sleeperId={fa.player?.sleeper_player_id}
                              name={fa.player?.name || ''}
                            />
                            <span className="text-white font-medium">{fa.player?.name}</span>
                            {fa.player?.nfl_team && (
                              <span className="text-xs text-slate-500">{fa.player.nfl_team}</span>
                            )}
                            {fa.player?.is_rookie && <RookieBadge />}
                          </div>
                        </td>
                        <td className="py-2 text-right text-purple-400">$5</td>
                        <td className="py-2 text-right pr-2">
                          {canEdit ? (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => updateFreeAgentDecision(fa.id, 'sign_fa')}
                                disabled={saving}
                                className={`px-2 py-1 rounded text-xs font-medium transition ${
                                  fa.offseason_decision === 'sign_fa'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                Sign
                              </button>
                              <button
                                onClick={() => updateFreeAgentDecision(fa.id, 'release')}
                                disabled={saving}
                                className={`px-2 py-1 rounded text-xs font-medium transition ${
                                  fa.offseason_decision === 'release'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                Release
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              fa.offseason_decision === 'sign_fa' ? 'bg-purple-500/20 text-purple-400' :
                              fa.offseason_decision === 'release' ? 'bg-red-500/20 text-red-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {fa.offseason_decision === 'sign_fa' ? 'Sign' :
                               fa.offseason_decision === 'release' ? 'Release' : 'Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== DEAD CAP ===== */}
        {deadCap.length > 0 && (
          <div className="bg-slate-800/50 border-2 border-red-500/50 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-red-500/20 border-b border-red-500/30">
              <h2 className="text-xl font-bold text-red-400">DEAD CAP (${deadCapFromPrevious})</h2>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2 pl-2">Player</th>
                    <th className="pb-2 text-right">Original Contract</th>
                    <th className="pb-2 text-right">Drafted</th>
                    <th className="pb-2 text-right">Dead Cap/Year</th>
                    <th className="pb-2 text-right pr-2">Years Left</th>
                  </tr>
                </thead>
                <tbody>
                  {deadCap.map((dc) => (
                    <tr key={dc.id} className="border-t border-slate-700">
                      <td className="py-2 pl-2">
                        <span className="text-white font-medium">{dc.player_name}</span>
                      </td>
                      <td className="py-2 text-right text-slate-400">${dc.original_salary}</td>
                      <td className="py-2 text-right text-slate-400">{dc.drafted_year}</td>
                      <td className="py-2 text-right text-red-400 font-medium">${dc.amount}</td>
                      <td className="py-2 text-right pr-2">
                        <YearsDots years={dc.years_remaining} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== BONUS CAP ===== */}
        <div className="bg-slate-800/50 border-2 border-blue-500/50 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-500/20 border-b border-blue-500/30">
            <h2 className="text-xl font-bold text-blue-400">
              BONUS CAP {bonusCap.length > 0 && `(${formatBonusCap(totalBonusCap2026)})`}
            </h2>
          </div>

          {bonusCap.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No bonus cap transactions</div>
          ) : (
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2 pl-2">Counterparty</th>
                    <th className="pb-2 text-right">2026</th>
                    <th className="pb-2 text-right">2027</th>
                    <th className="pb-2 text-right">2028</th>
                    <th className="pb-2 text-right">2029</th>
                    <th className="pb-2 text-right pr-2">2030</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusCap.map((bc) => (
                    <tr key={bc.id} className="border-t border-slate-700">
                      <td className="py-2 pl-2">
                        <span className="text-white font-medium">{bc.corresponding_owner_name}</span>
                      </td>
                      <td className={`py-2 text-right font-medium ${bc.amount_2026 > 0 ? 'text-emerald-400' : bc.amount_2026 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatBonusCap(bc.amount_2026)}
                      </td>
                      <td className={`py-2 text-right font-medium ${bc.amount_2027 > 0 ? 'text-emerald-400' : bc.amount_2027 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatBonusCap(bc.amount_2027)}
                      </td>
                      <td className={`py-2 text-right font-medium ${bc.amount_2028 > 0 ? 'text-emerald-400' : bc.amount_2028 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatBonusCap(bc.amount_2028)}
                      </td>
                      <td className={`py-2 text-right font-medium ${bc.amount_2029 > 0 ? 'text-emerald-400' : bc.amount_2029 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatBonusCap(bc.amount_2029)}
                      </td>
                      <td className={`py-2 text-right pr-2 font-medium ${bc.amount_2030 > 0 ? 'text-emerald-400' : bc.amount_2030 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {formatBonusCap(bc.amount_2030)}
                      </td>
                    </tr>
                  ))}
                  {/* Net totals row */}
                  {(() => {
                    const net2027 = bonusCap.reduce((s, b) => s + (b.amount_2027 || 0), 0)
                    const net2028 = bonusCap.reduce((s, b) => s + (b.amount_2028 || 0), 0)
                    const net2029 = bonusCap.reduce((s, b) => s + (b.amount_2029 || 0), 0)
                    const net2030 = bonusCap.reduce((s, b) => s + (b.amount_2030 || 0), 0)
                    return (
                      <tr className="border-t-2 border-slate-600 bg-slate-800/50">
                        <td className="py-2 pl-2">
                          <span className="text-slate-400 font-semibold">Net Total</span>
                        </td>
                        <td className={`py-2 text-right font-bold ${totalBonusCap2026 > 0 ? 'text-emerald-400' : totalBonusCap2026 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatBonusCap(totalBonusCap2026)}
                        </td>
                        <td className={`py-2 text-right font-bold ${net2027 > 0 ? 'text-emerald-400' : net2027 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatBonusCap(net2027)}
                        </td>
                        <td className={`py-2 text-right font-bold ${net2028 > 0 ? 'text-emerald-400' : net2028 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatBonusCap(net2028)}
                        </td>
                        <td className={`py-2 text-right font-bold ${net2029 > 0 ? 'text-emerald-400' : net2029 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatBonusCap(net2029)}
                        </td>
                        <td className={`py-2 text-right pr-2 font-bold ${net2030 > 0 ? 'text-emerald-400' : net2030 < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatBonusCap(net2030)}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SalaryCapLayout>
  )
}
