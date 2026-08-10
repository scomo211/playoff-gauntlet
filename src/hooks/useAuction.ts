import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useIsSalaryCapOwner } from './useSalaryCap'
import type {
  Auction,
  AuctionItem,
  AuctionBid,
  AuctionResult,
  OwnerAuctionState,
} from '../types/auction'
import { calculateMaxBid } from '../types/auction'
import type { SalaryCapOwner, SalaryCapPlayer } from '../types/salarycap'

const ROSTER_SIZE = 24
const SALARY_CAP = 400

export function useAuction() {
  const { ownerId: myOwnerId } = useIsSalaryCapOwner()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null)
  const [recentBids, setRecentBids] = useState<AuctionBid[]>([])
  const [recentResults, setRecentResults] = useState<AuctionResult[]>([])
  const [owners, setOwners] = useState<SalaryCapOwner[]>([])
  const [ownerStates, setOwnerStates] = useState<Map<string, OwnerAuctionState>>(new Map())
  const [availablePlayers, setAvailablePlayers] = useState<SalaryCapPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  const fetchAuctionData = useCallback(async () => {
    try {
      // Get active auction
      const { data: auctionData, error: auctionError } = await supabase
        .from('salarycap_auction')
        .select('*')
        .in('status', ['pending', 'active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (auctionError && auctionError.code !== 'PGRST116') {
        throw auctionError
      }

      setAuction(auctionData || null)

      if (auctionData) {
        // Get current active item
        const { data: itemData } = await supabase
          .from('salarycap_auction_item')
          .select('*, player:salarycap_players(*), nominator:salarycap_owners!nominated_by(*), high_bidder:salarycap_owners!current_high_bidder(*)')
          .eq('auction_id', auctionData.id)
          .eq('status', 'active')
          .single()

        setCurrentItem(itemData || null)

        // Get recent bids for current item
        if (itemData) {
          const { data: bidsData } = await supabase
            .from('salarycap_auction_bids')
            .select('*, owner:salarycap_owners(*)')
            .eq('auction_item_id', itemData.id)
            .order('created_at', { ascending: false })
            .limit(10)

          setRecentBids(bidsData || [])
        }

        // Get recent results
        const { data: resultsData } = await supabase
          .from('salarycap_auction_results')
          .select('*, player:salarycap_players(*), winner:salarycap_owners!winner_id(*)')
          .eq('auction_id', auctionData.id)
          .order('created_at', { ascending: false })
          .limit(50)

        setRecentResults(resultsData || [])
      }

      // Get all owners
      const { data: ownersData } = await supabase
        .from('salarycap_owners')
        .select('*')
        .eq('is_active', true)
        .order('owner_name')

      setOwners(ownersData || [])

      // Calculate owner states
      if (auctionData && ownersData) {
        const newOwnerStates = new Map<string, OwnerAuctionState>()

        for (const owner of ownersData) {
          const { data: ownerResults } = await supabase
            .from('salarycap_auction_results')
            .select('*, player:salarycap_players(*)')
            .eq('auction_id', auctionData.id)
            .eq('winner_id', owner.id)

          const totalSpent = ownerResults?.reduce((sum, r) => sum + r.winning_bid, 0) || 0
          const playersWon = ownerResults?.length || 0
          const remainingCap = SALARY_CAP - totalSpent
          const rosterSlotsRemaining = ROSTER_SIZE - playersWon

          newOwnerStates.set(owner.id, {
            owner,
            totalSpent,
            remainingCap,
            playersWon,
            rosterSlotsFilled: playersWon,
            rosterSlotsRemaining,
            maxBid: calculateMaxBid(remainingCap, rosterSlotsRemaining),
            draftedPlayers: ownerResults || [],
          })
        }

        setOwnerStates(newOwnerStates)
      }

      // Get available players (not drafted yet)
      const { data: draftedPlayerIds } = await supabase
        .from('salarycap_auction_results')
        .select('player_id')
        .eq('auction_id', auctionData?.id || '')

      const draftedIds = new Set(draftedPlayerIds?.map(r => r.player_id) || [])

      // Get players not under contract and not drafted
      const { data: contractedPlayerIds } = await supabase
        .from('salarycap_contracts')
        .select('player_id')

      const contractedIds = new Set(contractedPlayerIds?.map(c => c.player_id) || [])

      const { data: allPlayers } = await supabase
        .from('salarycap_players')
        .select('*')
        .eq('is_active', true)
        .order('name')

      const available = (allPlayers || []).filter(
        p => !draftedIds.has(p.id) && !contractedIds.has(p.id)
      )

      setAvailablePlayers(available)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching auction data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [])

  // Set up real-time subscriptions
  useEffect(() => {
    fetchAuctionData()

    const channel = supabase
      .channel('auction-room')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_auction' },
        (payload) => {
          console.log('Auction changed:', payload)
          if (payload.new) {
            setAuction(payload.new as Auction)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_auction_item' },
        (payload) => {
          console.log('Auction item changed:', payload)
          // Refetch to get joined data
          fetchAuctionData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'salarycap_auction_bids' },
        (payload) => {
          console.log('New bid:', payload)
          // Refetch to get joined data
          fetchAuctionData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'salarycap_auction_results' },
        (payload) => {
          console.log('New result:', payload)
          // Refetch to get joined data and update owner states
          fetchAuctionData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAuctionData])

  // Computed values
  const isMyTurn = auction
    ? auction.nomination_order[auction.current_nominator_index] === myOwnerId
    : false

  const currentNominator = auction
    ? owners.find(o => o.id === auction.nomination_order[auction.current_nominator_index])
    : null

  const myOwnerState = myOwnerId ? ownerStates.get(myOwnerId) : null

  // Actions
  const nominate = async (playerId: string, openingBid: number) => {
    const response = await fetch('/api/auction-nominate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        opening_bid: openingBid,
        owner_id: myOwnerId,
      }),
    })
    return response.json()
  }

  const placeBid = async (amount: number) => {
    if (!currentItem) return { error: 'No active auction' }

    const response = await fetch('/api/auction-bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_item_id: currentItem.id,
        amount,
        owner_id: myOwnerId,
      }),
    })
    return response.json()
  }

  const closeAuction = async (forceClose = false) => {
    if (!currentItem) return { error: 'No active auction' }

    const response = await fetch('/api/auction-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_item_id: currentItem.id,
        force_close: forceClose,
      }),
    })
    return response.json()
  }

  return {
    // State
    auction,
    currentItem,
    recentBids,
    recentResults,
    owners,
    ownerStates,
    availablePlayers,
    loading,
    error,

    // Computed
    isMyTurn,
    currentNominator,
    myOwnerId,
    myOwnerState,

    // Actions
    nominate,
    placeBid,
    closeAuction,
    refetch: fetchAuctionData,
  }
}
