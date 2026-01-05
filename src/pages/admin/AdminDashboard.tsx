import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { useAdminStats, useAdminEntries } from '../../hooks/useAdmin'

export default function AdminDashboard() {
  const { stats, loading: statsLoading } = useAdminStats()
  const { entries } = useAdminEntries()

  // Get entries missing lineups for current week
  const missingLineups = entries.filter(e => {
    if (!stats) return false
    return e.lineups_submitted < stats.currentWeek
  })

  // Get unpaid entries
  const unpaidEntries = entries.filter(e => !e.payment_received)

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
            ${stats?.entriesPaid ? stats.entriesPaid * 25 : 0} collected
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
            <h2 className="text-lg font-semibold text-gray-900">Payment Status</h2>
            <Link to="/admin/entries" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Paid</span>
              <span className="font-semibold text-green-600">
                {stats?.entriesPaid || 0} entries
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Unpaid</span>
              <span className="font-semibold text-red-600">
                {stats?.entriesUnpaid || 0} entries
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: stats?.totalEntries
                    ? `${(stats.entriesPaid / stats.totalEntries) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
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

      {/* Unpaid Entries */}
      {unpaidEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Unpaid Entries ({unpaidEntries.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {unpaidEntries.slice(0, 10).map(entry => (
              <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{entry.entry_name}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-gray-600">{entry.display_name}</span>
                </div>
                <span className="text-sm text-red-600">$25 owed</span>
              </div>
            ))}
            {unpaidEntries.length > 10 && (
              <div className="px-6 py-3 text-center">
                <Link to="/admin/entries" className="text-blue-600 hover:text-blue-700 text-sm">
                  View all {unpaidEntries.length} unpaid entries
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
              <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{entry.entry_name}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-gray-600">{entry.display_name}</span>
                  <span className="text-gray-400 text-sm ml-2">({entry.email})</span>
                </div>
                <span className="text-sm text-yellow-600">No lineup</span>
              </div>
            ))}
            {missingLineups.length > 10 && (
              <div className="px-6 py-3 text-center">
                <Link to="/admin/entries" className="text-blue-600 hover:text-blue-700 text-sm">
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
