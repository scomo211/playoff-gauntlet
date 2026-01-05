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
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2.5">
                <svg className="w-7 h-7 text-field-400" viewBox="0 0 32 32" fill="none">
                  <ellipse cx="16" cy="16" rx="14" ry="9" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
                  <path d="M16 9v14" stroke="#1a1f2e" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M13 11l3 2 3-2M13 15l3 2 3-2M13 19l3 2 3-2" stroke="#1a1f2e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-base font-bold text-white tracking-tight">Playoff Gauntlet</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-800">
                  Dashboard
                </Link>
                <Link to="/leaderboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                  Leaderboard
                </Link>
                <Link to="/players" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                  Players
                </Link>
                <Link to="/rules" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                  Rules
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-sm text-slate-400">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
          <div className="card-solid p-4">
            <div className="text-sm text-slate-500">Your Entries</div>
            <div className="text-2xl font-bold text-white">{entries.length}</div>
          </div>
          <div className="card-solid p-4">
            <div className="text-sm text-slate-500">Total Entries</div>
            <div className="text-2xl font-bold text-white">{totalEntries}</div>
          </div>
          <div className="card-solid p-4">
            <div className="text-sm text-slate-500">Payout Spots</div>
            <div className="text-2xl font-bold text-field-400">Top {payoutSpots}</div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Your Entries</h2>
            <p className="mt-1 text-slate-400">
              {entriesLocked
                ? 'Entries are locked for the season'
                : 'Create and manage your playoff fantasy entries'}
            </p>
          </div>
          {!entriesLocked && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary"
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
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
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
          <div className="card-solid p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-field-500/10 border border-field-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-field-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No entries yet</h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">
              Create your first entry to start competing in the playoff fantasy challenge.
              Entry fee is $25 per entry.
            </p>
            {!entriesLocked && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary px-6 py-3"
              >
                Create Your First Entry
              </button>
            )}
          </div>
        )}

        {/* Entry Fee Notice */}
        {!entriesLocked && entries.length > 0 && (
          <div className="mt-8 card p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-field-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-medium">Entry Fee: $25 per entry</p>
                <p className="mt-1 text-slate-400">
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
