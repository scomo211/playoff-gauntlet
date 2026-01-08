import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { useEntries, useLeagueSettings, useEntryCount } from '../hooks/useEntries'
import { Entry } from '../types/database'
import { supabase } from '../lib/supabase'
import EntryCard from '../components/EntryCard'
import CreateEntryModal from '../components/CreateEntryModal'
import DeleteEntryModal from '../components/DeleteEntryModal'
import CountdownTimer from '../components/CountdownTimer'
import { useToast } from '../contexts/ToastContext'

interface LeaderboardEntry {
  id: string
  entry_name: string
  display_name: string
  week1_points: number
  week2_points: number
  week3_points: number
  week4_points: number
  total_points: number
}

interface ProfileData {
  display_name: string | null
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { entries, loading, createEntry, deleteEntry } = useEntries()
  const { testTouchdownToast } = useToast()
  const { settings } = useLeagueSettings()
  const { count: totalEntries } = useEntryCount()

  // Leaderboard state
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [payoutSpots, setPayoutSpots] = useState(4)
  const [payoutAmounts, setPayoutAmounts] = useState<number[]>([])
  const [currentWeek, setCurrentWeek] = useState<number | undefined>(undefined)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [amountPaid, setAmountPaid] = useState<number>(0)

  // Fetch current week
  useEffect(() => {
    async function fetchCurrentWeek() {
      const { data } = await supabase
        .from('weeks')
        .select('id')
        .eq('is_current', true)
        .single()
      if (data) setCurrentWeek(data.id)
    }
    fetchCurrentWeek()
  }, [])

  // Fetch user's payment status
  useEffect(() => {
    async function fetchPaymentStatus() {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('amount_paid')
        .eq('id', user.id)
        .single()
      if (data) setAmountPaid(data.amount_paid || 0)
    }
    fetchPaymentStatus()
  }, [user])

  // Fetch leaderboard with polling
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
            lineups(week_id, total_points)
          `)
          .eq('is_active', true)

        if (fetchError) throw fetchError

        const formatted = data.map(entry => {
          const profile = entry.profile as ProfileData | ProfileData[] | null
          const displayName = Array.isArray(profile)
            ? profile[0]?.display_name
            : profile?.display_name

          // Get points per week
          const lineups = entry.lineups as { week_id: number; total_points: number }[] || []
          const getWeekPoints = (weekId: number) =>
            lineups.find(l => l.week_id === weekId)?.total_points || 0

          return {
            id: entry.id,
            entry_name: entry.entry_name,
            display_name: displayName || 'Unknown',
            week1_points: getWeekPoints(1),
            week2_points: getWeekPoints(2),
            week3_points: getWeekPoints(3),
            week4_points: getWeekPoints(4),
            total_points: lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)
          }
        })

        formatted.sort((a, b) => b.total_points - a.total_points)
        setLeaderboardEntries(formatted)
        setLastUpdated(new Date())

        const count = formatted.length
        let spots = 4
        if (count >= 100) spots = 10
        else if (count >= 90) spots = 9
        else if (count >= 80) spots = 8
        else if (count >= 70) spots = 7
        else if (count >= 60) spots = 6
        else if (count >= 50) spots = 5
        setPayoutSpots(spots)

      } catch (err) {
        console.error('Failed to fetch leaderboard:', err)
        setLeaderboardError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLeaderboardLoading(false)
      }
    }

    fetchLeaderboard()

    // Poll every 30 seconds for live updates during games
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [])

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

  // Calculate payout amounts when settings or entry count changes
  useEffect(() => {
    if (leaderboardEntries.length > 0) {
      const count = leaderboardEntries.length
      const totalPot = count * 25
      const commFee = settings?.commissioner_fee || 0
      const netPool = totalPot - commFee

      // Use stored percentages if they match current payout spots, otherwise use defaults
      const storedPercentages = settings?.payout_percentages || []
      const percentages = storedPercentages.length >= payoutSpots
        ? storedPercentages.slice(0, payoutSpots)
        : DEFAULT_PAYOUTS[payoutSpots] || DEFAULT_PAYOUTS[4]

      const amounts = percentages.map(pct => Math.round((netPool * pct) / 100))
      setPayoutAmounts(amounts)
    }
  }, [settings, leaderboardEntries.length, payoutSpots])

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteModalEntry, setDeleteModalEntry] = useState<Entry | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const entriesPerPage = 25

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const entriesLocked = settings?.entries_locked ?? false

  // Pagination logic
  const totalPages = Math.ceil(leaderboardEntries.length / entriesPerPage)
  const showPagination = leaderboardEntries.length >= entriesPerPage
  const paginatedEntries = showPagination
    ? leaderboardEntries.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage)
    : leaderboardEntries
  const startIndex = (currentPage - 1) * entriesPerPage

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2.5">
                <img src="/favicon.png" alt="Playoff Gauntlet" className="w-7 h-7" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-white tracking-tight leading-tight">Playoff Gauntlet</span>
                  <span className="text-[10px] text-slate-500 tracking-wide">Year 8</span>
                </div>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-800">
                  Dashboard
                </Link>
                <Link to="/entries" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                  My Entries
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
                className="hidden sm:block px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Sign out
              </button>
              {/* Mobile hamburger menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-800 bg-slate-900">
            <div className="px-4 py-3 space-y-1">
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-white bg-slate-800"
              >
                Dashboard
              </Link>
              <Link
                to="/entries"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
              >
                My Entries
              </Link>
              <Link
                to="/players"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
              >
                Players
              </Link>
              <Link
                to="/rules"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
              >
                Rules
              </Link>
              <div className="border-t border-slate-800 pt-2 mt-2">
                <div className="px-3 py-1 text-xs text-slate-500">
                  {user?.user_metadata?.display_name || user?.email}
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    handleSignOut()
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Banner */}
        <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="card-solid p-2 sm:p-4 text-center sm:text-left">
            <div className="text-xs sm:text-sm text-slate-500">Entries</div>
            <div className="text-lg sm:text-2xl font-bold text-white">{totalEntries}</div>
          </div>
          <div className="card-solid p-2 sm:p-4 text-center sm:text-left">
            <div className="text-xs sm:text-sm text-slate-500">Prize Pool</div>
            <div className="text-lg sm:text-2xl font-bold text-field-400">${(totalEntries * 25).toLocaleString()}</div>
          </div>
          <div className="card-solid p-2 sm:p-4 text-center sm:text-left">
            <div className="text-xs sm:text-sm text-slate-500">Payouts</div>
            <div className="text-lg sm:text-2xl font-bold text-gold-400">Top {payoutSpots}</div>
          </div>
        </div>

        {/* Two Column Layout: Leaderboard (2/3) | Your Entries (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard Section - Left 2/3 */}
          <div className="lg:col-span-2">
            {/* Countdown Timer - hidden after kickoff */}
            <CountdownTimer variant="dashboard" />

            {/* Test TD Toast Button - Remove after testing */}
            <button
              onClick={testTouchdownToast}
              className="mb-4 px-4 py-2 bg-gold-500/20 border border-gold-500/30 rounded-lg text-gold-400 text-sm font-medium hover:bg-gold-500/30 transition"
            >
              🏈 Test TD Toast
            </button>

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Leaderboard</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {leaderboardEntries.length} entries competing for top {payoutSpots} payout spots
                </p>
              </div>
              {lastUpdated && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span>
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                </div>
              )}
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
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Entry
                        </th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Owner
                        </th>
                        <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Wk 1
                        </th>
                        <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Wk 2
                        </th>
                        <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Wk 3
                        </th>
                        <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Wk 4
                        </th>
                        <th className="pl-2 pr-5 sm:px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {paginatedEntries.map((entry, index) => {
                        const rank = startIndex + index + 1
                        const inTheMoney = rank <= payoutSpots

                        return (
                          <tr
                            key={entry.id}
                            onClick={() => navigate(`/entry/${entry.id}/lineup?week=${currentWeek || 1}`)}
                            className={`cursor-pointer transition ${inTheMoney ? 'bg-field-500/5 hover:bg-field-500/10' : 'hover:bg-slate-800/50'}`}
                          >
                            <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                                  {rank}
                                </span>
                                {inTheMoney && payoutAmounts[rank - 1] !== undefined && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                                    ${payoutAmounts[rank - 1].toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white truncate max-w-[80px] sm:max-w-none" title={entry.entry_name}>{entry.entry_name}</div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-slate-400 truncate max-w-[80px] sm:max-w-none" title={entry.display_name}>{entry.display_name}</div>
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                              {entry.week1_points > 0 ? entry.week1_points.toFixed(1) : '--'}
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                              {entry.week2_points > 0 ? entry.week2_points.toFixed(1) : '--'}
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                              {entry.week3_points > 0 ? entry.week3_points.toFixed(1) : '--'}
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                              {entry.week4_points > 0 ? entry.week4_points.toFixed(1) : '--'}
                            </td>
                            <td className="pl-2 pr-5 sm:px-4 py-3 whitespace-nowrap text-right">
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

              {/* Pagination Controls */}
              {showPagination && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-800/30">
                  <div className="text-sm text-slate-400">
                    Showing {startIndex + 1}-{Math.min(startIndex + entriesPerPage, leaderboardEntries.length)} of {leaderboardEntries.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-700 text-white hover:bg-slate-600 disabled:hover:bg-slate-700"
                    >
                      Prev
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 text-sm font-medium rounded-lg transition ${
                            page === currentPage
                              ? 'bg-field-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed bg-slate-700 text-white hover:bg-slate-600 disabled:hover:bg-slate-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 card p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-slate-400">
                  Highlighted rows are in payout position (Top {payoutSpots})
                </span>
              </div>
            </div>
          </div>

          {/* Your Entries Section - Right 1/3 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Your Entries</h2>
              {!entriesLocked && settings?.current_week_id === 1 && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-primary text-sm px-3 py-1.5"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
              </div>
            ) : entries.length > 0 ? (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onDelete={setDeleteModalEntry}
                    entriesLocked={entriesLocked}
                    currentWeek={settings?.current_week_id ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="card-solid p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-field-500/10 border border-field-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-field-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">No entries yet</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Create your first entry to compete. $25 per entry.
                </p>
                {!entriesLocked && settings?.current_week_id === 1 && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-primary text-sm"
                  >
                    Create Entry
                  </button>
                )}
              </div>
            )}

            {entries.length > 0 && (() => {
              const amountOwed = entries.length * 25
              const isFullyPaid = amountPaid >= amountOwed

              return (
                <div className={`mt-4 card-solid p-4 ${isFullyPaid ? 'border border-green-500/30 bg-green-500/5' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">
                        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} × $25
                      </p>
                      <p className="text-lg font-bold text-white">
                        Total: ${amountOwed}
                      </p>
                    </div>
                    {isFullyPaid ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-sm bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Paid
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const amount = amountOwed - amountPaid
                          const note = encodeURIComponent(`Playoff Gauntlet - ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`)
                          const venmoUrl = `https://venmo.com/ScottyMoran?txn=pay&amount=${amount}&note=${note}`
                          window.open(venmoUrl, '_blank')
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-sm bg-gold-500 text-slate-900 rounded-lg hover:bg-gold-400 transition"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 3c.9 1.5 1.3 3 1.3 5 0 5.5-4.7 12.7-8.5 17h-6l-2.3-15.5 5.3-.5.9 7.5c1.7-2.7 3.8-7 3.8-9.9 0-1.9-.3-3.2-.9-4.3l6.4.7z"/>
                        </svg>
                        Pay ${amountOwed - amountPaid} with Venmo
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            {!entriesLocked && settings?.current_week_id === 1 && entries.length > 0 && (
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">
                  Unlimited entries until kickoff
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateEntryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createEntry}
        onSuccess={(entryId) => {
          const weekParam = currentWeek ? `?week=${currentWeek}` : ''
          navigate(`/entry/${entryId}/lineup${weekParam}`)
        }}
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
