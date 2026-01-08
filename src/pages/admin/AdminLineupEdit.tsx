import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Position } from '../../types/database'
import { useLineup, LineupSlot } from '../../hooks/useLineup'
import { usePlayers, PlayerWithTeam } from '../../hooks/usePlayers'
import { useProjections } from '../../hooks/useProjections'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../../lib/playerImages'
import { formatDateTime } from '../../lib/formatTime'
import AdminLayout from '../../components/AdminLayout'
import PlayerSelectModal from '../../components/PlayerSelectModal'

const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-red-100 text-red-800 border-red-200',
  RB: 'bg-blue-100 text-blue-800 border-blue-200',
  WR: 'bg-green-100 text-green-800 border-green-200',
  TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  K: 'bg-purple-100 text-purple-800 border-purple-200',
  DEF: 'bg-gray-100 text-gray-800 border-gray-200',
}

interface EntryWithProfile {
  id: string
  user_id: string
  entry_name: string
  is_active: boolean
  payment_received: boolean
  created_at: string
  profile?: { display_name: string; email: string } | null
}

export default function AdminLineupEdit() {
  const { entryId } = useParams<{ entryId: string }>()
  const [searchParams] = useSearchParams()
  const weekId = parseInt(searchParams.get('week') || '1', 10)

  const [entry, setEntry] = useState<EntryWithProfile | null>(null)
  const [entryLoading, setEntryLoading] = useState(true)
  const [allWeeks, setAllWeeks] = useState<{ id: number; name: string }[]>([])
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const { players, loading: playersLoading } = usePlayers()
  const { getProjection, loading: projectionsLoading } = useProjections(weekId)

  // Pass isAdmin=true to bypass locks
  const {
    lineup,
    week,
    loading: lineupLoading,
    saving,
    error: lineupError,
    lineupSlots,
    usedPlayerIds,
    isPlayerUsed,
    addPlayer,
    removePlayer,
    submitLineup,
    unsubmitLineup,
  } = useLineup(entryId || '', weekId, true) // true = admin mode

  // Fetch entry details
  useEffect(() => {
    async function fetchEntry() {
      if (!entryId) return

      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*, profile:profiles(display_name, email)')
          .eq('id', entryId)
          .single()

        if (error) throw error
        setEntry(data)
      } catch (err) {
        console.error('Failed to fetch entry:', err)
      } finally {
        setEntryLoading(false)
      }
    }

    fetchEntry()
  }, [entryId])

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

  const handleUnsubmit = async () => {
    if (!confirm('Are you sure you want to unsubmit this lineup? The user will need to resubmit.')) {
      return
    }

    const { error } = await unsubmitLineup()
    if (error) {
      setSubmitError(error)
    } else {
      setSubmitSuccess(false)
    }
  }

  const handleStartEditName = () => {
    setNameInput(entry?.entry_name || '')
    setEditingName(true)
  }

  const handleSaveName = async () => {
    if (!entry || !nameInput.trim()) return

    setNameSaving(true)
    try {
      const { error } = await supabase
        .from('entries')
        .update({ entry_name: nameInput.trim() })
        .eq('id', entry.id)

      if (error) throw error

      setEntry({ ...entry, entry_name: nameInput.trim() })
      setEditingName(false)
    } catch (err) {
      console.error('Failed to update entry name:', err)
      alert('Failed to update entry name')
    } finally {
      setNameSaving(false)
    }
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setNameInput('')
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
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  if (lineupError || !entry) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{lineupError || 'Entry not found'}</p>
          <Link to="/admin/entries" className="text-blue-600 hover:text-blue-700">
            Back to Entries
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* Back link */}
      <div className="mb-6">
        <Link
          to={`/admin/user/${entry.user_id}`}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to User
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Week {weekId}: {week?.name}
            </h1>
            <div className="mt-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEditName()
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameSaving}
                    className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                    title="Save"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{entry.entry_name}</span>
                  <button
                    onClick={handleStartEditName}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Rename entry"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {entry.profile?.display_name} ({entry.profile?.email})
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Points</div>
            <div className="text-2xl font-bold text-blue-600">{totalPoints.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Admin Notice */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Admin Mode</p>
            <p>You can edit this lineup regardless of lockout status or submission state.</p>
          </div>
        </div>
      </div>

      {/* Submission Status */}
      {lineup?.is_submitted && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-green-800">
                <p className="font-medium">Lineup submitted</p>
                <p>Submitted {lineup.submitted_at ? formatDateTime(lineup.submitted_at) : ''}</p>
              </div>
            </div>
            <button
              onClick={handleUnsubmit}
              className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition"
            >
              Unsubmit
            </button>
          </div>
        </div>
      )}

      {/* Week selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {allWeeks.map((w) => (
          <Link
            key={w.id}
            to={`/admin/entry/${entryId}/lineup?week=${w.id}`}
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
            <h2 className="font-semibold text-gray-900">Lineup</h2>

            {!lineup?.is_submitted && (
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
                  disabled={saving || !isComplete}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Submitting...' : 'Submit Lineup'}
                </button>
              </div>
            )}

            {lineup?.is_submitted && (
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
        {(submitError || submitSuccess) && (
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

        <div className="divide-y divide-gray-100">
          {lineupSlots.map((slot) => (
            <div
              key={slot.slot}
              className={`px-6 py-4 flex items-center justify-between ${
                !slot.player ? 'bg-yellow-50' : ''
              }`}
            >
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

                <div className="flex items-center gap-2">
                  {slot.player && (
                    <button
                      onClick={() => handleRemovePlayer(slot)}
                      disabled={saving}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      title="Remove player"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectingSlot(slot)}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
                  >
                    {slot.player ? 'Change' : 'Select'}
                  </button>
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
              These players have been used in previous weeks by this entry.
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
    </AdminLayout>
  )
}
