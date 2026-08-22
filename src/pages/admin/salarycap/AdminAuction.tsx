import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

interface Auction {
  id: string
  status: string
  nomination_order: string[]
  current_nominator_index: number
  total_nominations: number
  timer_duration: number
  timer_reset_threshold: number
  timer_reset_to: number
  created_at: string
}

interface AuctionItem {
  id: string
  player_id: string
  current_bid: number
  current_high_bidder: string
  timer_end_at: string
  status: string
  player?: { name: string; position: string; sleeper_player_id: string }
  high_bidder?: { owner_name: string }
}

interface Owner {
  id: string
  owner_name: string
}

interface Player {
  id: string
  name: string
  position: string
  sleeper_player_id: string
}

const TIMER_OPTIONS = [15, 20, 30, 45, 60]

export default function AdminAuction() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sandboxMode, setSandboxMode] = useState(false)
  const [nominationOrder, setNominationOrder] = useState<string[]>([])
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Manual assignment state
  const [manualPlayerId, setManualPlayerId] = useState('')
  const [manualOwnerId, setManualOwnerId] = useState('')
  const [manualSalary, setManualSalary] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = async () => {
    // Get current auction
    const { data: auctionData } = await supabase
      .from('salarycap_auction')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setAuction(auctionData)

    // Get current active item if auction exists
    if (auctionData) {
      const { data: itemData } = await supabase
        .from('salarycap_auction_item')
        .select('*, player:salarycap_players(name, position, sleeper_player_id), high_bidder:salarycap_owners!current_high_bidder(owner_name)')
        .eq('auction_id', auctionData.id)
        .eq('status', 'active')
        .single()

      setCurrentItem(itemData)
    } else {
      setCurrentItem(null)
    }

    // Get owners
    const { data: ownersData } = await supabase
      .from('salarycap_owners')
      .select('id, owner_name')
      .eq('is_active', true)
      .order('owner_name')

    setOwners(ownersData || [])
    if (ownersData && !auctionData) {
      setNominationOrder(ownersData.map(o => o.id))
    }

    // Get available players for manual assignment
    const { data: playersData } = await supabase
      .from('salarycap_players')
      .select('id, name, position, sleeper_player_id')
      .eq('is_active', true)
      .order('name')

    setPlayers(playersData || [])

    setLoading(false)
  }

  // Timer countdown effect
  useEffect(() => {
    if (currentItem?.timer_end_at) {
      const updateTimer = () => {
        const endTime = new Date(currentItem.timer_end_at).getTime()
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
        setTimeRemaining(remaining)
      }

      updateTimer()
      timerRef.current = setInterval(updateTimer, 100)

      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } else {
      setTimeRemaining(0)
    }
  }, [currentItem?.timer_end_at])

  useEffect(() => {
    fetchData()

    // Subscribe to auction and item changes
    const channel = supabase
      .channel('admin-auction')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salarycap_auction' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salarycap_auction_item' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'salarycap_auction_bids' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const startAuction = async () => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/auction-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomination_order: nominationOrder }),
      })
      const result = await response.json()

      if (result.success) {
        showMessage('success', `Auction started! ${result.first_nominator?.owner_name} nominates first.`)
        fetchData()
      } else {
        showMessage('error', result.error || 'Failed to start auction')
      }
    } catch (err) {
      showMessage('error', 'Failed to start auction')
    }
    setActionLoading(false)
  }

  const pauseAuction = async () => {
    setActionLoading(true)
    const { error } = await supabase
      .from('salarycap_auction')
      .update({ status: 'paused' })
      .eq('id', auction?.id)

    if (error) {
      showMessage('error', 'Failed to pause auction')
    } else {
      showMessage('success', 'Auction paused')
      fetchData()
    }
    setActionLoading(false)
  }

  const resumeAuction = async () => {
    setActionLoading(true)
    const { error } = await supabase
      .from('salarycap_auction')
      .update({ status: 'active' })
      .eq('id', auction?.id)

    if (error) {
      showMessage('error', 'Failed to resume auction')
    } else {
      showMessage('success', 'Auction resumed')
      fetchData()
    }
    setActionLoading(false)
  }

  const endAuction = async () => {
    if (!confirm('Are you sure you want to end this auction? This will delete all auction data.')) {
      return
    }

    setActionLoading(true)

    // Delete all auction data
    await supabase.from('salarycap_auction_bids').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('salarycap_auction_results').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('salarycap_auction_item').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('salarycap_auction').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    showMessage('success', 'Auction ended and data cleared')
    setAuction(null)
    setCurrentItem(null)
    setActionLoading(false)
  }

  const forceCloseItem = async () => {
    if (!currentItem) return
    if (!confirm(`Force close bidding on ${currentItem.player?.name}? This will award to ${currentItem.high_bidder?.owner_name || 'current high bidder'} for $${currentItem.current_bid}.`)) {
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch('/api/auction-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auction_item_id: currentItem.id,
          force_close: true,
        }),
      })
      const result = await response.json()

      if (result.success) {
        showMessage('success', result.message)
        fetchData()
      } else {
        showMessage('error', result.error || 'Failed to close item')
      }
    } catch (err) {
      showMessage('error', 'Failed to close item')
    }
    setActionLoading(false)
  }

  const updateTimerDuration = async (newDuration: number) => {
    if (!auction) return

    setActionLoading(true)
    const { error } = await supabase
      .from('salarycap_auction')
      .update({
        timer_duration: newDuration,
        timer_reset_threshold: newDuration <= 20 ? 5 : 10,
        timer_reset_to: newDuration <= 20 ? 5 : 10,
      })
      .eq('id', auction.id)

    if (error) {
      showMessage('error', 'Failed to update timer')
    } else {
      showMessage('success', `Timer updated to ${newDuration} seconds (takes effect on next nomination)`)
      fetchData()
    }
    setActionLoading(false)
  }

  const manualAssignPlayer = async () => {
    if (!manualPlayerId || !manualOwnerId || !manualSalary) {
      showMessage('error', 'Please fill in all fields')
      return
    }

    const salary = parseInt(manualSalary)
    if (isNaN(salary) || salary < 1) {
      showMessage('error', 'Invalid salary amount')
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch('/api/auction-manual-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: manualPlayerId,
          owner_id: manualOwnerId,
          salary: salary,
          auction_id: auction?.id,
        }),
      })
      const result = await response.json()

      if (result.success) {
        showMessage('success', result.message)
        setManualPlayerId('')
        setManualOwnerId('')
        setManualSalary('')
        setPlayerSearch('')
        fetchData()
      } else {
        showMessage('error', result.error || 'Failed to assign player')
      }
    } catch (err) {
      showMessage('error', 'Failed to assign player')
    }
    setActionLoading(false)
  }

  const moveOwnerUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...nominationOrder]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setNominationOrder(newOrder)
  }

  const moveOwnerDown = (index: number) => {
    if (index === nominationOrder.length - 1) return
    const newOrder = [...nominationOrder]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setNominationOrder(newOrder)
  }

  const randomizeOrder = () => {
    const shuffled = [...nominationOrder].sort(() => Math.random() - 0.5)
    setNominationOrder(shuffled)
  }

  const getCurrentNominator = () => {
    if (!auction) return null
    const nominatorId = auction.nomination_order[auction.current_nominator_index]
    return owners.find(o => o.id === nominatorId)
  }

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(playerSearch.toLowerCase())
  ).slice(0, 20)

  const getTimerColor = () => {
    if (timeRemaining <= 3) return 'text-red-500'
    if (timeRemaining <= 10) return 'text-amber-500'
    return 'text-emerald-400'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/salarycap" className="text-slate-400 hover:text-white">
              ← Back to Admin
            </Link>
            <h1 className="text-xl font-bold text-white">Auction Admin</h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/salarycap/auction"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              Open Auction Room
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {message && (
          <div className={`px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Current Active Item */}
        {auction && currentItem && (
          <div className="bg-slate-900 rounded-xl border border-amber-500/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-400">🔴 LIVE - Current Item</h2>
              <span className={`text-3xl font-bold font-mono ${getTimerColor()}`}>
                {timeRemaining}s
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm">Player</p>
                <p className="text-white text-xl font-bold">{currentItem.player?.name}</p>
                <p className="text-slate-500">{currentItem.player?.position}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Current Bid</p>
                <p className="text-emerald-400 text-xl font-bold">${currentItem.current_bid}</p>
                <p className="text-slate-500">by {currentItem.high_bidder?.owner_name}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <button
                onClick={forceCloseItem}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Force Close & Award
              </button>
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Auction Status</h2>

          {auction ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Status</p>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                    auction.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    auction.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                    auction.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Nominations</p>
                  <p className="text-white text-lg font-semibold">{auction.total_nominations}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Current Nominator</p>
                  <p className="text-white text-lg font-semibold">{getCurrentNominator()?.owner_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Timer Duration</p>
                  <select
                    value={auction.timer_duration}
                    onChange={(e) => updateTimerDuration(parseInt(e.target.value))}
                    disabled={actionLoading}
                    className="mt-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1 disabled:opacity-50"
                  >
                    {TIMER_OPTIONS.map(t => (
                      <option key={t} value={t}>{t} seconds</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                {auction.status === 'active' && (
                  <button
                    onClick={pauseAuction}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    Pause Auction
                  </button>
                )}
                {auction.status === 'paused' && (
                  <button
                    onClick={resumeAuction}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Resume Auction
                  </button>
                )}
                <button
                  onClick={endAuction}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  End & Clear Data
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No active auction</p>
          )}
        </div>

        {/* Manual Player Assignment */}
        {auction && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Manual Player Assignment</h2>
            <p className="text-slate-400 text-sm mb-4">
              Bypass the auction to directly assign a player to an owner at a set price.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-400 text-sm mb-1">Player</label>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 mb-2"
                />
                {playerSearch && (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                    {filteredPlayers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setManualPlayerId(p.id)
                          setPlayerSearch(p.name)
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-700 ${
                          manualPlayerId === p.id ? 'bg-slate-700' : ''
                        }`}
                      >
                        <span className="text-white">{p.name}</span>
                        <span className="text-slate-500 ml-2">{p.position}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Owner</label>
                <select
                  value={manualOwnerId}
                  onChange={(e) => setManualOwnerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="">Select owner...</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>{o.owner_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Salary ($)</label>
                <input
                  type="number"
                  min="1"
                  value={manualSalary}
                  onChange={(e) => setManualSalary(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={manualAssignPlayer}
              disabled={actionLoading || !manualPlayerId || !manualOwnerId || !manualSalary}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              Assign Player
            </button>
          </div>
        )}

        {/* Start New Auction */}
        {!auction && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Start New Auction</h2>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandboxMode}
                  onChange={(e) => setSandboxMode(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-white font-medium">Sandbox Mode</span>
                  <p className="text-slate-400 text-sm">Test auction without affecting real data. Data clears when you end the auction.</p>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Nomination Order</h3>
                <button
                  onClick={randomizeOrder}
                  className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                >
                  Randomize
                </button>
              </div>
              <div className="space-y-2">
                {nominationOrder.map((ownerId, index) => {
                  const owner = owners.find(o => o.id === ownerId)
                  return (
                    <div key={ownerId} className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-2">
                      <span className="text-slate-500 w-6">{index + 1}.</span>
                      <span className="text-white flex-1">{owner?.owner_name}</span>
                      <button
                        onClick={() => moveOwnerUp(index)}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveOwnerDown(index)}
                        disabled={index === nominationOrder.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={startAuction}
              disabled={actionLoading}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {sandboxMode ? 'Start Sandbox Auction' : 'Start Auction'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
