import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/formatTime'

interface UserProfile {
  id: string
  email: string
  display_name: string
  phone: string | null
  is_admin: boolean
  payment_received: boolean
  amount_paid: number
  created_at: string
}

interface UserEntry {
  id: string
  entry_name: string
  payment_received: boolean
  is_active: boolean
  created_at: string
  lineups: {
    week_id: number
    is_submitted: boolean
    total_points: number
  }[]
}

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentInput, setPaymentInput] = useState('')

  const fetchUserData = async () => {
    if (!userId) return

    try {
      setLoading(true)

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      setUser(profileData)

      // Fetch user's entries with lineups
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          payment_received,
          is_active,
          created_at,
          lineups(week_id, is_submitted, total_points)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (entriesError) throw entriesError
      setEntries(entriesData || [])
    } catch (err) {
      console.error('Failed to fetch user data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()
  }, [userId])

  const handleStartEditPayment = () => {
    if (!user) return
    setEditingPayment(true)
    setPaymentInput((user.amount_paid || 0).toString())
  }

  const handleSavePayment = async () => {
    if (!user) return
    const amount = parseFloat(paymentInput) || 0

    const { data, error } = await supabase
      .from('profiles')
      .update({ amount_paid: amount })
      .eq('id', user.id)
      .select()

    if (error) {
      alert('Failed to save payment: ' + error.message)
    } else if (!data || data.length === 0) {
      alert('Failed to save: No permission to update this user.')
    } else {
      setEditingPayment(false)
      setPaymentInput('')
      fetchUserData()
    }
  }

  const handleCancelEdit = () => {
    setEditingPayment(false)
    setPaymentInput('')
  }

  const handleDeleteEntry = async (entry: UserEntry) => {
    if (!confirm(`Are you sure you want to delete "${entry.entry_name}"? This will delete all lineups and used players. This action cannot be undone.`)) {
      return
    }

    // Delete in order: lineup_players, lineups, used_players, entry
    await supabase
      .from('lineup_players')
      .delete()
      .in('lineup_id', entry.lineups?.map(l => l.week_id) || [])

    await supabase
      .from('lineups')
      .delete()
      .eq('entry_id', entry.id)

    await supabase
      .from('used_players')
      .delete()
      .eq('entry_id', entry.id)

    await supabase
      .from('entries')
      .delete()
      .eq('id', entry.id)

    fetchUserData()
  }

  const handleToggleActive = async (entryId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('entries')
      .update({ is_active: !currentStatus })
      .eq('id', entryId)

    if (!error) fetchUserData()
  }

  const getTotalPoints = (entry: UserEntry) => {
    return entry.lineups?.reduce((sum, l) => sum + (l.total_points || 0), 0) || 0
  }

  const getLineupsSubmitted = (entry: UserEntry) => {
    return entry.lineups?.filter(l => l.is_submitted).length || 0
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

  if (!user) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">User not found</p>
          <Link to="/admin/users" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            Back to Users
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* Back link */}
      <div className="mb-6">
        <Link to="/admin/users" className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </Link>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.display_name}</h1>
            <p className="text-gray-600 mt-1">{user.email}</p>
            {user.phone && (
              <p className="text-gray-500 text-sm mt-1">{user.phone}</p>
            )}
          </div>
          <div className="text-right space-y-2">
            <div className="flex items-center gap-2 justify-end">
              {user.is_admin && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Joined {formatDate(user.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Entries Summary */}
      {(() => {
        const activeCount = entries.filter(e => e.is_active).length
        const amountOwed = activeCount * 25
        const amountPaid = user.amount_paid || 0
        const isPaid = amountPaid >= amountOwed && amountOwed > 0

        return (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Total Entries</div>
              <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Active Entries</div>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Amount Owed</div>
              <div className="text-2xl font-bold text-gray-900">${amountOwed}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Amount Paid</div>
              {editingPayment ? (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-gray-500">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={paymentInput}
                    onChange={(e) => setPaymentInput(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-lg font-bold text-center text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePayment()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={handleSavePayment}
                    className="p-1 text-green-600 hover:text-green-700"
                    title="Save"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-gray-500 hover:text-gray-700"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartEditPayment}
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  ${amountPaid}
                </button>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Status</div>
              <div className={`text-2xl font-bold ${
                isPaid ? 'text-green-600' : amountOwed === 0 ? 'text-gray-400' : 'text-red-600'
              }`}>
                {isPaid ? 'Paid' : amountOwed === 0 ? 'N/A' : 'Unpaid'}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Entries</h2>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            This user has no entries
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lineups
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map(entry => (
                <tr key={entry.id} className={`hover:bg-gray-50 ${!entry.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{entry.entry_name}</div>
                    <div className="text-xs text-gray-500">{formatDate(entry.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleToggleActive(entry.id, entry.is_active)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {entry.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-medium text-gray-900">
                      {getLineupsSubmitted(entry)}/4
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-bold text-blue-600">
                      {getTotalPoints(entry).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Week lineup links */}
                      <div className="flex gap-1 mr-2">
                        {[1, 2, 3, 4].map(week => {
                          const lineup = entry.lineups?.find(l => l.week_id === week)
                          const isSubmitted = lineup?.is_submitted
                          return (
                            <Link
                              key={week}
                              to={`/admin/entry/${entry.id}/lineup?week=${week}`}
                              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition ${
                                isSubmitted
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              title={`Week ${week}${isSubmitted ? ' (Submitted)' : ''}`}
                            >
                              {week}
                            </Link>
                          )
                        })}
                      </div>
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
    </AdminLayout>
  )
}
