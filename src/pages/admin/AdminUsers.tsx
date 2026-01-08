import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { useAdminUsers, AdminUser } from '../../hooks/useAdmin'

type SortField = 'display_name' | 'email' | 'entry_count' | 'amount_owed' | 'amount_paid' | 'payment_received' | 'is_admin' | 'unsubmitted_lineups'
type SortDirection = 'asc' | 'desc'

export default function AdminUsers() {
  const { users, loading, toggleAdmin, updatePayment, deleteUser } = useAdminUsers()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [sortField, setSortField] = useState<SortField>('display_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editingPayment, setEditingPayment] = useState<string | null>(null)
  const [paymentInput, setPaymentInput] = useState<string>('')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortUsers = (usersToSort: AdminUser[]) => {
    return [...usersToSort].sort((a, b) => {
      let aVal: string | number | boolean = a[sortField]
      let bVal: string | number | boolean = b[sortField]

      // Handle string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
        if (sortDirection === 'asc') {
          return aVal.localeCompare(bVal)
        }
        return bVal.localeCompare(aVal)
      }

      // Handle boolean (convert to number for sorting)
      if (typeof aVal === 'boolean') aVal = aVal ? 1 : 0
      if (typeof bVal === 'boolean') bVal = bVal ? 1 : 0

      // Handle number comparison
      if (sortDirection === 'asc') {
        return (aVal as number) - (bVal as number)
      }
      return (bVal as number) - (aVal as number)
    })
  }

  const filteredUsers = sortUsers(users.filter(user => {
    const matchesSearch =
      user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterPaid === 'all' ||
      (filterPaid === 'paid' && user.payment_received) ||
      (filterPaid === 'unpaid' && !user.payment_received)

    return matchesSearch && matchesFilter
  }))

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin access?`)) {
      return
    }
    await toggleAdmin(userId, !currentStatus)
  }

  const handleStartEditPayment = (userId: string, currentAmount: number) => {
    setEditingPayment(userId)
    setPaymentInput(currentAmount.toString())
  }

  const handleSavePayment = async (userId: string) => {
    const amount = parseFloat(paymentInput) || 0
    const { error } = await updatePayment(userId, amount)
    if (error) {
      console.error('Failed to save payment:', error)
      alert('Failed to save payment: ' + error)
    } else {
      setEditingPayment(null)
      setPaymentInput('')
    }
  }

  const handleCancelEdit = () => {
    setEditingPayment(null)
    setPaymentInput('')
  }

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmMessage = user.entry_count > 0
      ? `Are you sure you want to delete ${user.display_name}?\n\nThis will also delete their ${user.entry_count} ${user.entry_count === 1 ? 'entry' : 'entries'} and all associated data.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete ${user.display_name}?\n\nThis action cannot be undone.`

    if (!confirm(confirmMessage)) {
      return
    }

    const { error } = await deleteUser(user.id)
    if (error) {
      alert('Failed to delete user: ' + error)
    }
  }

  const exportUsers = useCallback(() => {
    // Create CSV content
    const headers = ['Display Name', 'Email', 'Entries', 'Amount Owed', 'Amount Paid', 'Status', 'Role', 'Unsubmitted Lineups']
    const rows = filteredUsers.map(user => [
      user.display_name,
      user.email,
      user.entry_count.toString(),
      `$${user.amount_owed}`,
      `$${user.amount_paid}`,
      user.payment_received ? 'Paid' : user.amount_owed === 0 ? 'N/A' : 'Unpaid',
      user.is_admin ? 'Admin' : 'User',
      user.unsubmitted_lineups.toString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `playoff-gauntlet-users-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [filteredUsers])

  // Calculate totals for stats
  const totalOwed = users.reduce((sum, u) => sum + u.amount_owed, 0)
  const totalPaid = users.reduce((sum, u) => sum + u.amount_paid, 0)
  const totalOutstanding = totalOwed - totalPaid

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'desc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-gray-600">View and manage all users</p>
        </div>
        <button
          onClick={exportUsers}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Users</div>
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Owed</div>
          <div className="text-2xl font-bold text-gray-900">${totalOwed}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Collected</div>
          <div className="text-2xl font-bold text-green-600">${totalPaid}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Outstanding</div>
          <div className="text-2xl font-bold text-red-600">${totalOutstanding}</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by name or email..."
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={filterPaid}
          onChange={(e) => setFilterPaid(e.target.value as typeof filterPaid)}
          className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Users</option>
          <option value="paid">Paid Only</option>
          <option value="unpaid">Unpaid Only</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('display_name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-1">
                    User
                    <SortIcon field="display_name" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center gap-1">
                    Email
                    <SortIcon field="email" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('entry_count')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Entries
                    <SortIcon field="entry_count" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount_owed')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Owed
                    <SortIcon field="amount_owed" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount_paid')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Paid
                    <SortIcon field="amount_paid" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('payment_received')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Status
                    <SortIcon field="payment_received" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('is_admin')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Role
                    <SortIcon field="is_admin" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('unsubmitted_lineups')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Unsubmitted
                    <SortIcon field="unsubmitted_lineups" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/admin/user/${user.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                      {user.display_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/admin/user/${user.id}`} className="text-sm text-gray-600 hover:text-blue-600">
                      {user.email}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">{user.entry_count}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">${user.amount_owed}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {editingPayment === user.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={paymentInput}
                          onChange={(e) => setPaymentInput(e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePayment(user.id)
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={() => handleSavePayment(user.id)}
                          className="p-1 text-green-600 hover:text-green-700"
                          title="Save"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Cancel"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEditPayment(user.id, user.amount_paid)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        ${user.amount_paid}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.payment_received
                        ? 'bg-green-100 text-green-800'
                        : user.amount_owed === 0
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {user.payment_received ? 'Paid' : user.amount_owed === 0 ? 'N/A' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {user.is_admin ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {user.unsubmitted_lineups > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {user.unsubmitted_lineups}
                      </span>
                    ) : (
                      <span className="text-sm text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        className={`text-sm font-medium ${
                          user.is_admin
                            ? 'text-red-600 hover:text-red-700'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                        title="Delete user"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </AdminLayout>
  )
}
