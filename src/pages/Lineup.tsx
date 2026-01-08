import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Entry, Position } from '../types/database'
import { useLineup, LineupSlot } from '../hooks/useLineup'
import { usePlayers, PlayerWithTeam } from '../hooks/usePlayers'
import { useProjections } from '../hooks/useProjections'
import { useIsAdmin } from '../hooks/useAdmin'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'
import { formatDeadline, formatMobileDeadline } from '../lib/formatTime'
import Layout from '../components/Layout'
import PlayerSelectModal from '../components/PlayerSelectModal'
import Toast from '../components/Toast'

const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-red-100 text-red-800 border-red-200',
  RB: 'bg-blue-100 text-blue-800 border-blue-200',
  WR: 'bg-green-100 text-green-800 border-green-200',
  TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  K: 'bg-purple-100 text-purple-800 border-purple-200',
  DEF: 'bg-gray-100 text-gray-800 border-gray-200',
}

// Format player stats as inline text
function formatPlayerStats(stats: {
  pass_cmp: number
  pass_att: number
  pass_yards: number
  pass_td: number
  rush_att: number
  rush_yards: number
  rush_td: number
  receptions: number
  rec_yards: number
  rec_td: number
} | null): string {
  if (!stats) return ''

  const parts: string[] = []

  // Passing stats: "14/18, 179 yd, 1 TD"
  if (stats.pass_att > 0 || stats.pass_yards > 0 || stats.pass_td > 0) {
    parts.push(`${stats.pass_cmp}/${stats.pass_att}, ${stats.pass_yards} yd, ${stats.pass_td} TD`)
  }

  // Rushing stats: "3 car, 97 yd, 1 TD"
  if (stats.rush_att > 0 || stats.rush_yards !== 0 || stats.rush_td > 0) {
    parts.push(`${stats.rush_att} car, ${stats.rush_yards} yd, ${stats.rush_td} TD`)
  }

  // Receiving stats: "2 rec, 18 yd, 1 TD"
  if (stats.receptions > 0 || stats.rec_yards > 0 || stats.rec_td > 0) {
    parts.push(`${stats.receptions} rec, ${stats.rec_yards} yd, ${stats.rec_td} TD`)
  }

  return parts.join(' | ')
}

export default function Lineup() {
  const { id: entryId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const weekId = parseInt(searchParams.get('week') || '1', 10)
  const { user } = useAuth()

  const [entry, setEntry] = useState<Entry | null>(null)
  const [entryLoading, setEntryLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [allWeeks, setAllWeeks] = useState<{ id: number; name: string }[]>([])
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [topScorersByPosition, setTopScorersByPosition] = useState<Map<Position, { playerId: string; points: number }>>(new Map())
  const [weekRank, setWeekRank] = useState<{ rank: number; total: number } | null>(null)

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
    isPastWeek,
    isPlayerUsed,
    addPlayer,
    removePlayer,
    submitLineup,
  } = useLineup(entryId || '', weekId, isAdmin)

  // Fetch entry details
  useEffect(() => {
    async function fetchEntry() {
      if (!entryId) return

      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('id', entryId)
          .single()

        if (error) throw error
        setEntry(data)
        setIsOwner(user?.id === data.user_id)
      } catch (err) {
        console.error('Failed to fetch entry:', err)
      } finally {
        setEntryLoading(false)
      }
    }

    fetchEntry()
  }, [entryId, user])

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

  // Fetch top scorers by position for the week
  useEffect(() => {
    async function fetchTopScorers() {
      if (!weekId || players.length === 0) return

      // Get all player stats for this week
      const { data: statsData } = await supabase
        .from('player_weekly_stats')
        .select('player_id, total_points')
        .eq('week_id', weekId)
        .gt('total_points', 0)

      if (!statsData) return

      // Group by position and find max
      const topByPosition = new Map<Position, { playerId: string; points: number }>()

      for (const stat of statsData) {
        const player = players.find(p => p.id === stat.player_id)
        if (!player) continue

        const position = player.position as Position
        const current = topByPosition.get(position)

        if (!current || stat.total_points > current.points) {
          topByPosition.set(position, { playerId: stat.player_id, points: stat.total_points })
        }
      }

      setTopScorersByPosition(topByPosition)
    }

    fetchTopScorers()
  }, [weekId, players])

  // Fetch rank among all entries for this week
  useEffect(() => {
    async function fetchRank() {
      if (!weekId || !lineup) return

      // Get all lineups for this week with their total points
      const { data: allLineups } = await supabase
        .from('lineups')
        .select('id, total_points')
        .eq('week_id', weekId)

      if (!allLineups) return

      // Sort by points descending and find rank
      const sorted = allLineups.sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
      const rank = sorted.findIndex(l => l.id === lineup.id) + 1

      setWeekRank({ rank, total: sorted.length })
    }

    fetchRank()
  }, [weekId, lineup])

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
      setShowToast(true)
    }
  }

  // Calculate lineup stats
  const filledSlots = lineupSlots.filter(s => s.player !== null).length
  const totalSlots = lineupSlots.length
  const isComplete = filledSlots === totalSlots
  const totalPoints = lineupSlots.reduce((sum, s) => sum + s.points, 0)

  // Can edit if: owner AND not locked
  // Admins must use the admin panel to edit other users' lineups
  const canEdit = isOwner && !isLocked

  // Check if the week's lockout time has passed (for visibility purposes)
  // This is separate from isLocked because entries_locked shouldn't reveal lineups
  const hasLockoutPassed = week && new Date(week.lockout_time) < new Date()

  // Can view lineup if:
  // 1. Owner (can always see their own lineups)
  // 2. Past week (all past weeks are visible to everyone)
  // 3. Week's lockout time has passed (deadline passed = visible to everyone)
  // entries_locked setting does NOT affect visibility - only editability
  const canViewLineup = isOwner || isPastWeek || hasLockoutPassed

  // Get lock message based on reason
  const getLockMessage = () => {
    switch (lockReason) {
      case 'past_week':
        return 'Week finalized'
      case 'entries_locked':
        return 'Lineups are locked'
      case 'not_yet_open':
        return 'Week not yet open'
      case 'deadline':
        return 'Deadline passed'
      default:
        return 'Locked'
    }
  }

  // Check if a player is the top scorer at their position
  const isTopScorer = (slot: LineupSlot): boolean => {
    if (!slot.player || slot.points === 0) return false
    const topScorer = topScorersByPosition.get(slot.position)
    return topScorer?.playerId === slot.player.id
  }

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
          to={isOwner ? '/entries' : '/dashboard'}
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {isOwner ? 'Back to My Entries' : 'Back to Dashboard'}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Week {weekId}: {week?.name}
              </h1>
              {/* Compact status badges - desktop only */}
              {isLocked && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {getLockMessage()}
                </span>
              )}
              {lineup?.is_submitted && !isLocked && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submitted
                </span>
              )}
              {!isLocked && !lineup?.is_submitted && week && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDeadline(week.lockout_time)}
                </span>
              )}
            </div>
            <p className="mt-1 text-slate-400">
              {entry.entry_name}
              {!isOwner && <span className="text-slate-500 ml-2">(View Only)</span>}
            </p>
          </div>
          {canViewLineup ? (
            <div className="bg-gradient-to-br from-field-500/20 to-field-600/10 border border-field-500/30 rounded-xl px-5 py-3 text-center shadow-lg shadow-field-500/10">
              <div className="text-xs font-medium text-field-300 uppercase tracking-wider mb-1">Total Points</div>
              <div className="text-3xl font-bold text-white">{totalPoints.toFixed(1)}</div>
              {weekRank && (
                <div className="text-xs text-slate-400 mt-1">
                  Rank: {weekRank.rank} of {weekRank.total}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-5 py-3 text-center">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Points</div>
              <div className="text-3xl font-bold text-slate-600">--</div>
            </div>
          )}
        </div>

        {/* Mobile status row */}
        <div className="md:hidden mt-3">
          {isLocked && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm text-red-400">{getLockMessage()}</span>
            </div>
          )}
          {lineup?.is_submitted && !isLocked && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-400">Lineup submitted</span>
            </div>
          )}
          {!isLocked && !lineup?.is_submitted && week && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-yellow-400">{formatMobileDeadline(week.lockout_time)}</span>
              </div>
              <span className="text-sm text-yellow-400 flex-shrink-0">{filledSlots}/{totalSlots}</span>
            </div>
          )}
        </div>
      </div>

      {/* Week selector */}
      <div className="mb-6 flex gap-1.5 sm:gap-2">
        {allWeeks.map((w) => {
          // Abbreviate week names for mobile
          const shortName = w.name === 'Wild Card' ? 'Wild' :
                           w.name === 'Divisional' ? 'Div' :
                           w.name === 'Championship' ? 'Champ' :
                           w.name === 'Super Bowl' ? 'SB' : w.name
          return (
            <Link
              key={w.id}
              to={`/entry/${entryId}/lineup?week=${w.id}`}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex-1 text-center ${
                w.id === weekId
                  ? 'bg-field-500 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="sm:hidden">{shortName}</span>
              <span className="hidden sm:inline">{w.name}</span>
            </Link>
          )
        })}
      </div>

      {/* Lineup Grid */}
      <div className="card-solid overflow-hidden">
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">{isOwner ? 'Your Lineup' : 'Lineup'}</h2>
              <p className="text-xs text-slate-500 mt-1">Stats update live during games</p>
            </div>

            {/* Submit Button - shown when not locked and not submitted */}
            {canEdit && !lineup?.is_submitted && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">
                  {isComplete ? (
                    <span className="text-green-400 font-medium">{filledSlots}/{totalSlots} slots</span>
                  ) : (
                    <span className="text-yellow-400">{filledSlots}/{totalSlots} slots</span>
                  )}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !isComplete || submitSuccess}
                  className="btn-primary"
                >
                  {saving ? 'Submitting...' : 'Submit Lineup'}
                </button>
              </div>
            )}

            {/* Submitted status badge */}
            {(canEdit || !isOwner) && lineup?.is_submitted && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Submitted</span>
              </div>
            )}
          </div>
        </div>

        {/* Submit feedback messages */}
        {canEdit && !lineup?.is_submitted && (submitError || submitSuccess) && (
          <div className="px-6 py-3 border-b border-slate-700">
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">
                Lineup submitted successfully!
              </div>
            )}
          </div>
        )}

        {/* Hidden lineup overlay for other users before lockout */}
        {!canViewLineup ? (
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Lineup Hidden</h3>
            <p className="text-slate-400 max-w-sm mx-auto">
              You can see other players' lineups after kickoff for this week.
            </p>
          </div>
        ) : (
          <>
            {/* Header Row */}
            <div className="hidden md:flex items-center justify-between px-6 py-2 bg-slate-800/30 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <div>Player</div>
              <div>Points</div>
            </div>

            <div className="divide-y divide-slate-800">
          {lineupSlots.map((slot) => (
            <div
              key={slot.slot}
              className={`px-6 py-4 ${
                !slot.player && canEdit && !lineup?.is_submitted ? 'bg-yellow-500/5' : ''
              }`}
            >
              {/* Mobile Layout */}
              <div className="md:hidden flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span
                    onClick={canEdit ? () => setSelectingSlot(slot) : undefined}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold border ${POSITION_COLORS[slot.position]} ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-field-400/50' : ''}`}
                  >
                    {slot.slot}
                  </span>

                  {slot.player ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getPlayerHeadshotUrl(slot.player.id)}
                        alt={slot.player.name}
                        className="w-10 h-10 rounded-full bg-slate-700 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                        }}
                      />
                      <div>
                        <div className="font-medium text-white">{slot.player.name}</div>
                        <div className="text-sm text-slate-400">
                          {slot.player.team?.city} {slot.player.team?.name}
                        </div>
                        {formatPlayerStats(slot.stats) && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatPlayerStats(slot.stats)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">Empty slot</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {slot.player && (
                    <span className={`text-lg font-semibold flex items-center gap-1 ${isTopScorer(slot) ? 'text-yellow-400' : 'text-field-400'}`}>
                      {isTopScorer(slot) && <span>👑</span>}
                      {slot.points.toFixed(1)}
                    </span>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => setSelectingSlot(slot)}
                      disabled={saving}
                      className="p-1.5 text-slate-500 hover:text-field-400 hover:bg-field-500/10 rounded transition disabled:opacity-50"
                      title={slot.player ? 'Change player' : 'Select player'}
                    >
                      {slot.player ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop Layout with Inline Stats */}
              <div className="hidden md:flex items-center justify-between">
                {/* Player Info */}
                <div className="flex items-center gap-3">
                  <span
                    onClick={canEdit ? () => setSelectingSlot(slot) : undefined}
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${POSITION_COLORS[slot.position]} ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-field-400/50' : ''}`}
                  >
                    {slot.slot}
                  </span>

                  {slot.player ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getPlayerHeadshotUrl(slot.player.id)}
                        alt={slot.player.name}
                        className="w-10 h-10 rounded-full bg-slate-700 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                        }}
                      />
                      <div>
                        <div className="font-medium text-white">{slot.player.name}</div>
                        <div className="text-sm text-slate-400">
                          {slot.player.team?.city} {slot.player.team?.name}
                        </div>
                        {formatPlayerStats(slot.stats) && (
                          <div className="text-sm text-slate-500 mt-0.5">
                            {formatPlayerStats(slot.stats)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-sm">Empty slot</span>
                  )}
                </div>

                {/* Points and Actions */}
                <div className="flex items-center gap-6">
                  {slot.player && (
                    <span className={`text-lg font-semibold w-20 text-right flex items-center justify-end gap-1 ${isTopScorer(slot) ? 'text-yellow-400' : 'text-field-400'}`}>
                      {isTopScorer(slot) && <span>👑</span>}
                      {slot.points.toFixed(1)}
                    </span>
                  )}

                  {canEdit && (
                    <div className="flex items-center gap-1 justify-end">
                      {slot.player && (
                        <button
                          onClick={() => handleRemovePlayer(slot)}
                          disabled={saving}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-50"
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
                        className="p-1.5 text-slate-500 hover:text-field-400 hover:bg-field-500/10 rounded transition disabled:opacity-50"
                        title={slot.player ? 'Change player' : 'Select player'}
                      >
                        {slot.player ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
            </div>
          </>
        )}
      </div>

      {/* Used Players - only show for owner */}
      {isOwner && usedPlayerIds.size > 0 && (() => {
        // Group used players by position
        const usedByPosition: Record<Position, PlayerWithTeam[]> = {
          QB: [], RB: [], WR: [], TE: [], K: [], DEF: []
        }
        Array.from(usedPlayerIds).forEach(playerId => {
          const player = players.find(p => p.id === playerId)
          if (player && player.position in usedByPosition) {
            usedByPosition[player.position as Position].push(player)
          }
        })
        const positionsWithPlayers = (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).filter(
          pos => usedByPosition[pos].length > 0
        )

        return (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              Previously Used Players ({usedPlayerIds.size})
            </h3>
            <div className="card-solid p-4">
              <p className="text-sm text-slate-400 mb-4">
                These players have been used in previous weeks and cannot be selected again.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {positionsWithPlayers.map(position => (
                  <div key={position}>
                    <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border mb-2 ${POSITION_COLORS[position]}`}>
                      {position}
                    </div>
                    <div className="space-y-2">
                      {usedByPosition[position].map(player => (
                        <div
                          key={player.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <img
                            src={getPlayerHeadshotUrl(player.id)}
                            alt={player.name}
                            className="w-6 h-6 rounded-full bg-slate-700 object-cover flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                            }}
                          />
                          <span className="text-slate-300 truncate">{player.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* Success Toast */}
      <Toast
        isVisible={showToast}
        message="Lineup Submitted!"
        onClose={() => setShowToast(false)}
        duration={3500}
        icon="logo"
      />
    </Layout>
  )
}
