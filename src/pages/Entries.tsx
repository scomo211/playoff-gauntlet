import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useEntries, useLeagueSettings } from '../hooks/useEntries'
import { Entry, Week, Lineup } from '../types/database'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/formatTime'
import CreateEntryModal from '../components/CreateEntryModal'
import DeleteEntryModal from '../components/DeleteEntryModal'

interface EntryWithLineups extends Entry {
  lineups: (Lineup & { week: Week })[]
  rank?: number
}

interface RankedEntry {
  id: string
  total: number
}

export default function Entries() {
  const { entries, loading, createEntry, deleteEntry } = useEntries()
  const { settings } = useLeagueSettings()
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

        // Fetch lineups for user's entries
        const entryIds = entries.map(e => e.id)
        const { data: lineupsData } = await supabase
          .from('lineups')
          .select(`*, week:weeks(*)`)
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

        // Map lineups and ranks to entries
        const mapped = entries.map(entry => {
          const entryRank = rankings.findIndex(r => r.id === entry.id) + 1
          return {
            ...entry,
            lineups: (lineupsData || []).filter(l => l.entry_id === entry.id) as (Lineup & { week: Week })[],
            rank: entryRank > 0 ? entryRank : undefined
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
            const currentWeekLocked = currentWeek ? new Date(currentWeek.lockout_time) < new Date() : true

            return (
              <div key={entry.id} className="card-solid overflow-hidden">
                {/* Entry Header */}
                <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <Link
                        to={`/entry/${entry.id}`}
                        className="text-lg font-semibold text-white hover:text-field-400 transition"
                      >
                        {entry.entry_name}
                      </Link>
                      <p className="text-xs text-slate-500">Created {formatDate(entry.created_at)}</p>
                    </div>
                    {/* Set Lineup Button */}
                    {currentWeek && !currentWeekLocked && (
                      <Link
                        to={`/entry/${entry.id}/lineup?week=${currentWeek.id}`}
                        className="btn-primary py-1.5 px-3 text-sm"
                      >
                        Set Lineup
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    {entry.rank !== undefined && (
                      <div className={`text-center px-3 py-1 rounded-lg ${inTheMoney ? 'bg-gold-500/10 border border-gold-500/20' : ''}`}>
                        <div className="text-xs text-slate-500">Rank</div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xl font-bold ${inTheMoney ? 'text-gold-400' : 'text-white'}`}>
                            {entry.rank}
                          </span>
                          <span className="text-xs text-slate-500">/ {totalEntries}</span>
                          {inTheMoney && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                              $
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Total Points */}
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Total Points</div>
                      <div className={`text-xl font-bold ${inTheMoney ? 'text-gold-400' : 'text-field-400'}`}>
                        {totalPoints.toFixed(1)}
                      </div>
                    </div>
                    {/* Delete Button */}
                    {!entriesLocked && (
                      <button
                        onClick={() => setDeleteModalEntry(entry)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete entry"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Week Columns - Horizontal Compact */}
                <div className="grid grid-cols-4 divide-x divide-slate-800">
                  {weeks.map((week) => {
                    const lineup = entry.lineups.find(l => l.week_id === week.id)
                    const isLocked = new Date(week.lockout_time) < new Date()
                    const isCurrent = week.is_current
                    const isSubmitted = lineup?.is_submitted
                    const isPending = isCurrent && !isSubmitted && !isLocked

                    return (
                      <Link
                        key={week.id}
                        to={`/entry/${entry.id}/lineup?week=${week.id}`}
                        className={`px-3 py-3 flex items-center justify-between gap-2 hover:bg-slate-800/50 transition ${
                          isPending
                            ? 'bg-yellow-500/5 ring-1 ring-inset ring-yellow-500/30'
                            : isCurrent && isSubmitted
                              ? 'bg-green-500/5'
                              : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{week.name}</div>
                          {isSubmitted ? (
                            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : isPending ? (
                            <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : isLocked ? (
                            <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : null}
                        </div>
                        <div className="text-sm font-bold text-white flex-shrink-0">
                          {lineup?.total_points?.toFixed(1) || '0.0'}
                        </div>
                      </Link>
                    )
                  })}
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
