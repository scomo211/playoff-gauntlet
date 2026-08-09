import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

interface Auction {
  id: string
  status: string
  nomination_order: string[]
  current_nominator_index: number
  total_nominations: number
  timer_duration: number
  created_at: string
}

interface Owner {
  id: string
  owner_name: string
}

export default function AdminAuction() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sandboxMode, setSandboxMode] = useState(false)
  const [nominationOrder, setNominationOrder] = useState<string[]>([])

  const fetchData = async () => {
    // Get current auction
    const { data: auctionData } = await supabase
      .from('salarycap_auction')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setAuction(auctionData)

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

    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Subscribe to auction changes
    const channel = supabase
      .channel('admin-auction')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salarycap_auction' }, fetchData)
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
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/salarycap" className="text-slate-400 hover:text-white">
              ← Back to Admin
            </Link>
            <h1 className="text-xl font-bold text-white">Auction Admin</h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/salarycap/offseason"
              className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600"
            >
              Offseason Tracking
            </Link>
            <Link
              to="/salarycap/auction"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              Open Auction Room
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Current Status */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Current Status</h2>

          {auction ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-slate-400">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  auction.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  auction.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                  auction.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-slate-400">Nominations:</span>
                <span className="text-white">{auction.total_nominations}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-slate-400">Current Nominator:</span>
                <span className="text-white">{getCurrentNominator()?.owner_name || 'N/A'}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-slate-400">Timer:</span>
                <span className="text-white">{auction.timer_duration} seconds</span>
              </div>

              <div className="flex gap-3 mt-6">
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
