import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../../components/AdminLayout'
import { supabase } from '../../../lib/supabase'

interface Owner {
  id: string
  owner_name: string
  sleeper_username: string
}

interface OffseasonStatus {
  owner_id: string
  cuts_completed: boolean
  franchise_tag_completed: boolean
  free_agents_completed: boolean
  all_completed: boolean
}

// Draft availability time slots
const DRAFT_SLOTS = [
  { id: 'tue_18_pm', label: 'Tue 8/18', time: 'PM', shortLabel: 'Tue PM' },
  { id: 'wed_19_pm', label: 'Wed 8/19', time: 'PM', shortLabel: 'Wed PM' },
  { id: 'thu_20_pm', label: 'Thu 8/20', time: 'PM', shortLabel: 'Thu PM' },
  { id: 'fri_21_pm', label: 'Fri 8/21', time: 'PM', shortLabel: 'Fri PM' },
  { id: 'sat_22_am', label: 'Sat 8/22', time: 'AM', shortLabel: 'Sat AM' },
  { id: 'sat_22_mid', label: 'Sat 8/22', time: 'Mid', shortLabel: 'Sat Mid' },
  { id: 'sat_22_pm', label: 'Sat 8/22', time: 'PM', shortLabel: 'Sat PM' },
  { id: 'sun_23_mid', label: 'Sun 8/23', time: 'Mid', shortLabel: 'Sun Mid' },
  { id: 'sun_23_pm', label: 'Sun 8/23', time: 'PM', shortLabel: 'Sun PM' },
  { id: 'mon_24_pm', label: 'Mon 8/24', time: 'PM', shortLabel: 'Mon PM' },
]

export default function AdminSalaryCapOffseason() {
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [finalizeResult, setFinalizeResult] = useState<{ success: boolean; message: string; results?: Record<string, number> } | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [statuses, setStatuses] = useState<Record<string, OffseasonStatus>>({})
  const [availability, setAvailability] = useState<Record<string, string[]>>({})

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch all owners
        const { data: ownersData } = await supabase
          .from('salarycap_owners')
          .select('id, owner_name, sleeper_username')
          .order('owner_name')

        setOwners(ownersData || [])

        // Fetch all offseason statuses
        const { data: statusData } = await supabase
          .from('salarycap_offseason_status')
          .select('*')

        const statusMap: Record<string, OffseasonStatus> = {}
        statusData?.forEach(s => {
          statusMap[s.owner_id] = s
        })
        setStatuses(statusMap)

        // Fetch all draft availability
        const { data: availData } = await supabase
          .from('salarycap_draft_availability')
          .select('owner_id, selected_slots')

        const availMap: Record<string, string[]> = {}
        availData?.forEach(a => {
          availMap[a.owner_id] = a.selected_slots || []
        })
        setAvailability(availMap)

      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

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

  // Calculate slot popularity
  const slotCounts = DRAFT_SLOTS.map(slot => {
    const count = Object.values(availability).filter(slots => slots.includes(slot.id)).length
    return { ...slot, count }
  }).sort((a, b) => b.count - a.count)

  const completedCount = owners.filter(o => statuses[o.id]?.all_completed).length
  const respondedCount = Object.keys(availability).length

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
            <Link to="/admin/salarycap" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
              ← Back to Salary Cap Admin
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Offseason Tracking</h1>
            <p className="text-gray-600 mt-1">Track team completion status and draft availability</p>
          </div>
          <Link
            to="/admin/salarycap/auction"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
          >
            Auction Admin
          </Link>
        </div>

        {/* Lock & Finalize Section */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-red-800">Lock Rosters & Finalize Offseason</h2>
              <p className="text-sm text-red-600 mt-1">
                This action is <strong>irreversible</strong>. It will lock all rosters and execute all pending decisions:
              </p>
              <ul className="text-sm text-red-600 mt-2 list-disc list-inside space-y-1">
                <li><strong>Lock rosters</strong> - Owners can no longer make changes</li>
                <li>Cut players → dead cap created, contracts voided, players to auction</li>
                <li>Franchise tags → new 1-year contracts at tag cost</li>
                <li>Released expired contracts → players to auction</li>
                <li>Signed free agents → new $5 one-year contracts</li>
                <li>Released free agents → players to auction</li>
                <li>Kept contracts → years remaining decremented</li>
              </ul>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={finalizing}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              {finalizing ? 'Finalizing...' : 'Lock & Finalize'}
            </button>
          </div>

          {/* Confirmation Modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Lock Rosters & Finalize?</h3>
                <p className="text-gray-600 mb-6">
                  This will <strong>permanently lock all rosters</strong> and execute every team's offseason decisions.
                  Owners will no longer be able to make changes. This action cannot be undone.
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

          {/* Result Display */}
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

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-emerald-600">{completedCount}/{owners.length}</div>
            <div className="text-sm text-gray-500">Offseason Complete</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-blue-600">{respondedCount}/{owners.length}</div>
            <div className="text-sm text-gray-500">Draft Availability Submitted</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-purple-600">{slotCounts[0]?.count || 0}</div>
            <div className="text-sm text-gray-500">Best Slot: {slotCounts[0]?.shortLabel || 'N/A'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-3xl font-bold text-amber-600">{owners.length - completedCount}</div>
            <div className="text-sm text-gray-500">Teams Pending</div>
          </div>
        </div>

        {/* Team Completion Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Team Completion Status</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Contracts</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Franchise Tag</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Free Agents</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Draft Avail</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {owners.map(owner => {
                  const status = statuses[owner.id]
                  const avail = availability[owner.id] || []
                  const hasAvailability = avail.length > 0

                  return (
                    <tr key={owner.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{owner.owner_name}</div>
                        <div className="text-xs text-gray-500">@{owner.sleeper_username}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status?.cuts_completed ? (
                          <span className="text-emerald-600 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status?.franchise_tag_completed ? (
                          <span className="text-emerald-600 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status?.free_agents_completed ? (
                          <span className="text-emerald-600 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasAvailability ? (
                          <span className="text-emerald-600 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status?.all_completed && hasAvailability ? (
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Draft Availability Matrix */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Draft Availability</h2>
            <p className="text-sm text-gray-500 mt-1">Times available by owner (sorted by popularity)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">Owner</th>
                  {slotCounts.map(slot => (
                    <th key={slot.id} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      <div>{slot.label}</div>
                      <div className="text-gray-400">{slot.time}</div>
                      <div className={`mt-1 text-sm font-bold ${
                        slot.count >= 10 ? 'text-emerald-600' :
                        slot.count >= 8 ? 'text-blue-600' :
                        slot.count >= 6 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {slot.count}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {owners.map(owner => {
                  const ownerSlots = availability[owner.id] || []

                  return (
                    <tr key={owner.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{owner.owner_name}</div>
                      </td>
                      {slotCounts.map(slot => (
                        <td key={slot.id} className="px-2 py-2 text-center">
                          {ownerSlots.includes(slot.id) ? (
                            <span className="text-emerald-600 text-lg">✓</span>
                          ) : (
                            <span className="text-gray-200">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                    {slot.count < owners.length && (
                      <span className="text-gray-400">
                        {' '}({owners.filter(o => !(availability[o.id] || []).includes(slot.id)).map(o => o.owner_name).join(', ')} unavailable)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    slot.count >= 10 ? 'text-emerald-600' :
                    slot.count >= 8 ? 'text-blue-600' :
                    slot.count >= 6 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {Math.round((slot.count / owners.length) * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
