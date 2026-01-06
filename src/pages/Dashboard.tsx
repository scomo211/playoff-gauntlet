import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { useEntries, useLeagueSettings, useEntryCount } from '../hooks/useEntries'
import { Entry } from '../types/database'
import { supabase } from '../lib/supabase'
import EntryCard from '../components/EntryCard'
import CreateEntryModal from '../components/CreateEntryModal'
import DeleteEntryModal from '../components/DeleteEntryModal'

interface LeaderboardEntry {
  id: string
  entry_name: string
  display_name: string
  total_points: number
}

interface ProfileData {
  display_name: string | null
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { entries, loading, createEntry, deleteEntry } = useEntries()
  const { settings } = useLeagueSettings()
  const { count: totalEntries } = useEntryCount()

  // Leaderboard state
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [payoutSpots, setPayoutSpots] = useState(4)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLeaderboardError(null)
        const { data, error: fetchError } = await supabase
          .from('entries')
          .select(`
            id,
            entry_name,
            profile:profiles(display_name),
            lineups(total_points)
          `)
          .eq('is_active', true)

        if (fetchError) throw fetchError

        const formatted = data.map(entry => {
          const profile = entry.profile as ProfileData | ProfileData[] | null
          const displayName = Array.isArray(profile)
            ? profile[0]?.display_name
            : profile?.display_name
          return {
            id: entry.id,
            entry_name: entry.entry_name,
            display_name: displayName || 'Unknown',
            total_points: entry.lineups?.reduce((sum: number, l: { total_points: number }) => sum + (l.total_points || 0), 0) || 0
          }
        })

        formatted.sort((a, b) => b.total_points - a.total_points)
        setLeaderboardEntries(formatted)

        const count = formatted.length
        if (count >= 100) setPayoutSpots(10)
        else if (count >= 90) setPayoutSpots(9)
        else if (count >= 80) setPayoutSpots(8)
        else if (count >= 70) setPayoutSpots(7)
        else if (count >= 60) setPayoutSpots(6)
        else if (count >= 50) setPayoutSpots(5)
        else setPayoutSpots(4)

      } catch (err) {
        console.error('Failed to fetch leaderboard:', err)
        setLeaderboardError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLeaderboardLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

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
            <div className="text-sm text-slate-500">Prize Pool</div>
            <div className="text-2xl font-bold text-field-400">${(totalEntries * 25).toLocaleString()}</div>
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

        {/* Leaderboard Section */}
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
            <p className="mt-1 text-slate-400">
              {leaderboardEntries.length} entries competing for top {payoutSpots} payout spots
            </p>
          </div>

          <div className="card-solid overflow-hidden">
            {leaderboardLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
              </div>
            ) : leaderboardError ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-400 mb-2">Failed to load leaderboard</p>
                <p className="text-sm text-slate-500">{leaderboardError}</p>
              </div>
            ) : leaderboardEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Entry
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Owner
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Wk 1
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Wk 2
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Wk 3
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Wk 4
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {leaderboardEntries.map((entry, index) => {
                      const rank = index + 1
                      const inTheMoney = rank <= payoutSpots

                      return (
                        <tr
                          key={entry.id}
                          className={inTheMoney ? 'bg-field-500/5' : 'hover:bg-slate-800/30'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                                {rank}
                              </span>
                              {inTheMoney && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                                  $
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">{entry.entry_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-400">{entry.display_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`text-sm font-bold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                              {entry.total_points.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No entries yet. Be the first to join!
              </div>
            )}
          </div>

          <div className="mt-6 card p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gold-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-medium">In the Money</p>
                <p className="mt-1 text-slate-400">
                  Highlighted rows are currently in payout position. Top {payoutSpots} entries win prizes.
                </p>
              </div>
            </div>
          </div>
        </div>
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
