import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { useAdminStats, useAdminUsers, useAdminEntries } from '../../hooks/useAdmin'
import { useLeagueSettings } from '../../hooks/useEntries'

// Default payout percentages based on number of spots
const DEFAULT_PAYOUTS: Record<number, number[]> = {
  4: [65, 20, 10, 5],
  5: [55, 20, 12, 8, 5],
  6: [50, 20, 12, 8, 6, 4],
  7: [45, 18, 12, 9, 7, 5, 4],
  8: [40, 18, 12, 9, 7, 6, 5, 3],
  9: [38, 17, 12, 9, 7, 6, 5, 4, 2],
  10: [35, 16, 12, 9, 7, 6, 5, 4, 3, 3],
}

export default function AdminDashboard() {
  const { stats, loading: statsLoading } = useAdminStats()
  const { users } = useAdminUsers()
  const { entries } = useAdminEntries()
  const { settings, updatePayoutSettings } = useLeagueSettings()

  // Payout calculator state
  const [commissionerFee, setCommissionerFee] = useState(0)
  const [payoutPercentages, setPayoutPercentages] = useState<number[]>([65, 20, 10, 5])
  const [payoutDollars, setPayoutDollars] = useState<number[]>([])
  const [useDollarMode, setUseDollarMode] = useState(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('payoutDollarMode')
    return saved === 'true'
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Load saved payout settings from database
  useEffect(() => {
    if (settings) {
      setCommissionerFee(settings.commissioner_fee || 0)
      if (settings.payout_percentages && settings.payout_percentages.length > 0) {
        setPayoutPercentages(settings.payout_percentages)
      }
    }
  }, [settings])

  // Get entries missing lineups for current week
  const missingLineups = entries.filter(e => {
    if (!stats) return false
    return e.lineups_submitted < stats.currentWeek
  })

  // Get unpaid users
  const unpaidUsers = users.filter(u => !u.payment_received && u.entry_count > 0)

  // Calculate payout spots
  const getPayoutSpots = (count: number) => {
    if (count >= 100) return 10
    if (count >= 90) return 9
    if (count >= 80) return 8
    if (count >= 70) return 7
    if (count >= 60) return 6
    if (count >= 50) return 5
    return 4
  }

  const payoutSpots = stats ? getPayoutSpots(stats.totalEntries) : 4
  const totalPot = stats ? stats.totalEntries * 25 : 0
  const netPrizePool = totalPot - commissionerFee

  // Update payout percentages when payout spots change (only if different from saved)
  useEffect(() => {
    // Only auto-set defaults if the current percentages don't match the spot count
    if (payoutPercentages.length !== payoutSpots) {
      setPayoutPercentages(DEFAULT_PAYOUTS[payoutSpots] || DEFAULT_PAYOUTS[4])
    }
  }, [payoutSpots, payoutPercentages.length])

  // Auto-save payout settings when they change
  const savePayoutSettings = useCallback(async (fee: number, percentages: number[]) => {
    setSaveStatus('saving')
    const { error } = await updatePayoutSettings(fee, percentages)
    if (error) {
      setSaveStatus('error')
      console.error('Failed to save payout settings:', error)
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [updatePayoutSettings])

  // Handle commissioner fee change
  const handleCommissionerFeeChange = (newFee: number) => {
    setCommissionerFee(newFee)
    savePayoutSettings(newFee, payoutPercentages)
  }

  // Handle direct percentage input change
  const handlePayoutChange = (index: number, newValue: number) => {
    const newPercentages = [...payoutPercentages]
    // Clamp newValue between 0 and 100
    newValue = Math.max(0, Math.min(100, newValue))
    newPercentages[index] = newValue
    setPayoutPercentages(newPercentages)
    // Also update dollar amounts to match
    setPayoutDollars(newPercentages.map(p => Math.round((netPrizePool * p) / 100)))
    savePayoutSettings(commissionerFee, newPercentages)
  }

  // Handle dollar amount input change
  const handleDollarChange = (index: number, newDollarValue: number) => {
    const newDollars = [...payoutDollars]
    newDollars[index] = Math.max(0, newDollarValue)
    setPayoutDollars(newDollars)

    // Calculate percentages from dollar amounts
    const newPercentages = newDollars.map(d =>
      netPrizePool > 0 ? Math.round((d / netPrizePool) * 10000) / 100 : 0
    )
    setPayoutPercentages(newPercentages)
    savePayoutSettings(commissionerFee, newPercentages)
  }

  // Initialize dollar amounts from percentages when netPrizePool changes
  useEffect(() => {
    if (netPrizePool > 0 && payoutPercentages.length > 0) {
      setPayoutDollars(payoutPercentages.map(p => Math.round((netPrizePool * p) / 100)))
    }
  }, [netPrizePool, payoutPercentages])

  // Calculate total and remaining percentage
  const totalPercentage = payoutPercentages.reduce((a, b) => a + b, 0)
  const remainingPercentage = 100 - totalPercentage

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-gray-600">Overview of Playoff Gauntlet</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-500">Total Users</div>
          <div className="text-3xl font-bold text-gray-900">
            {statsLoading ? '-' : stats?.totalUsers}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-500">Total Entries</div>
          <div className="text-3xl font-bold text-gray-900">
            {statsLoading ? '-' : stats?.totalEntries}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Top {payoutSpots} pay out
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-500">Prize Pool</div>
          <div className="text-3xl font-bold text-green-600">
            ${totalPot.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {stats?.usersPaid || 0}/{stats?.totalUsers || 0} users paid
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-500">Current Week</div>
          <div className="text-3xl font-bold text-blue-600">
            Week {statsLoading ? '-' : stats?.currentWeek}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {stats?.lineupsSubmitted}/{stats?.totalEntries} lineups submitted
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Payment Collection</h2>
            <Link to="/admin/users" className="text-sm text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>

          {(() => {
            const totalOwed = users.reduce((sum, u) => sum + (u.entry_count * 25), 0)
            const totalCollected = users.reduce((sum, u) => {
              // Calculate amount_paid based on payment_received for now
              // Once migration is run, this will use actual amount_paid
              return sum + (u.payment_received ? u.entry_count * 25 : 0)
            }, 0)
            const outstanding = totalOwed - totalCollected
            const percentCollected = totalOwed > 0 ? (totalCollected / totalOwed) * 100 : 0

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Collected</span>
                  <span className="font-semibold text-green-600">${totalCollected}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Outstanding</span>
                  <span className="font-semibold text-red-600">${outstanding}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Owed</span>
                  <span className="font-semibold text-gray-900">${totalOwed}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentCollected}%` }}
                  />
                </div>
                <div className="text-center text-sm text-gray-500">
                  {percentCollected.toFixed(0)}% collected
                </div>
              </div>
            )
          })()}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lineup Status</h2>
            <span className="text-sm text-gray-500">Week {stats?.currentWeek}</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Submitted</span>
              <span className="font-semibold text-green-600">
                {stats?.lineupsSubmitted || 0} entries
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Missing</span>
              <span className="font-semibold text-yellow-600">
                {stats?.lineupsMissing || 0} entries
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: stats?.totalEntries
                    ? `${(stats.lineupsSubmitted / stats.totalEntries) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payout Calculator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Payout Calculator</h2>
          {saveStatus !== 'idle' && (
            <span className={`text-sm ${
              saveStatus === 'saving' ? 'text-gray-500' :
              saveStatus === 'saved' ? 'text-green-600' :
              'text-red-600'
            }`}>
              {saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'saved' ? 'Saved!' :
               'Error saving'}
            </span>
          )}
        </div>

        {/* Commissioner Fee */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Commissioner Fee</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={commissionerFee}
                onChange={(e) => handleCommissionerFeeChange(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="5"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total Prize Pool</span>
            <span className="font-medium text-gray-900">${totalPot.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-500">Net Prize Pool (after fee)</span>
            <span className="font-bold text-green-600">${netPrizePool.toLocaleString()}</span>
          </div>
        </div>

        {/* Payout Distribution */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Payout Distribution ({payoutSpots} spots)</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    setUseDollarMode(false)
                    localStorage.setItem('payoutDollarMode', 'false')
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    !useDollarMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => {
                    setUseDollarMode(true)
                    localStorage.setItem('payoutDollarMode', 'true')
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    useDollarMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  $
                </button>
              </div>
            </div>
            {(() => {
              const totalDollars = payoutDollars.reduce((a, b) => a + b, 0)
              const remainingDollars = netPrizePool - totalDollars
              const isFullyAllocated = useDollarMode
                ? Math.abs(remainingDollars) < 1
                : Math.abs(remainingPercentage) < 0.1

              return (
                <div className={`text-sm font-medium ${
                  isFullyAllocated ? 'text-green-600' :
                  (useDollarMode ? remainingDollars > 0 : remainingPercentage > 0) ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {isFullyAllocated ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {useDollarMode ? 'Fully Allocated' : '100% Allocated'}
                    </span>
                  ) : useDollarMode ? (
                    remainingDollars > 0
                      ? `$${remainingDollars.toLocaleString()} remaining to allocate`
                      : `$${Math.abs(remainingDollars).toLocaleString()} over allocation`
                  ) : (
                    remainingPercentage > 0
                      ? `${remainingPercentage.toFixed(1)}% remaining to allocate`
                      : `${Math.abs(remainingPercentage).toFixed(1)}% over allocation`
                  )}
                </div>
              )
            })()}
          </div>

          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Place</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    {useDollarMode ? 'Amount' : 'Percentage'}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    {useDollarMode ? 'Percentage' : 'Payout'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payoutPercentages.map((percentage, index) => {
                  const dollarAmount = payoutDollars[index] ?? Math.round((netPrizePool * percentage) / 100)
                  const ordinalSuffix = (n: number) => {
                    if (n === 1) return 'st'
                    if (n === 2) return 'nd'
                    if (n === 3) return 'rd'
                    return 'th'
                  }

                  return (
                    <tr key={index} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {index + 1}{ordinalSuffix(index + 1)} Place
                      </td>
                      <td className="px-4 py-3">
                        {useDollarMode ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-500">$</span>
                            <input
                              type="number"
                              value={dollarAmount}
                              onChange={(e) => handleDollarChange(index, parseInt(e.target.value) || 0)}
                              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="1"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              value={percentage}
                              onChange={(e) => handlePayoutChange(index, parseFloat(e.target.value) || 0)}
                              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              max="100"
                              step="0.1"
                            />
                            <span className="text-gray-500">%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {useDollarMode ? (
                          <span className="text-gray-500">{percentage.toFixed(1)}%</span>
                        ) : (
                          <span>${dollarAmount.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center">
                    {useDollarMode ? (
                      <span className={Math.abs(payoutDollars.reduce((a, b) => a + b, 0) - netPrizePool) < 1 ? 'text-green-600' : 'text-red-600'}>
                        ${payoutDollars.reduce((a, b) => a + b, 0).toLocaleString()}
                      </span>
                    ) : (
                      <span className={totalPercentage === 100 ? 'text-green-600' : 'text-red-600'}>
                        {totalPercentage.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {useDollarMode ? (
                      <span className="text-gray-500">{totalPercentage.toFixed(1)}%</span>
                    ) : (
                      <span>${netPrizePool.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Commissioner Fee in Summary */}
        {commissionerFee > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
            <span className="text-gray-500">Commissioner Fee (deducted from prize pool)</span>
            <span className="font-medium text-gray-700">${commissionerFee.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Unpaid Users */}
      {unpaidUsers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Unpaid Users ({unpaidUsers.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {unpaidUsers.slice(0, 10).map(user => (
              <Link
                key={user.id}
                to={`/admin/user/${user.id}`}
                className="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium text-gray-900">{user.display_name}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-gray-600">{user.email}</span>
                  <span className="text-gray-400 text-sm ml-2">({user.entry_count} entries)</span>
                </div>
                <span className="text-sm text-red-600">${user.entry_count * 25} owed</span>
              </Link>
            ))}
            {unpaidUsers.length > 10 && (
              <div className="px-6 py-3 text-center">
                <Link to="/admin/users" className="text-blue-600 hover:text-blue-700 text-sm">
                  View all {unpaidUsers.length} unpaid users
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Missing Lineups */}
      {missingLineups.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Missing Lineups for Week {stats?.currentWeek} ({missingLineups.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {missingLineups.slice(0, 10).map(entry => (
              <Link
                key={entry.id}
                to={`/admin/user/${entry.user_id}`}
                className="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium text-gray-900">{entry.entry_name}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-gray-600">{entry.display_name}</span>
                  <span className="text-gray-400 text-sm ml-2">({entry.email})</span>
                </div>
                <span className="text-sm text-yellow-600">No lineup</span>
              </Link>
            ))}
            {missingLineups.length > 10 && (
              <div className="px-6 py-3 text-center">
                <Link to="/admin/users" className="text-blue-600 hover:text-blue-700 text-sm">
                  View all {missingLineups.length} missing lineups
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
