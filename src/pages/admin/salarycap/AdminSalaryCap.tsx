import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../../components/AdminLayout'
import { supabase } from '../../../lib/supabase'

interface PendingPlayer {
  id: string
  name: string
  position: string
  salary?: number
  years_remaining?: number
}

interface OwnerProgress {
  owner_id: string
  owner_name: string
  sleeper_display_name: string

  // Active contracts (keep/cut)
  active_total: number
  active_decided: number
  active_pending: PendingPlayer[]

  // Franchise tag
  tag_eligible_count: number
  has_tagged: boolean
  tag_decision: 'pending' | 'tagged' | 'skipped'
  tag_pending_players: PendingPlayer[]

  // FA pickups ($5 keepers)
  fa_total: number
  fa_decided: number
  fa_pending: PendingPlayer[]

  // Draft availability
  draft_slots: string[]
}

interface ImportStats {
  owners?: number
  players?: number
  contracts?: number
  roster_assignments?: number
  under_contract?: number
  expired_contract?: number
  free_agent_pickup?: number
}

interface ContractRow {
  id: string
  owner_id: string
  contract_status: string
  offseason_decision: string
  is_franchise_tagged: boolean
  salary: number
  years_remaining: number
  player: { id: string; name: string; position: string } | null
}

interface FAPickupRow {
  id: string
  owner_id: string
  offseason_decision: string
  player: { id: string; name: string; position: string } | null
}

interface OwnerRow {
  id: string
  owner_name: string
  sleeper_display_name: string
  franchise_tag_decision: string | null
}

// Draft availability time slots
const DRAFT_SLOTS = [
  { id: 'tue_19_pm', label: 'Tue 8/18', time: 'PM', shortLabel: 'Tue PM' },
  { id: 'wed_20_pm', label: 'Wed 8/19', time: 'PM', shortLabel: 'Wed PM' },
  { id: 'thu_21_pm', label: 'Thu 8/20', time: 'PM', shortLabel: 'Thu PM' },
  { id: 'fri_22_pm', label: 'Fri 8/21', time: 'PM', shortLabel: 'Fri PM' },
  { id: 'sat_23_am', label: 'Sat 8/22', time: 'AM', shortLabel: 'Sat AM' },
  { id: 'sat_23_mid', label: 'Sat 8/22', time: 'Mid', shortLabel: 'Sat Mid' },
  { id: 'sat_23_pm', label: 'Sat 8/22', time: 'PM', shortLabel: 'Sat PM' },
  { id: 'sun_24_mid', label: 'Sun 8/23', time: 'Mid', shortLabel: 'Sun Mid' },
  { id: 'sun_24_pm', label: 'Sun 8/23', time: 'PM', shortLabel: 'Sun PM' },
  { id: 'mon_25_pm', label: 'Mon 8/24', time: 'PM', shortLabel: 'Mon PM' },
]

export default function AdminSalaryCap() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [syncStats, setSyncStats] = useState<ImportStats | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [finalizeResult, setFinalizeResult] = useState<{ success: boolean; message: string; results?: Record<string, number> } | null>(null)
  const [ownerProgress, setOwnerProgress] = useState<OwnerProgress[]>([])
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null)

  const apiBase = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Fetch owners with franchise tag decision
      const { data: ownersData, error: ownersError } = await supabase
        .from('salarycap_owners')
        .select('id, owner_name, sleeper_display_name, franchise_tag_decision')
        .order('owner_name') as { data: OwnerRow[] | null; error: unknown }

      if (ownersError) console.error('Error fetching owners:', ownersError)

      // Fetch all contracts with player info
      const { data: contractsData, error: contractsError } = await supabase
        .from('salarycap_contracts')
        .select(`
          id,
          owner_id,
          contract_status,
          offseason_decision,
          is_franchise_tagged,
          salary,
          years_remaining,
          player:salarycap_players(id, name, position)
        `) as { data: ContractRow[] | null; error: unknown }

      if (contractsError) console.error('Error fetching contracts:', contractsError)
      console.log('Contracts loaded:', contractsData?.length || 0)

      // Fetch all FA pickups with player info
      const { data: faPickupsData, error: faError } = await supabase
        .from('salarycap_free_agent_pickups')
        .select(`
          id,
          owner_id,
          offseason_decision,
          player:salarycap_players(id, name, position)
        `) as { data: FAPickupRow[] | null; error: unknown }

      if (faError) console.error('Error fetching FA pickups:', faError)
      console.log('FA pickups loaded:', faPickupsData?.length || 0)

      // Fetch draft availability
      const { data: availData } = await supabase
        .from('salarycap_draft_availability')
        .select('owner_id, selected_slots')

      const availMap: Record<string, string[]> = {}
      availData?.forEach(a => {
        availMap[a.owner_id] = a.selected_slots || []
      })
      setAvailability(availMap)

      // Build progress for each owner
      const progress: OwnerProgress[] = (ownersData || []).map(owner => {
        // Active contracts (contract_status = 'active')
        const activeContracts = (contractsData || []).filter(
          c => c.owner_id === owner.id && c.contract_status === 'active'
        )
        const activeDecided = activeContracts.filter(c => c.offseason_decision !== 'pending').length
        const activePending = activeContracts
          .filter(c => c.offseason_decision === 'pending')
          .map(c => ({
            id: c.id,
            name: c.player?.name || 'Unknown',
            position: c.player?.position || '?',
            salary: c.salary,
            years_remaining: c.years_remaining
          }))

        // Expired contracts (franchise tag eligible)
        const expiredContracts = (contractsData || []).filter(
          c => c.owner_id === owner.id && c.contract_status === 'expired'
        )
        const hasTagged = expiredContracts.some(c => c.is_franchise_tagged)
        const tagPendingPlayers = expiredContracts
          .filter(c => !c.is_franchise_tagged)
          .map(c => ({
            id: c.id,
            name: c.player?.name || 'Unknown',
            position: c.player?.position || '?',
            salary: c.salary,
            years_remaining: c.years_remaining
          }))

        // FA pickups
        const faPickups = (faPickupsData || []).filter(p => p.owner_id === owner.id)
        const faDecided = faPickups.filter(p => p.offseason_decision !== 'pending').length
        const faPending = faPickups
          .filter(p => p.offseason_decision === 'pending')
          .map(p => ({
            id: p.id,
            name: p.player?.name || 'Unknown',
            position: p.player?.position || '?'
          }))

        return {
          owner_id: owner.id,
          owner_name: owner.owner_name,
          sleeper_display_name: owner.sleeper_display_name,
          active_total: activeContracts.length,
          active_decided: activeDecided,
          active_pending: activePending,
          tag_eligible_count: expiredContracts.length,
          has_tagged: hasTagged,
          tag_decision: hasTagged ? 'tagged' : (owner.franchise_tag_decision || 'pending') as 'pending' | 'tagged' | 'skipped',
          tag_pending_players: tagPendingPlayers,
          fa_total: faPickups.length,
          fa_decided: faDecided,
          fa_pending: faPending,
          draft_slots: availMap[owner.id] || []
        }
      })

      setOwnerProgress(progress)

    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchSleeper = async () => {
    setSyncing('sleeper')
    setSyncMessage(null)
    setSyncStats(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=fetch-sleeper`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setSyncMessage({ type: 'success', text: data.message })
        setSyncStats(data.stats)
        loadData() // Refresh the page data
      } else {
        setSyncMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to fetch Sleeper data' })
    } finally {
      setSyncing(null)
    }
  }

  const handleSyncContracts = async () => {
    setSyncing('sheets')
    setSyncMessage(null)
    setSyncStats(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=sync-contracts`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setSyncMessage({ type: 'success', text: data.message })
        setSyncStats(data.stats)
      } else {
        setSyncMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setSyncMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to sync contracts' })
    } finally {
      setSyncing(null)
    }
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    setFinalizeResult(null)
    try {
      const response = await fetch('/api/salarycap-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      setFinalizeResult(data)
      setShowConfirm(false)
    } catch (err) {
      setFinalizeResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setFinalizing(false)
    }
  }

  // Calculate slot popularity (sorted by count for "Best Times" section)
  const slotCounts = DRAFT_SLOTS.map(slot => {
    const count = Object.values(availability).filter(slots => slots.includes(slot.id)).length
    return { ...slot, count }
  }).sort((a, b) => b.count - a.count)

  // Calendar order (not sorted) for heat map display
  const slotCountsCalendar = DRAFT_SLOTS.map(slot => {
    const count = Object.values(availability).filter(slots => slots.includes(slot.id)).length
    return { ...slot, count }
  })

  // Helper for heat map color based on count
  const getHeatColor = (count: number) => {
    if (count >= 10) return 'bg-emerald-500 text-white'
    if (count >= 8) return 'bg-emerald-400 text-white'
    if (count >= 6) return 'bg-amber-400 text-white'
    if (count >= 4) return 'bg-amber-300 text-gray-800'
    if (count >= 2) return 'bg-red-300 text-gray-800'
    return 'bg-red-200 text-gray-600'
  }

  // Calculate summary stats
  const completedCount = ownerProgress.filter(o => {
    const contractsComplete = o.active_total === 0 || o.active_decided === o.active_total
    const tagComplete = o.tag_decision === 'tagged' || o.tag_decision === 'skipped' || o.tag_eligible_count === 0
    const faComplete = o.fa_total === 0 || o.fa_decided === o.fa_total
    const draftComplete = o.draft_slots.length > 0
    return contractsComplete && tagComplete && faComplete && draftComplete
  }).length
  const respondedCount = Object.keys(availability).length

  // Helper function for fraction color
  const getFractionColor = (decided: number, total: number) => {
    if (total === 0) return 'text-gray-400'
    if (decided === total) return 'text-emerald-600'
    if (decided > 0) return 'text-amber-600'
    return 'text-red-600'
  }

  // Helper function for fraction background
  const getFractionBg = (decided: number, total: number) => {
    if (total === 0) return 'bg-gray-50'
    if (decided === total) return 'bg-emerald-50'
    if (decided > 0) return 'bg-amber-50'
    return 'bg-red-50'
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Cap Admin</h1>
            <p className="text-gray-600 mt-1">Manage data sync, track offseason progress, and finalize rosters</p>
          </div>
          <Link
            to="/admin/salarycap/auction"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
          >
            Auction Admin
          </Link>
        </div>

        {/* Data Sync Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Sync</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleFetchSleeper}
              disabled={syncing !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {syncing === 'sleeper' ? 'Syncing...' : 'Sync from Sleeper'}
            </button>
            <button
              onClick={handleSyncContracts}
              disabled={syncing !== null}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
            >
              {syncing === 'sheets' ? 'Syncing...' : 'Sync from Sheets'}
            </button>
          </div>

          {syncMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              syncMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {syncMessage.text}
            </div>
          )}

          {syncStats && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {syncStats.owners !== undefined && <div><span className="font-medium">{syncStats.owners}</span> owners</div>}
              {syncStats.players !== undefined && <div><span className="font-medium">{syncStats.players}</span> players</div>}
              {syncStats.contracts !== undefined && <div><span className="font-medium">{syncStats.contracts}</span> contracts</div>}
              {syncStats.under_contract !== undefined && <div><span className="font-medium text-blue-600">{syncStats.under_contract}</span> under contract</div>}
              {syncStats.expired_contract !== undefined && <div><span className="font-medium text-amber-600">{syncStats.expired_contract}</span> expired</div>}
              {syncStats.free_agent_pickup !== undefined && <div><span className="font-medium text-purple-600">{syncStats.free_agent_pickup}</span> FA pickups</div>}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-emerald-600">{completedCount}/{ownerProgress.length}</div>
            <div className="text-sm text-gray-500">Offseason Complete</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-blue-600">{respondedCount}/{ownerProgress.length}</div>
            <div className="text-sm text-gray-500">Draft Availability</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-purple-600">{slotCounts[0]?.count || 0}</div>
            <div className="text-sm text-gray-500">Best: {slotCounts[0]?.shortLabel || 'N/A'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-amber-600">{ownerProgress.length - completedCount}</div>
            <div className="text-sm text-gray-500">Teams Pending</div>
          </div>
        </div>

        {/* Team Completion Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Team Status</h2>
            <p className="text-sm text-gray-500 mt-1">Click a row to see pending players</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Contracts</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tag</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">FAs</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Draft</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ownerProgress.map(owner => {
                  const isExpanded = expandedOwner === owner.owner_id
                  const hasPending = owner.active_pending.length > 0 ||
                    owner.fa_pending.length > 0 ||
                    (owner.tag_decision === 'pending' && owner.tag_eligible_count > 0)

                  // Calculate overall status
                  const contractsComplete = owner.active_total === 0 || owner.active_decided === owner.active_total
                  const tagComplete = owner.tag_decision === 'tagged' || owner.tag_decision === 'skipped' || owner.tag_eligible_count === 0
                  const faComplete = owner.fa_total === 0 || owner.fa_decided === owner.fa_total
                  const draftComplete = owner.draft_slots.length > 0
                  const allComplete = contractsComplete && tagComplete && faComplete && draftComplete

                  return (
                    <>
                      <tr
                        key={owner.owner_id}
                        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => setExpandedOwner(isExpanded ? null : owner.owner_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {hasPending && (
                              <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{owner.owner_name}</div>
                              <div className="text-xs text-gray-500">@{owner.sleeper_display_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {owner.active_total === 0 ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getFractionBg(owner.active_decided, owner.active_total)} ${getFractionColor(owner.active_decided, owner.active_total)}`}>
                              {owner.active_decided}/{owner.active_total}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {owner.tag_eligible_count === 0 ? (
                            <span className="text-gray-400">-</span>
                          ) : owner.tag_decision === 'tagged' ? (
                            <span className="px-2 py-1 rounded text-sm font-medium bg-emerald-50 text-emerald-600">Tagged</span>
                          ) : owner.tag_decision === 'skipped' ? (
                            <span className="px-2 py-1 rounded text-sm font-medium bg-blue-50 text-blue-600">Skipped</span>
                          ) : (
                            <span className="px-2 py-1 rounded text-sm font-medium bg-amber-50 text-amber-600">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {owner.fa_total === 0 ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getFractionBg(owner.fa_decided, owner.fa_total)} ${getFractionColor(owner.fa_decided, owner.fa_total)}`}>
                              {owner.fa_decided}/{owner.fa_total}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {draftComplete ? (
                            <span className="text-emerald-600 text-lg">✓</span>
                          ) : (
                            <span className="text-gray-300 text-lg">○</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {allComplete ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              Complete
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {isExpanded && hasPending && (
                        <tr key={`${owner.owner_id}-details`} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="pl-8 space-y-3 text-sm">
                              {owner.active_pending.length > 0 && (
                                <div>
                                  <div className="font-medium text-gray-700 mb-1">Pending Contract Decisions:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {owner.active_pending.map(p => (
                                      <span key={p.id} className="inline-flex items-center px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
                                        <span className="text-xs text-gray-500 mr-1">{p.position}</span>
                                        {p.name}
                                        {p.salary && <span className="ml-1 text-xs text-gray-400">${p.salary}</span>}
                                        {p.years_remaining && <span className="ml-1 text-xs text-gray-400">({p.years_remaining}yr)</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {owner.tag_decision === 'pending' && owner.tag_pending_players.length > 0 && (
                                <div>
                                  <div className="font-medium text-gray-700 mb-1">Tag-Eligible Players:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {owner.tag_pending_players.map(p => (
                                      <span key={p.id} className="inline-flex items-center px-2 py-1 bg-white border border-amber-200 rounded text-amber-700">
                                        <span className="text-xs text-amber-500 mr-1">{p.position}</span>
                                        {p.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {owner.fa_pending.length > 0 && (
                                <div>
                                  <div className="font-medium text-gray-700 mb-1">Pending FA Pickups:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {owner.fa_pending.map(p => (
                                      <span key={p.id} className="inline-flex items-center px-2 py-1 bg-white border border-purple-200 rounded text-purple-700">
                                        <span className="text-xs text-purple-500 mr-1">{p.position}</span>
                                        {p.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Draft Availability Heat Map */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Draft Availability</h2>
            <p className="text-sm text-gray-500 mt-1">Calendar view - numbers show how many owners are available</p>
          </div>
          <div className="grid grid-cols-10 gap-2">
            {slotCountsCalendar.map(slot => (
              <div key={slot.id} className="text-center">
                <div className="text-xs font-medium text-gray-500 mb-1">{slot.label.split(' ')[0]}</div>
                <div className="text-xs text-gray-400 mb-2">{slot.time}</div>
                <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-2xl font-bold ${getHeatColor(slot.count)}`}>
                  {slot.count}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-500"></div>
              <span>10+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-400"></div>
              <span>8-9</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-amber-400"></div>
              <span>6-7</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-amber-300"></div>
              <span>4-5</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-300"></div>
              <span>2-3</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-200"></div>
              <span>0-1</span>
            </div>
          </div>
        </div>

        {/* Best Slots Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Best Draft Times</h2>
          <div className="space-y-3">
            {slotCounts.slice(0, 5).map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  idx === 0 ? 'bg-emerald-100 text-emerald-700' :
                  idx === 1 ? 'bg-blue-100 text-blue-700' :
                  idx === 2 ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{slot.label} {slot.time}</div>
                  <div className="text-sm text-gray-500">
                    {slot.count} owner{slot.count !== 1 ? 's' : ''} available
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  slot.count >= 10 ? 'text-emerald-600' :
                  slot.count >= 8 ? 'text-blue-600' :
                  slot.count >= 6 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {Math.round((slot.count / ownerProgress.length) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lock & Finalize Section */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-red-800">Lock Rosters & Finalize Offseason</h2>
              <p className="text-sm text-red-600 mt-1">
                This action is <strong>irreversible</strong>. It will lock all rosters and execute all pending decisions.
              </p>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={finalizing}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              {finalizing ? 'Finalizing...' : 'Lock & Finalize'}
            </button>
          </div>

          {showConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Lock Rosters & Finalize?</h3>
                <p className="text-gray-600 mb-6">
                  This will <strong>permanently lock all rosters</strong> and execute every team's offseason decisions.
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFinalize}
                    disabled={finalizing}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {finalizing ? 'Finalizing...' : 'Yes, Lock & Finalize'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {finalizeResult && (
            <div className={`mt-4 p-4 rounded-lg ${finalizeResult.success ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <div className={`font-semibold ${finalizeResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {finalizeResult.message}
              </div>
              {finalizeResult.results && (
                <div className="mt-2 text-sm text-gray-700 grid grid-cols-2 gap-2">
                  <div>Contracts cut: {finalizeResult.results.contractsCut}</div>
                  <div>Dead cap entries: {finalizeResult.results.deadCapCreated}</div>
                  <div>Franchise tags: {finalizeResult.results.franchiseTagsApplied}</div>
                  <div>Expired released: {finalizeResult.results.expiredContractsReleased}</div>
                  <div>FAs signed: {finalizeResult.results.freeAgentsSigned}</div>
                  <div>FAs released: {finalizeResult.results.freeAgentsReleased}</div>
                  <div>Contracts kept: {finalizeResult.results.contractsKept}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
