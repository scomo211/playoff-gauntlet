import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { useAdminEntries } from '../../hooks/useAdmin'
import { formatDate } from '../../lib/formatTime'

export default function AdminEntries() {
  const { entries, loading, togglePayment, deleteEntry } = useAdminEntries()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')

  const filteredEntries = entries.filter(entry => {
    const matchesSearch =
      entry.entry_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterPaid === 'all' ||
      (filterPaid === 'paid' && entry.payment_received) ||
      (filterPaid === 'unpaid' && !entry.payment_received)

    return matchesSearch && matchesFilter
  })

  const handleTogglePayment = async (entryId: string, currentStatus: boolean) => {
    await togglePayment(entryId, !currentStatus)
  }

  const handleDeleteEntry = async (entry: typeof entries[0]) => {
    if (!confirm(`Are you sure you want to delete "${entry.entry_name}"? This action cannot be undone.`)) {
      return
    }
    await deleteEntry(entry.id)
  }

  const totalOwed = entries.filter(e => !e.payment_received).length * 25
  const totalCollected = entries.filter(e => e.payment_received).length * 25

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Entry Management</h1>
        <p className="mt-1 text-gray-600">View and manage all entries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Entries</div>
          <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Collected</div>
          <div className="text-2xl font-bold text-green-600">${totalCollected}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Outstanding</div>
          <div className="text-2xl font-bold text-red-600">${totalOwed}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Pot</div>
          <div className="text-2xl font-bold text-blue-600">${entries.length * 25}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entries..."
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={filterPaid}
          onChange={(e) => setFilterPaid(e.target.value as typeof filterPaid)}
          className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Entries</option>
          <option value="paid">Paid Only</option>
          <option value="unpaid">Unpaid Only</option>
        </select>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lineups
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{entry.entry_name}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(entry.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{entry.display_name}</div>
                    <div className="text-xs text-gray-500">{entry.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {entry.lineups_submitted}/4
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-bold text-blue-600">
                      {entry.total_points.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleTogglePayment(entry.id, entry.payment_received)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition ${
                        entry.payment_received
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {entry.payment_received ? 'Paid' : 'Unpaid'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/entry/${entry.id}/lineup?week=1`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Lineup
                      </Link>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredEntries.length} of {entries.length} entries
      </div>
    </AdminLayout>
  )
}
