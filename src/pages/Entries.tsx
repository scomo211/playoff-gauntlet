import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useEntries, useLeagueSettings } from '../hooks/useEntries'
import { Entry, Week, Lineup } from '../types/database'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/formatTime'
import { getTeamGameStatus } from '../lib/schedule'
import { useRankMovement, MovementIndicator } from '../hooks/useRankMovement'
import CreateEntryModal from '../components/CreateEntryModal'
import DeleteEntryModal from '../components/DeleteEntryModal'

// Weekly winners - entry IDs that won each week's high score
const WEEKLY_WINNERS: Record<number, string> = {
  1: '14ba7ea8-1830-4fb5-ae8d-54ca3da8db5c', // Scrantonicity - Tim Meyer
}

interface EntryWithLineups extends Entry {
  lineups: (Lineup & { week: Week })[]
  rank?: number
  playersPlayed: number
  totalPlayers: number
}

interface RankedEntry {
  id: string
  total: number
}

export default function Entries() {
  const { entries, loading, createEntry, deleteEntry } = useEntries()
  const { settings } = useLeagueSettings()
  const { biggestUpMovers, biggestDownMovers, getMovement } = useRankMovement()
  const navigate = useNavigate()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteModalEntry, setDeleteModalEntry] = useState<Entry | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [entriesWithLineups, setEntriesWithLineups] = useState<EntryWithLineups[]>([])
  const [lineupsLoading, setLineupsLoading] = useState(true)
  const [totalEntries, setTotalEntries] = useState(0)
  const [payoutSpots, setPayoutSpots] = useState(4)

  const entriesLocked = settings?.entries_locked ?? false

  // Fetch weeks, lineups, and rankings for all entries
  useEffect(() => {
    async function fetchData() {
      if (entries.length === 0) {
        setLineupsLoading(false)
        return
      }

      try {
        // Fetch weeks
        const { data: weeksData } = await supabase
          .from('weeks')
          .select('*')
          .order('id', { ascending: true })

        if (weeksData) setWeeks(weeksData)

        // Fetch lineups for user's entries (including lineup_players for progress indicator)
        const entryIds = entries.map(e => e.id)
        const { data: lineupsData } = await supabase
          .from('lineups')
          .select(`*, week:weeks(*), lineup_players(player:players(team_id))`)
          .in('entry_id', entryIds)

        // Fetch all entries for ranking
        const { data: allEntries } = await supabase
          .from('entries')
          .select(`id, lineups(total_points)`)
          .eq('is_active', true)

        let rankings: RankedEntry[] = []
        if (allEntries) {
          rankings = allEntries
            .map(e => ({
              id: e.id,
              total: e.lineups?.reduce((sum: number, l: { total_points: number }) => sum + (l.total_points || 0), 0) || 0
            }))
            .sort((a, b) => b.total - a.total)

          setTotalEntries(rankings.length)

          const count = rankings.length
          if (count >= 100) setPayoutSpots(10)
          else if (count >= 90) setPayoutSpots(9)
          else if (count >= 80) setPayoutSpots(8)
          else if (count >= 70) setPayoutSpots(7)
          else if (count >= 60) setPayoutSpots(6)
          else if (count >= 50) setPayoutSpots(5)
          else setPayoutSpots(4)
        }

        // Get current week for progress calculation
        const currentWeek = weeksData?.find(w => w.is_current)
        const activeWeek = currentWeek?.id || 1

        // Map lineups and ranks to entries
        const mapped = entries.map(entry => {
          const entryRank = rankings.findIndex(r => r.id === entry.id) + 1
          const entryLineups = (lineupsData || []).filter(l => l.entry_id === entry.id) as (Lineup & { week: Week; lineup_players?: { player: { team_id: string } | { team_id: string }[] | null }[] })[]

          // Calculate players played for current week
          const currentWeekLineup = entryLineups.find(l => l.week_id === activeWeek)
          const lineupPlayers = currentWeekLineup?.lineup_players || []
          const totalPlayers = lineupPlayers.length
          const playersPlayed = lineupPlayers.filter(lp => {
            const player = lp.player
            const teamId = Array.isArray(player) ? player[0]?.team_id : player?.team_id
            const status = getTeamGameStatus(teamId, activeWeek)
            return status === 'live' || status === 'final'
          }).length

          return {
            ...entry,
            lineups: entryLineups as (Lineup & { week: Week })[],
            rank: entryRank > 0 ? entryRank : undefined,
            playersPlayed,
            totalPlayers
          }
        })

        setEntriesWithLineups(mapped)
      } finally {
        setLineupsLoading(false)
      }
    }

    if (!loading) {
      fetchData()
    }
  }, [entries, loading])

  const isLoading = loading || lineupsLoading

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Entries</h1>
          <p className="mt-1 text-slate-400">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} — $25 each
          </p>
        </div>
        {!entriesLocked && settings?.current_week_id === 1 && (
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-4">
          {entriesWithLineups.map((entry) => {
            const totalPoints = entry.lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)
            const inTheMoney = entry.rank !== undefined && entry.rank <= payoutSpots
            const currentWeek = weeks.find(w => w.is_current)

            // Helper to get lineup for a week
            const getLineupForWeek = (weekId: number) => entry.lineups.find(l => l.week_id === weekId)

            return (
              <div key={entry.id} className="card-solid overflow-hidden hover:border-slate-700 transition-colors">
                {/* Clickable main content area */}
                <Link to={`/entry/${entry.id}/lineup?week=${currentWeek?.id || 1}`} className="block p-5 hover:bg-slate-800/30 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate flex items-center gap-1.5">
                        <MovementIndicator
                          entryId={entry.id}
                          biggestUpMovers={biggestUpMovers}
                          biggestDownMovers={biggestDownMovers}
                          getMovement={getMovement}
                        />
                        {entry.entry_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Created {formatDate(entry.created_at)}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      {/* Rank badge */}
                      {entry.rank !== undefined && (
                        <div className={`text-center px-2.5 py-1 rounded ${inTheMoney ? 'bg-gold-500/10 border border-gold-500/20' : 'bg-slate-800'}`}>
                          <span className={`text-sm font-bold ${inTheMoney ? 'text-gold-400' : 'text-white'}`}>
                            #{entry.rank}
                          </span>
                        </div>
                      )}
                      {/* Points badge */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold ${
                        inTheMoney
                          ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                          : 'bg-field-500/10 text-field-400 border border-field-500/20'
                      }`}>
                        {totalPoints.toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  {/* Week status grid */}
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[1, 2, 3, 4].map((weekNum) => {
                      const week = weeks.find(w => w.id === weekNum)
                      const lineup = getLineupForWeek(weekNum)
                      const isSubmitted = lineup?.is_submitted
                      const isCurrent = weekNum === currentWeek?.id
                      const isLocked = week ? new Date(week.lockout_time) < new Date() : true
                      const isPending = isCurrent && !isSubmitted && !isLocked
                      const isWeeklyWinner = WEEKLY_WINNERS[weekNum] === entry.id

                      return (
                        <div
                          key={weekNum}
                          className={`rounded py-2 ${
                            isWeeklyWinner
                              ? 'bg-gold-500/20 border border-gold-500/30'
                              : isSubmitted
                                ? 'bg-green-500/10 border border-green-500/20'
                                : isPending
                                  ? 'bg-yellow-500/5 ring-1 ring-inset ring-yellow-500/30'
                                  : 'bg-slate-800/50'
                          }`}
                        >
                          <div className={`text-xs ${
                            isWeeklyWinner ? 'text-gold-400' : isSubmitted ? 'text-green-400' : isPending ? 'text-yellow-400' : 'text-slate-500'
                          }`}>
                            Wk {weekNum}
                          </div>
                          <div className={`text-sm font-medium flex items-center justify-center gap-1 ${
                            isWeeklyWinner ? 'text-gold-400' : isSubmitted ? 'text-green-400' : isPending ? 'text-yellow-400' : 'text-slate-300'
                          }`}>
                            {isWeeklyWinner ? (
                              <>
                                <span>👑</span>
                                <span>{lineup?.total_points?.toFixed(1) || '0.0'}</span>
                              </>
                            ) : isSubmitted ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{lineup?.total_points?.toFixed(1) || '0.0'}</span>
                              </>
                            ) : isPending ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              '--'
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Link>

                {/* Footer with actions */}
                <div className="bg-slate-800/30 px-5 py-3 flex items-center justify-between border-t border-slate-800">
                  <span className="text-sm text-slate-500">
                    {entry.rank ? `Rank ${entry.rank} of ${totalEntries}` : 'Not ranked yet'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/entry/${entry.id}/lineup?week=${currentWeek?.id || 1}`}
                      className="btn-primary py-1.5"
                    >
                      Set Lineup
                    </Link>
                    {!entriesLocked && settings?.current_week_id === 1 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setDeleteModalEntry(entry)
                        }}
                        className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete entry"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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
          {!entriesLocked && settings?.current_week_id === 1 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary px-6 py-3"
            >
              Create Your First Entry
            </button>
          )}
        </div>
      )}

      <CreateEntryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createEntry}
        onSuccess={(entryId) => {
          const currentWeek = weeks.find(w => w.is_current)
          const weekParam = currentWeek ? `?week=${currentWeek.id}` : ''
          navigate(`/entry/${entryId}/lineup${weekParam}`)
        }}
      />

      <DeleteEntryModal
        isOpen={deleteModalEntry !== null}
        onClose={() => setDeleteModalEntry(null)}
        entry={deleteModalEntry}
        onConfirm={deleteEntry}
      />
    </Layout>
  )
}
