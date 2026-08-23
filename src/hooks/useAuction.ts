import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useIsSalaryCapOwner } from './useSalaryCap'
import { useAllOwnersRosters } from './useOwnerRoster'
import type {
  Auction,
  AuctionItem,
  AuctionBid,
  AuctionResult,
  OwnerAuctionState,
} from '../types/auction'
import type { SalaryCapOwner, SalaryCapPlayer } from '../types/salarycap'

export function useAuction() {
  const { ownerId: myOwnerId } = useIsSalaryCapOwner()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null)
  const [recentBids, setRecentBids] = useState<AuctionBid[]>([])
  const [recentResults, setRecentResults] = useState<AuctionResult[]>([])
  const [owners, setOwners] = useState<SalaryCapOwner[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<SalaryCapPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use shared roster hook for all owners
  const ownerIds = useMemo(() => owners.map(o => o.id), [owners])
  const { ownerRosters, refetch: refetchRosters } = useAllOwnersRosters(ownerIds, {
    includeAuctionResults: true,
    auctionId: auction?.id,
  })

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
        // Get current item - PRIORITIZE celebration over active items
        // This ensures the celebration screen shows even if a new nomination happens
        let currentItemData = null

        // FIRST: Check for item in active celebration period (takes priority)
        const { data: celebrationItem } = await supabase
          .from('salarycap_auction_item')
          .select('*, player:salarycap_players(*), nominator:salarycap_owners!nominated_by(*), high_bidder:salarycap_owners!current_high_bidder(*)')
          .eq('auction_id', auctionData.id)
          .eq('status', 'sold')
          .gt('celebration_end_at', new Date().toISOString())
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (celebrationItem) {
          currentItemData = celebrationItem
        } else {
          // No celebration active - check for active bidding item
          const { data: activeItem } = await supabase
            .from('salarycap_auction_item')
            .select('*, player:salarycap_players(*), nominator:salarycap_owners!nominated_by(*), high_bidder:salarycap_owners!current_high_bidder(*)')
            .eq('auction_id', auctionData.id)
            .eq('status', 'active')
            .maybeSingle()

          if (activeItem) {
            currentItemData = activeItem
          } else {
            // No active item - show most recently sold (celebration expired)
            const { data: soldItem } = await supabase
              .from('salarycap_auction_item')
              .select('*, player:salarycap_players(*), nominator:salarycap_owners!nominated_by(*), high_bidder:salarycap_owners!current_high_bidder(*)')
              .eq('auction_id', auctionData.id)
              .eq('status', 'sold')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            currentItemData = soldItem
          }
        }

        setCurrentItem(currentItemData || null)

        // Get recent bids for current item
        if (currentItemData) {
          const { data: bidsData } = await supabase
            .from('salarycap_auction_bids')
            .select('*, owner:salarycap_owners(*)')
            .eq('auction_item_id', currentItemData.id)
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

      // Get available players (same logic as Free Agents page)
      // 1. Get players drafted in current auction
      const { data: draftedPlayerIds } = auctionData
        ? await supabase
            .from('salarycap_auction_results')
            .select('player_id')
            .eq('auction_id', auctionData.id)
        : { data: [] }

      const draftedIds = new Set(draftedPlayerIds?.map(r => r.player_id) || [])

      // 2. Get players with active contracts or franchise tags (same as Free Agents page)
      const { data: contractedPlayerIds } = await supabase
        .from('salarycap_contracts')
        .select('player_id')
        .or('contract_status.eq.active,is_franchise_tagged.eq.true')

      const contractedIds = new Set(contractedPlayerIds?.map(c => c.player_id) || [])

      // Get all active players
      const { data: allPlayers } = await supabase
        .from('salarycap_players')
        .select('*')
        .eq('is_active', true)
        .order('name')

      // Filter: not drafted in current auction AND not under contract
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

  // Build ownerStates from shared roster hook + auction results
  const ownerStates = useMemo(() => {
    const states = new Map<string, OwnerAuctionState>()

    for (const owner of owners) {
      const roster = ownerRosters.get(owner.id)
      if (!roster) continue

      // Get this owner's auction results from recentResults
      const draftedPlayers = recentResults.filter(r => r.winner_id === owner.id)
      const playersWon = draftedPlayers.length

      // Split roster players by source for display
      const existingContracts = roster.players
        .filter(p => p.source === 'contract')
        .map(p => ({
          id: p.id,
          player_id: p.player_id,
          salary: p.salary,
          years_remaining: p.years_remaining || 0,
          is_franchise_tagged: p.is_franchise_tagged || false,
          player: p.player,
        }))

      const signedFreeAgents = roster.players
        .filter(p => p.source === 'free_agent')
        .map(p => ({
          id: p.id,
          player_id: p.player_id,
          player: p.player,
        }))

      states.set(owner.id, {
        owner,
        totalSpent: roster.totalSalary + roster.deadCap,
        remainingCap: roster.capSpace,
        playersWon,
        rosterSlotsFilled: roster.rosterCount,
        rosterSlotsRemaining: roster.rosterSlotsRemaining,
        maxBid: roster.maxBid,
        draftedPlayers,
        existingContracts: existingContracts as any,
        signedFreeAgents: signedFreeAgents as any,
        deadCap: roster.deadCap,
        bonusCap: roster.bonusCap,
      })
    }

    return states
  }, [owners, ownerRosters, recentResults])

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

  // Combined refetch for auction data and rosters
  const refetch = useCallback(() => {
    fetchAuctionData()
    refetchRosters()
  }, [fetchAuctionData, refetchRosters])

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
    refetch,
  }
}
