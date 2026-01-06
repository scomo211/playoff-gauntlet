import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Entry, Lineup, Week } from '../types/database'
import { formatDate, formatShortDateTime } from '../lib/formatTime'
import Layout from '../components/Layout'

export default function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [entry, setEntry] = useState<Entry | null>(null)
  const [lineups, setLineups] = useState<(Lineup & { week: Week })[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!id || !user) return

      try {
        // Fetch entry
        const { data: entryData, error: entryError } = await supabase
          .from('entries')
          .select('*')
          .eq('id', id)
          .single()

        if (entryError) throw entryError
        if (entryData.user_id !== user.id) {
          setError('You do not have access to this entry')
          return
        }

        setEntry(entryData)

        // Fetch weeks
        const { data: weeksData, error: weeksError } = await supabase
          .from('weeks')
          .select('*')
          .order('id', { ascending: true })

        if (weeksError) throw weeksError
        setWeeks(weeksData)

        // Fetch lineups for this entry
        const { data: lineupsData, error: lineupsError } = await supabase
          .from('lineups')
          .select(`
            *,
            week:weeks(*)
          `)
          .eq('entry_id', id)
          .order('week_id', { ascending: true })

        if (lineupsError) throw lineupsError
        setLineups(lineupsData as (Lineup & { week: Week })[])

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load entry')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, user])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (error || !entry) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error || 'Entry not found'}</p>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    )
  }

  const totalPoints = lineups.reduce((sum, l) => sum + (l.total_points || 0), 0)

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{entry.entry_name}</h1>
            <p className="mt-1 text-gray-600">
              Created {formatDate(entry.created_at)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Points</div>
            <div className="text-3xl font-bold text-blue-600">{totalPoints.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Weekly Lineups */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Weekly Lineups</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {weeks.map((week) => {
            const lineup = lineups.find(l => l.week_id === week.id)
            const isLocked = new Date(week.lockout_time) < new Date()
            const isCurrent = week.is_current
            const isSubmitted = lineup?.is_submitted

            // Determine card styling based on state
            const getCardStyle = () => {
              if (isSubmitted) return 'border-green-300 ring-2 ring-green-100'
              if (isCurrent) return 'border-blue-300 ring-2 ring-blue-100'
              return 'border-gray-200'
            }

            const getHeaderStyle = () => {
              if (isSubmitted) return 'bg-green-50 border-green-200'
              if (isCurrent) return 'bg-blue-50 border-blue-200'
              return 'bg-gray-50 border-gray-100'
            }

            return (
              <div
                key={week.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${getCardStyle()}`}
              >
                <div className={`px-5 py-4 border-b ${getHeaderStyle()}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Week {week.id}: {week.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {week.roster_size} players required
                      </p>
                    </div>
                    {isSubmitted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Submitted
                      </span>
                    )}
                    {!isSubmitted && isCurrent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current Week
                      </span>
                    )}
                    {week.is_complete && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {lineup ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm flex items-center gap-1.5 ${isSubmitted ? 'text-green-600' : 'text-gray-600'}`}>
                          {isSubmitted && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {isSubmitted ? 'Lineup submitted' : 'Lineup in progress'}
                        </span>
                        <span className="text-lg font-semibold text-gray-900">
                          {lineup.total_points?.toFixed(1) || '0.0'} pts
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to={`/entry/${entry.id}/lineup?week=${week.id}`}
                          className={`flex-1 text-center px-4 py-2 text-sm font-medium rounded-lg transition ${
                            isLocked
                              ? 'bg-gray-100 text-gray-600'
                              : isSubmitted
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isLocked ? 'View Lineup' : 'Edit Lineup'}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 mb-3">No lineup set</p>
                      {!isLocked && (
                        <Link
                          to={`/entry/${entry.id}/lineup?week=${week.id}`}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                        >
                          Set Lineup
                        </Link>
                      )}
                      {isLocked && (
                        <p className="text-sm text-red-600">Week is locked</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {isLocked ? (
                        <span className="text-red-600">Locked</span>
                      ) : (
                        <>Locks: {formatShortDateTime(week.lockout_time)}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Used Players Section */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Used Players</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-4">
            Players you've used will appear here after you submit lineups.
          </p>
        </div>
      </div>
    </Layout>
  )
}
