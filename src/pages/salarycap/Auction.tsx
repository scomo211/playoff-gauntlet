import { useState, useEffect, useRef, useMemo } from 'react'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { useAuction } from '../../hooks/useAuction'
import { calculateSecondsRemaining } from '../../types/auction'

// Constants
const BASE_CAP = 400
const ROSTER_MAX = 24

// Countdown timer deadline - Sunday, August 16, 2026 at 8:00 PM ET
const DRAFT_DEADLINE = new Date('2026-08-16T20:00:00-04:00')
const COUNTDOWN_START = new Date('2026-08-09T08:00:00-04:00')

// Demo data for design preview (used when auction hasn't started)
const DEMO_CURRENT_ITEM = {
  player: { name: 'Bijan Robinson', position: 'RB', nfl_team: 'ATL', is_rookie: false },
  current_bid: 97,
  timer_end_at: null, // Will use demo timer
  status: 'active' as const,
  high_bidder: { owner_name: 'Tim Meyers' },
}

const DEMO_BIDS = [
  { name: 'Tim Meyers', amount: 97, isYou: false },
  { name: 'Scott Moran', amount: 95, isYou: true },
  { name: 'Johnny Goodwin', amount: 92, isYou: false },
]

const DEMO_RESULTS = [
  { id: '1', player: { name: 'Ja\'Marr Chase', position: 'WR', is_rookie: false }, winner: { owner_name: 'Zach Moore' }, winning_bid: 142 },
  { id: '2', player: { name: 'CeeDee Lamb', position: 'WR', is_rookie: false }, winner: { owner_name: 'Ryan Hossick' }, winning_bid: 138 },
  { id: '3', player: { name: 'Breece Hall', position: 'RB', is_rookie: false }, winner: { owner_name: 'Tyler Bulger' }, winning_bid: 115 },
  { id: '4', player: { name: 'Amon-Ra St. Brown', position: 'WR', is_rookie: false }, winner: { owner_name: 'Nick Meyer' }, winning_bid: 98 },
  { id: '5', player: { name: 'Josh Allen', position: 'QB', is_rookie: false }, winner: { owner_name: 'Brad Wandell' }, winning_bid: 45 },
  { id: '6', player: { name: 'Travis Kelce', position: 'TE', is_rookie: false }, winner: { owner_name: 'Josh Sacks' }, winning_bid: 38 },
  { id: '7', player: { name: 'Jalen Hurts', position: 'QB', is_rookie: false }, winner: { owner_name: 'Brent Alexander' }, winning_bid: 42 },
  { id: '8', player: { name: 'Jahmyr Gibbs', position: 'RB', is_rookie: false }, winner: { owner_name: 'Nick Scott' }, winning_bid: 89 },
]

// Helpers
function initials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('')
}

// Position colors
const POS_COLOR: Record<string, string> = {
  QB: 'text-pos-qb', RB: 'text-pos-rb', WR: 'text-pos-wr',
  TE: 'text-pos-te', K: 'text-pos-k', DEF: 'text-pos-def',
}

// Avatar component matching renders.html
function Avatar({ name, position, size = 'md' }: { name: string; position: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-[30px] h-[30px] rounded-[8px] text-[10.5px]',
    md: 'w-[42px] h-[42px] rounded-[11px] text-[12.5px]',
    lg: 'w-[84px] h-[84px] rounded-[20px] text-[25px]',
  }
  const posSize = {
    sm: 'text-[6px] py-[1px]',
    md: 'text-[7.5px] py-[2px]',
    lg: 'text-[10px] py-[4px] tracking-[0.14em]',
  }
  return (
    <div className={`${sizeClasses[size]} bg-surface-well border border-hairline-strong flex items-center justify-center font-data font-bold text-[#4d5766] flex-none relative overflow-hidden`}>
      {initials(name)}
      <span className={`absolute bottom-0 left-0 right-0 ${posSize[size]} font-bold tracking-[0.1em] bg-[rgba(9,12,17,0.85)] text-center ${POS_COLOR[position] || 'text-fg-subtle'}`}>
        {position}
      </span>
    </div>
  )
}

// Rookie badge
function RookieBadge() {
  return (
    <span className="inline-block font-data text-[9px] font-bold text-gold-500 bg-gold-500/15 px-[5px] py-[1px] rounded-[4px] ml-[6px]">
      R
    </span>
  )
}

export default function Auction() {
  const {
    auction,
    currentItem,
    recentBids,
    recentResults,
    owners,
    ownerStates,
    availablePlayers,
    loading,
    isMyTurn,
    currentNominator,
    myOwnerId,
    myOwnerState,
    nominate,
    placeBid,
    closeAuction,
  } = useAuction()

  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const [rookiesOnly, setRookiesOnly] = useState(false)
  const [customBid, setCustomBid] = useState('')
  const [showNominateModal, setShowNominateModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<typeof availablePlayers[0] | null>(null)
  const [nominateBidAmount, setNominateBidAmount] = useState('1')
  const [bidding, setBidding] = useState(false)
  const [bidError, setBidError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const bidRef = useRef<HTMLDivElement>(null)
  const prevBid = useRef(0)

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Countdown timer state for deadline
  const [deadlineTimeLeft, setDeadlineTimeLeft] = useState(() => Math.max(0, DRAFT_DEADLINE.getTime() - Date.now()))

  // Update deadline countdown every second
  useEffect(() => {
    if (deadlineTimeLeft <= 0) return
    const id = setInterval(() => {
      setDeadlineTimeLeft(Math.max(0, DRAFT_DEADLINE.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [deadlineTimeLeft])

  // Demo timer for preview mode (cycles between 8-20 seconds)
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(15)
  useEffect(() => {
    const id = setInterval(() => {
      setDemoSecondsLeft(prev => {
        if (prev <= 1) return 20
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Update timer every 100ms
  useEffect(() => {
    if (!currentItem?.timer_end_at) {
      setSecondsLeft(0)
      return
    }
    setSecondsLeft(calculateSecondsRemaining(currentItem.timer_end_at))
    const interval = setInterval(() => {
      setSecondsLeft(calculateSecondsRemaining(currentItem.timer_end_at))
    }, 100)
    return () => clearInterval(interval)
  }, [currentItem?.timer_end_at])

  // Bump animation when bid changes
  useEffect(() => {
    if (currentItem && currentItem.current_bid !== prevBid.current && bidRef.current) {
      const el = bidRef.current
      el.classList.remove('animate-bump')
      void el.offsetWidth
      el.classList.add('animate-bump')
      prevBid.current = currentItem.current_bid
    }
  }, [currentItem, currentItem?.current_bid])

  // Filter and sort players by fantasy rank
  const filteredPlayers = useMemo(() => {
    const filtered = availablePlayers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter
      const matchesRookie = !rookiesOnly || p.is_rookie
      return matchesSearch && matchesPosition && matchesRookie
    })
    // Sort by fantasy_rank ascending (best ranked first, nulls at end)
    return filtered.sort((a, b) => {
      const rankA = a.fantasy_rank ?? 9999
      const rankB = b.fantasy_rank ?? 9999
      return rankA - rankB
    })
  }, [availablePlayers, searchQuery, positionFilter, rookiesOnly])

  // Auto-close auction when timer expires
  useEffect(() => {
    if (!currentItem || currentItem.status !== 'active') return

    const checkTimer = () => {
      const remaining = calculateSecondsRemaining(currentItem.timer_end_at)
      if (remaining <= 0) {
        closeAuction()
      }
    }

    timerRef.current = setInterval(checkTimer, 500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentItem, closeAuction])

  const handleBid = async (amount: number) => {
    if (!currentItem) return
    setBidding(true)
    setBidError(null)

    const result = await placeBid(amount)
    if (result.error) {
      setBidError(result.error)
    }
    setBidding(false)
  }

  const handleCustomBid = () => {
    const v = parseInt(customBid, 10)
    if (v > (currentItem?.current_bid || 0) && v <= (myOwnerState?.maxBid || 0)) {
      handleBid(v)
    }
  }

  const handleNominate = async () => {
    if (!selectedPlayer) return
    setBidding(true)
    setBidError(null)

    const amount = parseInt(nominateBidAmount, 10) || 1
    const result = await nominate(selectedPlayer.id, amount)
    if (result.error) {
      setBidError(result.error)
    } else {
      setShowNominateModal(false)
      setSelectedPlayer(null)
      setNominateBidAmount('1')
    }
    setBidding(false)
  }

  const openNominateModal = (player: typeof availablePlayers[0]) => {
    setSelectedPlayer(player)
    setNominateBidAmount('1')
    setBidError(null)
    setShowNominateModal(true)
  }

  if (loading) {
    return (
      <SalaryCapLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-field-500" />
        </div>
      </SalaryCapLayout>
    )
  }

  const auctionActive = auction?.status === 'active'
  const auctionPaused = auction?.status === 'paused'
  const auctionCompleted = auction?.status === 'completed'
  const auctionNotStarted = !auction || auction.status === 'pending'

  // Use demo data when auction hasn't started
  const showDemo = auctionNotStarted
  const displayItem = showDemo ? DEMO_CURRENT_ITEM : currentItem
  const displayBids = showDemo ? DEMO_BIDS : recentBids.slice(0, 3).map(b => ({
    name: b.owner?.owner_name || 'Unknown',
    amount: b.amount,
    isYou: b.owner_id === myOwnerId,
  }))
  const displayResults = showDemo ? DEMO_RESULTS : recentResults

  const isHighBidder = showDemo ? false : currentItem?.current_high_bidder === myOwnerId
  const canBid = !showDemo && auctionActive && currentItem && !isHighBidder && myOwnerState && myOwnerState.rosterSlotsRemaining > 0
  const canNominate = !showDemo && auctionActive && isMyTurn && !currentItem

  // Clock state - use demo timer when in preview mode
  const displaySecondsLeft = showDemo ? demoSecondsLeft : secondsLeft
  const totalSeconds = auction?.timer_duration || 30
  const pct = totalSeconds > 0 ? (displaySecondsLeft / totalSeconds) * 100 : 0
  const clockWarn = displaySecondsLeft <= 10 && displaySecondsLeft > 3
  const clockCrit = displaySecondsLeft <= 3 && displaySecondsLeft > 0
  const isSold = !showDemo && currentItem?.status === 'sold'

  // Deadline countdown calculations
  const deadlineTotalSecs = Math.floor(deadlineTimeLeft / 1000)
  const deadlineDays = Math.floor(deadlineTotalSecs / 86400)
  const deadlineHours = Math.floor((deadlineTotalSecs % 86400) / 3600)
  const deadlineMins = Math.floor((deadlineTotalSecs % 3600) / 60)
  const deadlineSecs = deadlineTotalSecs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const deadlineWindowMs = DRAFT_DEADLINE.getTime() - COUNTDOWN_START.getTime()
  const deadlinePct = Math.min(99, 100 - (deadlineTimeLeft / deadlineWindowMs) * 100)

  return (
    <SalaryCapLayout>
      {/* Countdown Timer */}
      {deadlineTimeLeft > 0 && (
        <div className="relative flex justify-between items-center gap-4 bg-surface-panel border border-hairline rounded-[13px] px-[18px] py-[15px] overflow-hidden mb-[22px]">
          <div>
            <div className="font-data text-[10.5px] tracking-[0.14em] uppercase text-fg-subtle">
              Draft begins in
            </div>
            <div className="text-[12.5px] text-fg-muted mt-1">
              Sun, Aug 16, 2026 · 8:00 PM ET
            </div>
          </div>
          <div className="font-data font-bold text-[26px] tracking-[-0.01em] flex gap-[11px] items-baseline text-fg">
            {deadlineDays > 0 && (
              <span className="tabular-nums">{deadlineDays}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">d</span></span>
            )}
            <span className="tabular-nums">{pad(deadlineHours)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">h</span></span>
            <span className="tabular-nums">{pad(deadlineMins)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">m</span></span>
            <span className="tabular-nums">{pad(deadlineSecs)}<span className="text-[11px] font-semibold text-fg-subtle ml-[2px]">s</span></span>
          </div>
          <div className="absolute left-0 bottom-0 h-[2px] bg-field-500 transition-all" style={{ width: `${deadlinePct}%` }} />
        </div>
      )}

      {/* Demo mode banner */}
      {showDemo && (
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-[9px] px-[14px] py-[10px] mb-[18px] text-center">
          <span className="font-data text-[11px] text-gold-500">Preview mode — showing sample auction data for design review</span>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_272px] gap-[22px] items-start max-[940px]:grid-cols-1">
        {/* Main area */}
        <div>
          {/* Stage */}
          <div className="bg-surface-panel border border-hairline rounded-[18px] px-[22px] py-[20px]">
            {displayItem ? (
              <>
                <div className="grid grid-cols-[84px_1fr_auto] gap-[18px] items-center max-[600px]:grid-cols-[60px_1fr] max-[600px]:gap-y-[12px]">
                  <Avatar name={displayItem.player?.name || ''} position={displayItem.player?.position || ''} size="lg" />

                  <div>
                    <div className="font-display font-semibold text-[22px] tracking-[-0.01em]">
                      {displayItem.player?.name}
                      {displayItem.player?.is_rookie && <RookieBadge />}
                    </div>
                    <div className="font-data text-[11.5px] text-fg-subtle mt-1">
                      {displayItem.player?.nfl_team || 'FA'}
                    </div>
                    <div className="font-data text-[10.5px] text-fg-subtle mt-[9px]">
                      {displayBids.map((b, i) => (
                        <span key={i}>
                          {i > 0 && ' ← '}
                          <span className={i === 0 ? 'font-bold text-fg-muted' : b.isYou ? 'text-gold-500' : ''}>
                            {b.name} ${b.amount}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right max-[600px]:col-span-full max-[600px]:text-left">
                    <div ref={bidRef} className="font-data font-bold text-[58px] tracking-[-0.04em] leading-[0.95] tabular-nums max-[600px]:text-[50px]">
                      ${displayItem.current_bid}
                    </div>
                    <div className="text-[12px] text-fg-muted mt-[5px]">
                      {isSold ? (
                        <b className="text-gold-500">Sold to {(displayItem as any).high_bidder?.owner_name} · ${displayItem.current_bid}</b>
                      ) : isHighBidder ? (
                        <b className="text-gold-500">You lead</b>
                      ) : (
                        `${(displayItem as any).high_bidder?.owner_name || 'Unknown'} leads`
                      )}
                    </div>
                  </div>
                </div>

                {/* Clock row */}
                <div className="grid grid-cols-[1fr_auto] gap-[14px] items-center mt-[18px]">
                  <div className={`h-[7px] rounded-full bg-hairline overflow-hidden ${clockCrit ? 'crit' : clockWarn ? 'warn' : ''}`}>
                    <i
                      className={`block h-full rounded-full transition-[width] duration-[900ms] ease-linear ${
                        clockCrit ? 'bg-flag' : clockWarn ? 'bg-amber' : 'bg-field-500'
                      }`}
                      style={{ width: isSold ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <div className={`min-w-[118px] text-right font-data font-bold text-[19px] tabular-nums ${
                    isSold ? 'text-gold-500' : clockCrit ? 'text-flag animate-pulse' : clockWarn ? 'text-amber' : 'text-field-500'
                  }`}>
                    {isSold ? 'SOLD' : `0:${String(displaySecondsLeft).padStart(2, '0')}${clockWarn ? ' ONCE' : ''}${clockCrit ? ' TWICE' : ''}`}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex gap-[9px] items-center mt-[16px] flex-wrap">
                  <button
                    onClick={() => !showDemo && handleBid(displayItem.current_bid + 1)}
                    disabled={!canBid || bidding || showDemo}
                    className="flex-1 min-w-[180px] bg-field-500 text-[#04150c] font-data font-bold text-[17px] py-[17px] rounded-[13px] hover:bg-field-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Bid ${displayItem.current_bid + 1}
                  </button>
                  <input
                    type="number"
                    value={customBid}
                    onChange={(e) => setCustomBid(e.target.value)}
                    placeholder={String(displayItem.current_bid + 1)}
                    disabled={showDemo}
                    className="w-[76px] bg-surface-well border border-hairline-strong text-fg font-data font-bold text-[16px] text-center rounded-[13px] py-[16px] px-[4px] disabled:opacity-40"
                  />
                  <button
                    onClick={handleCustomBid}
                    disabled={!canBid || bidding || showDemo}
                    className="bg-transparent border border-hairline-strong text-fg-muted font-data font-semibold text-[12.5px] px-[15px] py-[16px] rounded-[13px] hover:text-fg hover:border-fg-subtle disabled:opacity-40 transition-colors"
                  >
                    Place
                  </button>
                </div>

                {/* Under bid stats */}
                <div className="flex gap-[16px] flex-wrap mt-[12px] font-data text-[11px] text-fg-subtle">
                  <span>Max bid <b className="font-bold text-gold-500 tabular-nums">${myOwnerState?.maxBid || 377}</b></span>
                  <span>Cap left <b className="font-bold text-fg-muted tabular-nums">${myOwnerState?.remainingCap || BASE_CAP}</b></span>
                  <span>Roster <b className="font-bold text-fg-muted tabular-nums">{myOwnerState?.rosterSlotsFilled || 0}/{ROSTER_MAX}</b></span>
                  <span>Slots open <b className="font-bold text-fg-muted tabular-nums">{ROSTER_MAX - (myOwnerState?.rosterSlotsFilled || 0)}</b></span>
                </div>

                {bidError && (
                  <div className="mt-3 text-center font-data text-[11px] text-flag">{bidError}</div>
                )}
              </>
            ) : (
              <div className="text-center py-[30px]">
                {auctionPaused ? (
                  <>
                    <p className="text-amber text-[16px] font-medium mb-2">Draft is paused</p>
                    <p className="text-fg-subtle text-[13px]">Waiting for commissioner to resume</p>
                  </>
                ) : auctionCompleted ? (
                  <>
                    <p className="text-field-500 text-[16px] font-medium mb-2">Draft complete!</p>
                    <p className="text-fg-subtle text-[13px]">All {12 * ROSTER_MAX} roster spots have been filled</p>
                  </>
                ) : (
                  <>
                    <p className="text-fg-muted text-[16px] font-medium mb-2">Waiting for nomination...</p>
                    <p className="text-fg font-semibold">{currentNominator?.owner_name} is up to nominate</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-[8px] mt-[22px] items-center flex-wrap">
            <input
              type="text"
              placeholder="Search players…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[130px] bg-surface-well border border-hairline-strong text-fg text-[12.5px] px-[12px] py-[9px] rounded-[9px] placeholder:text-fg-subtle"
            />
            <div className="flex border border-hairline-strong rounded-[9px] overflow-hidden flex-none">
              {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-[9px] py-[9px] font-data text-[10px] border-r border-hairline-strong last:border-r-0 ${
                    positionFilter === pos
                      ? 'bg-field-500 text-[#04150c] font-bold'
                      : 'bg-surface-well text-fg-subtle'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRookiesOnly(!rookiesOnly)}
              className={`font-data text-[10px] px-[11px] py-[9px] rounded-[9px] border flex-none ${
                rookiesOnly
                  ? 'bg-gold-500 text-[#1a1405] border-gold-500 font-bold'
                  : 'bg-surface-well border-hairline-strong text-fg-subtle'
              }`}
            >
              Rookies
            </button>
          </div>

          {/* Two-column: Available + Sold */}
          <div className="grid grid-cols-[1.45fr_1fr] gap-[20px] items-start mt-[6px] max-[780px]:grid-cols-1">
            {/* Available */}
            <div>
              <div className="flex justify-between items-center pb-[9px] border-b border-hairline-strong mb-[4px]">
                <h3 className="text-[13px] font-semibold">Available</h3>
                <span className="font-data text-[9.5px] tracking-[0.08em] uppercase text-fg-subtle">{filteredPlayers.length} of {availablePlayers.length}</span>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {filteredPlayers.length === 0 ? (
                  <div className="py-[22px] text-center text-fg-subtle text-[12.5px]">No players match those filters.</div>
                ) : (
                  filteredPlayers.slice(0, 50).map(player => (
                    <div
                      key={player.id}
                      onClick={() => canNominate && openNominateModal(player)}
                      className={`grid grid-cols-[32px_30px_1fr_auto] gap-[8px] items-center py-[9px] border-b border-hairline last:border-none text-[12.5px] ${
                        canNominate ? 'cursor-pointer hover:bg-surface-well/50' : ''
                      }`}
                    >
                      {/* Rank */}
                      <span className="font-data text-[11px] font-bold tabular-nums text-fg-subtle">
                        {player.fantasy_rank ?? '—'}
                      </span>
                      <Avatar name={player.name} position={player.position} size="sm" />
                      <div>
                        <span>{player.name}</span>
                        {player.is_rookie && <RookieBadge />}
                        <div className="font-data text-[9.5px] text-fg-subtle mt-[1px]">{player.nfl_team || 'FA'}</div>
                      </div>
                      <span className="font-data font-bold text-gold-500 text-[12.5px]">
                        {/* Market value placeholder */}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sold */}
            <div>
              <div className="flex justify-between items-center pb-[9px] border-b border-hairline-strong mb-[4px]">
                <h3 className="text-[13px] font-semibold">Sold</h3>
                <span className="font-data text-[9.5px] tracking-[0.08em] uppercase text-fg-subtle">{displayResults.length} sold</span>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {displayResults.length === 0 ? (
                  <div className="py-[22px] text-center text-fg-subtle text-[12.5px]">No sales yet.</div>
                ) : (
                  displayResults.slice(0, 30).map(result => {
                    const isMine = !showDemo && (result as any).winner_id === myOwnerId
                    return (
                      <div
                        key={result.id}
                        className={`grid grid-cols-[30px_1fr_auto] gap-[10px] items-center py-[9px] border-b border-hairline last:border-none text-[12.5px] ${
                          isMine ? 'bg-field-500/[0.09] mx-[-8px] px-[8px] rounded-[7px]' : ''
                        }`}
                      >
                        <Avatar name={result.player?.name || ''} position={result.player?.position || ''} size="sm" />
                        <div>
                          <span>{result.player?.name}</span>
                          {result.player?.is_rookie && <RookieBadge />}
                          <div className={`font-data text-[9.5px] mt-[1px] ${isMine ? 'text-field-500' : 'text-fg-subtle'}`}>
                            → {result.winner?.owner_name}
                          </div>
                        </div>
                        <span className="font-data font-bold text-gold-500 text-[12.5px] tabular-nums">${result.winning_bid}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {canNominate && (
            <div className="mt-4 p-3 bg-field-500/15 border border-field-500/30 rounded-[13px] text-center">
              <p className="font-data text-[12px] font-semibold text-field-500">It's your turn to nominate! Click a player above.</p>
            </div>
          )}
        </div>

        {/* Rail sidebar */}
        <div className="max-[940px]:grid max-[940px]:grid-cols-2 max-[940px]:gap-4 max-[640px]:grid-cols-1">
          {/* My roster */}
          <div className="bg-surface-panel border border-hairline rounded-[14px] px-[18px] py-[16px] mb-[14px]">
            <h3 className="text-[12.5px] font-semibold mb-[11px] flex justify-between items-center">
              My roster
              <span className="font-data text-[10px] text-fg-subtle tracking-[0.08em]">{myOwnerState?.rosterSlotsFilled || 0} / {ROSTER_MAX}</span>
            </h3>

            <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
              <div className="bg-surface-well rounded-[9px] px-[10px] py-[9px]">
                <div className="font-data text-[9px] tracking-[0.1em] uppercase text-fg-subtle">Spent</div>
                <div className="font-data font-bold text-[15px] mt-[3px] tabular-nums">${myOwnerState?.totalSpent || 0}</div>
              </div>
              <div className="bg-surface-well rounded-[9px] px-[10px] py-[9px]">
                <div className="font-data text-[9px] tracking-[0.1em] uppercase text-fg-subtle">Left</div>
                <div className="font-data font-bold text-[15px] mt-[3px] tabular-nums text-field-500">${myOwnerState?.remainingCap || BASE_CAP}</div>
              </div>
              <div className="bg-surface-well rounded-[9px] px-[10px] py-[9px]">
                <div className="font-data text-[9px] tracking-[0.1em] uppercase text-fg-subtle">Max</div>
                <div className="font-data font-bold text-[15px] mt-[3px] tabular-nums text-gold-500">${myOwnerState?.maxBid || 377}</div>
              </div>
            </div>

            <div className="max-h-[230px] overflow-auto">
              {(myOwnerState?.draftedPlayers || []).map(result => (
                <div key={result.id} className="grid grid-cols-[26px_1fr_auto] gap-[9px] items-center py-[8px] border-b border-hairline last:border-none text-[12.5px]">
                  <Avatar name={result.player?.name || ''} position={result.player?.position || ''} size="sm" />
                  <span className="truncate">
                    {result.player?.name}
                    {result.player?.is_rookie && <RookieBadge />}
                  </span>
                  <span className="font-data font-bold tabular-nums text-gold-500">${result.winning_bid}</span>
                </div>
              ))}
              {(myOwnerState?.draftedPlayers || []).length === 0 && (
                <div className="py-[12px] text-center text-fg-subtle text-[11px]">No players drafted yet</div>
              )}
            </div>
          </div>

          {/* Owners */}
          <div className="bg-surface-panel border border-hairline rounded-[14px] px-[18px] py-[16px]">
            <h3 className="text-[12.5px] font-semibold mb-[11px] flex justify-between items-center">
              Owners
              <span className="font-data text-[10px] text-fg-subtle tracking-[0.08em]">cap left</span>
            </h3>

            <div className="max-h-[230px] overflow-auto">
              {owners
                .filter(o => o.id !== myOwnerId)
                .map(owner => {
                  const state = ownerStates.get(owner.id)
                  const isNominating = auction?.nomination_order?.[auction.current_nominator_index] === owner.id
                  const isLow = (state?.remainingCap || 0) < 60

                  return (
                    <div
                      key={owner.id}
                      className={`grid grid-cols-[26px_1fr_auto] gap-[9px] items-center py-[8px] border-b border-hairline last:border-none text-[12.5px] ${isNominating ? 'bg-gold-500/10 mx-[-8px] px-[8px] rounded-[7px]' : ''}`}
                    >
                      <div className="w-[26px] h-[26px] rounded-[8px] bg-fg-muted flex items-center justify-center font-data text-[10px] font-bold text-[#0d1117]">
                        {initials(owner.owner_name)}
                      </div>
                      <div>
                        {owner.owner_name}
                        <div className="font-data text-[10px] text-fg-subtle mt-[1px]">{state?.rosterSlotsFilled || 0}/{ROSTER_MAX} filled</div>
                      </div>
                      <span className={`font-data font-bold text-[12.5px] tabular-nums ${isLow ? 'text-amber' : ''}`}>
                        ${state?.remainingCap || BASE_CAP}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Nominate Modal */}
      {showNominateModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface-panel border border-hairline rounded-[18px] p-[24px] max-w-[400px] w-full mx-4 shadow-xl">
            <h3 className="font-display font-semibold text-[18px] mb-[20px]">Nominate Player</h3>
            <div className="flex items-center gap-[16px] mb-[24px]">
              <Avatar name={selectedPlayer.name} position={selectedPlayer.position} size="lg" />
              <div>
                <div className="font-semibold text-[16px]">
                  {selectedPlayer.name}
                  {selectedPlayer.is_rookie && <RookieBadge />}
                </div>
                <div className="font-data text-[11px] text-fg-subtle mt-1">{selectedPlayer.nfl_team || 'Free Agent'}</div>
              </div>
            </div>

            <div className="mb-[24px]">
              <label className="block font-data text-[10.5px] tracking-[0.14em] uppercase text-fg-subtle mb-[8px]">
                Opening Bid
              </label>
              <div className="flex items-center gap-[8px]">
                <span className="font-data text-[24px] font-bold text-fg-muted">$</span>
                <input
                  type="number"
                  min="1"
                  value={nominateBidAmount}
                  onChange={(e) => setNominateBidAmount(e.target.value)}
                  className="flex-1 px-[16px] py-[14px] bg-surface-well border border-hairline-strong rounded-[13px] text-fg font-data text-[24px] font-bold tabular-nums"
                />
              </div>
              {myOwnerState && (
                <p className="font-data text-[11px] text-fg-subtle mt-[8px]">
                  Your max bid: <span className="font-bold text-gold-500">${myOwnerState.maxBid}</span>
                </p>
              )}
            </div>

            {bidError && (
              <div className="mb-[16px] p-[12px] bg-flag/10 border border-flag/30 rounded-[9px]">
                <p className="font-data text-[11px] text-flag">{bidError}</p>
              </div>
            )}

            <div className="flex gap-[12px]">
              <button
                onClick={() => {
                  setShowNominateModal(false)
                  setBidError(null)
                }}
                className="flex-1 px-[16px] py-[14px] border border-hairline-strong text-fg-muted font-semibold rounded-[13px] hover:bg-surface-well transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNominate}
                disabled={bidding}
                className="flex-1 px-[16px] py-[14px] bg-field-500 text-[#04150c] font-bold rounded-[13px] hover:bg-field-600 disabled:opacity-50 transition-colors"
              >
                {bidding ? 'Nominating...' : 'Nominate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SalaryCapLayout>
  )
}
