import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Entry, Position } from '../types/database'
import { useLineup, LineupSlot } from '../hooks/useLineup'
import { usePlayers, PlayerWithTeam } from '../hooks/usePlayers'
import { useProjections } from '../hooks/useProjections'
import { useIsAdmin } from '../hooks/useAdmin'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'
import { formatDateTime, formatDeadline } from '../lib/formatTime'
import Layout from '../components/Layout'
import PlayerSelectModal from '../components/PlayerSelectModal'

const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-red-100 text-red-800 border-red-200',
  RB: 'bg-blue-100 text-blue-800 border-blue-200',
  WR: 'bg-green-100 text-green-800 border-green-200',
  TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  K: 'bg-purple-100 text-purple-800 border-purple-200',
  DEF: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function Lineup() {
  const { id: entryId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const weekId = parseInt(searchParams.get('week') || '1', 10)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [entry, setEntry] = useState<Entry | null>(null)
  const [entryLoading, setEntryLoading] = useState(true)
  const [allWeeks, setAllWeeks] = useState<{ id: number; name: string }[]>([])
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const { players, loading: playersLoading } = usePlayers()
  const { getProjection, loading: projectionsLoading } = useProjections(weekId)
  const { isAdmin } = useIsAdmin()
  const {
    lineup,
    week,
    loading: lineupLoading,
    saving,
    error: lineupError,
    lineupSlots,
    usedPlayerIds,
    isLocked,
    lockReason,
    isPlayerUsed,
    addPlayer,
    removePlayer,
    submitLineup,
  } = useLineup(entryId || '', weekId, isAdmin)

  // Fetch entry details
  useEffect(() => {
    async function fetchEntry() {
      if (!entryId || !user) return

      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('id', entryId)
          .single()

        if (error) throw error
        if (data.user_id !== user.id) {
          navigate('/dashboard')
          return
        }
        setEntry(data)
      } catch (err) {
        console.error('Failed to fetch entry:', err)
      } finally {
        setEntryLoading(false)
      }
    }

    fetchEntry()
  }, [entryId, user, navigate])

  // Fetch all weeks for tab names
  useEffect(() => {
    async function fetchWeeks() {
      const { data } = await supabase
        .from('weeks')
        .select('id, name')
        .order('id')
      if (data) setAllWeeks(data)
    }
    fetchWeeks()
  }, [])

  const handleSelectPlayer = async (player: PlayerWithTeam) => {
    if (!selectingSlot) return

    const { error } = await addPlayer(selectingSlot.slot, player, lineup?.is_submitted || false)
    if (error) {
      console.error('Failed to add player:', error)
    }
    setSelectingSlot(null)
  }

  const handleRemovePlayer = async (slot: LineupSlot) => {
    if (isLocked) return

    const { error } = await removePlayer(slot.slot, lineup?.is_submitted || false)
    if (error) {
      console.error('Failed to remove player:', error)
    }
  }

  const handleSubmit = async () => {
    setSubmitError(null)
    setSubmitSuccess(false)

    const { error } = await submitLineup()
    if (error) {
      setSubmitError(error)
    } else {
      setSubmitSuccess(true)
    }
  }

  // Calculate lineup stats
  const filledSlots = lineupSlots.filter(s => s.player !== null).length
  const totalSlots = lineupSlots.length
  const isComplete = filledSlots === totalSlots
  const totalPoints = lineupSlots.reduce((sum, s) => sum + s.points, 0)

  // Get current lineup player IDs
  const currentLineupPlayerIds = lineupSlots
    .filter(s => s.player !== null)
    .map(s => s.player!.id)

  const loading = entryLoading || lineupLoading || playersLoading

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (lineupError || !entry) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{lineupError || 'Entry not found'}</p>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/entry/${entryId}`}
          className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {entry.entry_name}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Week {weekId}: {week?.name}
            </h1>
            <p className="mt-1 text-gray-600">
              {entry.entry_name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Points</div>
            <div className="text-2xl font-bold text-blue-600">{totalPoints.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {isLocked && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-sm text-red-800">
              {lockReason === 'not_yet_open' ? (
                <>
                  <p className="font-medium">Week not yet open</p>
                  <p>Rosters open {week?.opens_at ? formatDateTime(week.opens_at) : 'soon'}.</p>
                </>
              ) : (
                <>
                  <p className="font-medium">Week is locked</p>
                  <p>Lineup changes are no longer allowed.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {lineup?.is_submitted && !isLocked && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-green-800">
              <p className="font-medium">Lineup submitted</p>
              <p>Submitted {lineup.submitted_at ? formatDateTime(lineup.submitted_at) : ''}</p>
            </div>
          </div>
        </div>
      )}

      {!isLocked && !lineup?.is_submitted && week && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Deadline to submit your roster</p>
                <p>{formatDeadline(week.lockout_time)}</p>
              </div>
            </div>
            <div className="text-sm text-blue-800">
              {filledSlots}/{totalSlots} slots filled
            </div>
          </div>
        </div>
      )}

      {/* Week selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {allWeeks.map((w) => (
          <Link
            key={w.id}
            to={`/entry/${entryId}/lineup?week=${w.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              w.id === weekId
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {w.name}
          </Link>
        ))}
      </div>

      {/* Lineup Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Your Lineup</h2>
              <p className="text-xs text-gray-500 mt-1">Stats update live during games</p>
            </div>

            {/* Submit Button - shown when not locked and not submitted */}
            {!isLocked && !lineup?.is_submitted && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {isComplete ? (
                    <span className="text-green-600 font-medium">{filledSlots}/{totalSlots} slots</span>
                  ) : (
                    <span className="text-yellow-600">{filledSlots}/{totalSlots} slots</span>
                  )}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !isComplete || submitSuccess}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Submitting...' : 'Submit Lineup'}
                </button>
              </div>
            )}

            {/* Submitted status badge */}
            {!isLocked && lineup?.is_submitted && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Submitted</span>
              </div>
            )}
          </div>
        </div>

        {/* Submit feedback messages */}
        {!isLocked && !lineup?.is_submitted && (submitError || submitSuccess) && (
          <div className="px-6 py-3 border-b border-gray-200">
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                Lineup submitted successfully!
              </div>
            )}
          </div>
        )}

        {/* Stats Header */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-2 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
          <div className="col-span-4">Player</div>
          <div className="text-center">Pass Yds</div>
          <div className="text-center">Pass TD</div>
          <div className="text-center">Rush Yds</div>
          <div className="text-center">Rush TD</div>
          <div className="text-center">Rec Yds</div>
          <div className="text-center">Rec TD</div>
          <div className="text-center">Points</div>
          <div className="text-right">Action</div>
        </div>

        <div className="divide-y divide-gray-100">
          {lineupSlots.map((slot) => (
            <div
              key={slot.slot}
              className={`px-6 py-4 ${
                !slot.player && !isLocked && !lineup?.is_submitted ? 'bg-yellow-50' : ''
              }`}
            >
              {/* Mobile Layout */}
              <div className="md:hidden flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-semibold border ${POSITION_COLORS[slot.position]}`}
                  >
                    {slot.slot}
                  </span>

                  {slot.player ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getPlayerHeadshotUrl(slot.player.id)}
                        alt={slot.player.name}
                        className="w-10 h-10 rounded-full bg-gray-200 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{slot.player.name}</div>
                        <div className="text-sm text-gray-500">
                          {slot.player.team?.city} {slot.player.team?.name}
                        </div>
                        {slot.stats && (
                          <div className="text-xs text-gray-400 mt-1">
                            {slot.stats.pass_yards > 0 && `${slot.stats.pass_yards} pass yds`}
                            {slot.stats.rush_yards > 0 && ` ${slot.stats.rush_yards} rush yds`}
                            {slot.stats.rec_yards > 0 && ` ${slot.stats.rec_yards} rec yds`}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Empty slot</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {slot.player && (
                    <span className="text-lg font-semibold text-gray-900">
                      {slot.points.toFixed(1)}
                    </span>
                  )}

                  {!isLocked && (
                    <button
                      onClick={() => setSelectingSlot(slot)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
                    >
                      {slot.player ? 'Change' : 'Select'}
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop Layout with Stats */}
              <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                {/* Player Info */}
                <div className="col-span-4 flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${POSITION_COLORS[slot.position]}`}
                  >
                    {slot.slot}
                  </span>

                  {slot.player ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getPlayerHeadshotUrl(slot.player.id)}
                        alt={slot.player.name}
                        className="w-8 h-8 rounded-full bg-gray-200 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                        }}
                      />
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{slot.player.name}</div>
                        <div className="text-xs text-gray-500">
                          {slot.player.team?.city} {slot.player.team?.name}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Empty slot</span>
                  )}
                </div>

                {/* Stats Columns */}
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.pass_yards || '--'}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.pass_td || '--'}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.rush_yards || '--'}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.rush_td || '--'}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.rec_yards || '--'}
                </div>
                <div className="text-center text-sm text-gray-600">
                  {slot.stats?.rec_td || '--'}
                </div>

                {/* Points */}
                <div className="text-center">
                  {slot.player && (
                    <span className="text-sm font-semibold text-blue-600">
                      {slot.points.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="text-right">
                  {!isLocked && (
                    <div className="flex items-center justify-end gap-2">
                      {slot.player && (
                        <button
                          onClick={() => handleRemovePlayer(slot)}
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                          title="Remove player"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectingSlot(slot)}
                        disabled={saving}
                        className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition disabled:opacity-50"
                      >
                        {slot.player ? 'Change' : 'Select'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Used Players */}
      {usedPlayerIds.size > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Previously Used Players ({usedPlayerIds.size})
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-3">
              These players have been used in previous weeks and cannot be selected again.
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(usedPlayerIds).map(playerId => {
                const player = players.find(p => p.id === playerId)
                if (!player) return null
                return (
                  <span
                    key={playerId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm"
                  >
                    <img
                      src={getPlayerHeadshotUrl(player.id)}
                      alt={player.name}
                      className="w-6 h-6 rounded-full bg-gray-200 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                      }}
                    />
                    <span className="font-medium">{player.name}</span>
                    <span className="text-gray-400">({player.position})</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Player Select Modal */}
      {selectingSlot && (
        <PlayerSelectModal
          isOpen={true}
          onClose={() => setSelectingSlot(null)}
          onSelect={handleSelectPlayer}
          position={selectingSlot.position}
          players={players}
          currentLineupPlayerIds={currentLineupPlayerIds}
          isPlayerUsed={isPlayerUsed}
          weekId={weekId}
          getProjection={getProjection}
          projectionsLoading={projectionsLoading}
        />
      )}
    </Layout>
  )
}
