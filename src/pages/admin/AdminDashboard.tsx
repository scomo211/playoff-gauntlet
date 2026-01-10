import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { useAdminStats, useAdminUsers, useAdminEntries } from '../../hooks/useAdmin'
import { useLeagueSettings } from '../../hooks/useEntries'

// Default payout amounts in dollars based on number of spots
const DEFAULT_PAYOUTS: Record<number, number[]> = {
  4: [650, 200, 100, 50],
  5: [550, 200, 120, 80, 50],
  6: [500, 200, 120, 80, 60, 40],
  7: [450, 180, 120, 90, 70, 50, 40],
  8: [400, 180, 120, 90, 70, 60, 50, 30],
  9: [380, 170, 120, 90, 70, 60, 50, 40, 20],
  10: [350, 160, 120, 90, 70, 60, 50, 40, 30, 30],
}

export default function AdminDashboard() {
  const { stats, loading: statsLoading } = useAdminStats()
  const { users } = useAdminUsers()
  const { entries } = useAdminEntries()
  const { settings, updatePayoutSettings } = useLeagueSettings()

  // Payout calculator state
  const [commissionerFee, setCommissionerFee] = useState(0)
  const [payoutDollars, setPayoutDollars] = useState<number[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Load saved payout settings from database
  useEffect(() => {
    if (settings) {
      setCommissionerFee(settings.commissioner_fee || 0)
      // Load saved dollar amounts if available
      if (settings.payout_amounts && settings.payout_amounts.length > 0) {
        setPayoutDollars(settings.payout_amounts)
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

  // Initialize payout dollars when payout spots change (only if different from saved)
  useEffect(() => {
    // Only auto-set defaults if we don't have saved amounts or spot count changed
    if (payoutDollars.length !== payoutSpots) {
      if (settings?.payout_amounts && settings.payout_amounts.length === payoutSpots) {
        setPayoutDollars(settings.payout_amounts)
      } else {
        setPayoutDollars(DEFAULT_PAYOUTS[payoutSpots] || DEFAULT_PAYOUTS[4])
      }
    }
  }, [payoutSpots, payoutDollars.length, settings?.payout_amounts])

  // Auto-save payout settings when they change
  const savePayoutSettings = useCallback(async (fee: number, amounts: number[]) => {
    setSaveStatus('saving')
    const { error } = await updatePayoutSettings(fee, [], amounts)
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
    savePayoutSettings(newFee, payoutDollars)
  }

  // Handle dollar amount input change
  const handleDollarChange = (index: number, newDollarValue: number) => {
    const newDollars = [...payoutDollars]
    newDollars[index] = Math.max(0, newDollarValue)
    setPayoutDollars(newDollars)
    savePayoutSettings(commissionerFee, newDollars)
  }

  // Calculate totals
  const totalAllocated = payoutDollars.reduce((a, b) => a + b, 0)
  const remainingDollars = netPrizePool - totalAllocated

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
            <span className="text-sm text-gray-500">Payout Distribution ({payoutSpots} spots)</span>
            <div className={`text-sm font-medium ${
              Math.abs(remainingDollars) < 1 ? 'text-green-600' :
              remainingDollars > 0 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.abs(remainingDollars) < 1 ? (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fully Allocated
                </span>
              ) : remainingDollars > 0 ? (
                `$${remainingDollars.toLocaleString()} remaining to allocate`
              ) : (
                `$${Math.abs(remainingDollars).toLocaleString()} over allocation`
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Place</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">% of Pool</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payoutDollars.map((dollarAmount, index) => {
                  const ordinalSuffix = (n: number) => {
                    if (n === 1) return 'st'
                    if (n === 2) return 'nd'
                    if (n === 3) return 'rd'
                    return 'th'
                  }
                  const percentage = netPrizePool > 0 ? (dollarAmount / netPrizePool) * 100 : 0

                  return (
                    <tr key={index} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {index + 1}{ordinalSuffix(index + 1)} Place
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center">
                    <span className={Math.abs(remainingDollars) < 1 ? 'text-green-600' : 'text-red-600'}>
                      ${totalAllocated.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {netPrizePool > 0 ? ((totalAllocated / netPrizePool) * 100).toFixed(1) : 0}%
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
