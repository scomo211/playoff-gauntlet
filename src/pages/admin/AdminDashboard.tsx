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

  // Handle slider change - adjusts other sliders proportionally to maintain 100%
  const handlePayoutChange = (index: number, newValue: number) => {
    const newPercentages = [...payoutPercentages]

    // Clamp newValue between 0 and 100
    newValue = Math.max(0, Math.min(100, newValue))
    newPercentages[index] = newValue

    // Calculate how much we need to adjust other sliders
    const otherTotal = newPercentages.reduce((sum, p, i) => i === index ? sum : sum + p, 0)
    const targetOtherTotal = 100 - newValue

    if (otherTotal > 0 && targetOtherTotal >= 0) {
      // Adjust other sliders proportionally
      const scale = targetOtherTotal / otherTotal
      for (let i = 0; i < newPercentages.length; i++) {
        if (i !== index) {
          newPercentages[i] = Math.round(newPercentages[i] * scale * 10) / 10
        }
      }

      // Fix rounding errors - adjust the largest non-current slider
      const currentTotal = newPercentages.reduce((sum, p) => sum + p, 0)
      const roundingError = 100 - currentTotal
      if (Math.abs(roundingError) > 0.01) {
        let maxIdx = -1
        let maxVal = -1
        for (let i = 0; i < newPercentages.length; i++) {
          if (i !== index && newPercentages[i] > maxVal) {
            maxVal = newPercentages[i]
            maxIdx = i
          }
        }
        if (maxIdx >= 0) {
          newPercentages[maxIdx] = Math.round((newPercentages[maxIdx] + roundingError) * 10) / 10
        }
      }
    }

    setPayoutPercentages(newPercentages)
    savePayoutSettings(commissionerFee, newPercentages)
  }

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

        {/* Payout Sliders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Payout Distribution ({payoutSpots} spots)</span>
            <span>Total: {payoutPercentages.reduce((a, b) => a + b, 0).toFixed(1)}%</span>
          </div>

          {payoutPercentages.map((percentage, index) => {
            const dollarAmount = (netPrizePool * percentage) / 100
            const ordinalSuffix = (n: number) => {
              if (n === 1) return 'st'
              if (n === 2) return 'nd'
              if (n === 3) return 'rd'
              return 'th'
            }

            return (
              <div key={index} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium text-gray-700">
                  {index + 1}{ordinalSuffix(index + 1)} Place
                </div>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={percentage}
                    onChange={(e) => handlePayoutChange(index, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div className="w-16 text-right">
                  <input
                    type="number"
                    value={percentage}
                    onChange={(e) => handlePayoutChange(index, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="0.5"
                  />
                </div>
                <div className="w-6 text-sm text-gray-500">%</div>
                <div className="w-24 text-right font-semibold text-green-600">
                  ${dollarAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary Table */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Payout Summary</h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Place</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">%</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payoutPercentages.map((percentage, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-gray-900">{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Place</td>
                    <td className="px-4 py-2 text-right text-gray-600">{percentage.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">
                      ${((netPrizePool * percentage) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Total</td>
                  <td className="px-4 py-2 text-right text-gray-900">100%</td>
                  <td className="px-4 py-2 text-right text-green-600">${netPrizePool.toLocaleString()}</td>
                </tr>
                {commissionerFee > 0 && (
                  <tr className="text-gray-500">
                    <td className="px-4 py-2">Commissioner Fee</td>
                    <td className="px-4 py-2 text-right">-</td>
                    <td className="px-4 py-2 text-right">${commissionerFee.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
