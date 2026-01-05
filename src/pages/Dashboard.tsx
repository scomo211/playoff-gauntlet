import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { useEntries, useLeagueSettings, useEntryCount } from '../hooks/useEntries'
import { Entry } from '../types/database'
import EntryCard from '../components/EntryCard'
import CreateEntryModal from '../components/CreateEntryModal'
import DeleteEntryModal from '../components/DeleteEntryModal'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { entries, loading, createEntry, deleteEntry } = useEntries()
  const { settings } = useLeagueSettings()
  const { count: totalEntries, payoutSpots } = useEntryCount()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteModalEntry, setDeleteModalEntry] = useState<Entry | null>(null)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const entriesLocked = settings?.entries_locked ?? false

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-gray-900">Playoff Gauntlet</h1>
              <div className="hidden sm:flex items-center gap-6">
                <Link to="/dashboard" className="text-sm font-medium text-blue-600">
                  Dashboard
                </Link>
                <Link to="/leaderboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">
                  Leaderboard
                </Link>
                <Link to="/players" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">
                  Players
                </Link>
                <Link to="/rules" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">
                  Rules
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.user_metadata?.display_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Banner */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Your Entries</div>
            <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Entries</div>
            <div className="text-2xl font-bold text-gray-900">{totalEntries}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Payout Spots</div>
            <div className="text-2xl font-bold text-green-600">Top {payoutSpots}</div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Entries</h2>
            <p className="mt-1 text-gray-600">
              {entriesLocked
                ? 'Entries are locked for the season'
                : 'Create and manage your playoff fantasy entries'}
            </p>
          </div>
          {!entriesLocked && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Entry
            </button>
          )}
        </div>

        {/* Entries Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : entries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDelete={setDeleteModalEntry}
                entriesLocked={entriesLocked}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No entries yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first entry to start competing in the playoff fantasy challenge.
              Entry fee is $25 per entry.
            </p>
            {!entriesLocked && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                Create Your First Entry
              </button>
            )}
          </div>
        )}

        {/* Entry Fee Notice */}
        {!entriesLocked && entries.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Entry Fee: $25 per entry</p>
                <p className="mt-1">
                  You can create unlimited entries until Wild Card Weekend kicks off.
                  Payment is handled externally (Venmo, cash, etc.)
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateEntryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createEntry}
      />

      <DeleteEntryModal
        isOpen={deleteModalEntry !== null}
        onClose={() => setDeleteModalEntry(null)}
        entry={deleteModalEntry}
        onConfirm={deleteEntry}
      />
    </div>
  )
}
