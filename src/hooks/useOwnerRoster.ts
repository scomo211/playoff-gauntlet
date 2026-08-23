import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SalaryCapPlayer } from '../types/salarycap'
import { getFranchiseTagCost } from '../types/salarycap'

const ROSTER_SIZE = 24
const SALARY_CAP = 400

// ============================================
// Types
// ============================================

export interface RosterPlayer {
  id: string
  player_id: string
  player: SalaryCapPlayer
  salary: number
  source: 'contract' | 'auction' | 'free_agent'
  years_remaining?: number
  is_franchise_tagged?: boolean
}

export interface OwnerRoster {
  players: RosterPlayer[]
  totalSalary: number
  deadCap: number
  bonusCap: number
  effectiveCap: number
  capSpace: number
  rosterCount: number
  rosterSlotsRemaining: number
  maxBid: number
  loading: boolean
  error: string | null
}

export interface UseOwnerRosterOptions {
  includeAuctionResults?: boolean  // default true
  auctionId?: string               // current auction ID for including draft picks
}

// ============================================
// Helper Functions
// ============================================

export function calculateMaxBid(remainingCap: number, rosterSlotsRemaining: number): number {
  // Must leave $1 for each remaining slot after this bid
  if (rosterSlotsRemaining <= 1) {
    return remainingCap
  }
  return Math.max(1, remainingCap - (rosterSlotsRemaining - 1))
}

// ============================================
// Hook
// ============================================

export function useOwnerRoster(
  ownerId: string | null | undefined,
  options: UseOwnerRosterOptions = {}
): OwnerRoster {
  const { includeAuctionResults = true, auctionId } = options

  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [deadCap, setDeadCap] = useState(0)
  const [bonusCap, setBonusCap] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoster = useCallback(async () => {
    if (!ownerId) {
      setPlayers([])
      setDeadCap(0)
      setBonusCap(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const rosterPlayers: RosterPlayer[] = []
      let auctionPlayerIds = new Set<string>()

      // 1. If including auction results and we have an auction ID, fetch those first
      if (includeAuctionResults && auctionId) {
        const { data: auctionResults, error: auctionError } = await supabase
          .from('salarycap_auction_results')
          .select('id, player_id, winning_bid, player:salarycap_players(*)')
          .eq('auction_id', auctionId)
          .eq('winner_id', ownerId)

        if (auctionError) throw auctionError

        // Add auction results to roster
        for (const result of auctionResults || []) {
          auctionPlayerIds.add(result.player_id)
          if (result.player) {
            rosterPlayers.push({
              id: result.id,
              player_id: result.player_id,
              player: result.player as SalaryCapPlayer,
              salary: result.winning_bid,
              source: 'auction',
            })
          }
        }
      }

      // 2. Fetch existing contracts (active or franchise tagged)
      const { data: contracts, error: contractError } = await supabase
        .from('salarycap_contracts')
        .select('id, player_id, salary, years_remaining, is_franchise_tagged, player:salarycap_players(*)')
        .eq('owner_id', ownerId)
        .or('contract_status.eq.active,is_franchise_tagged.eq.true')

      if (contractError) throw contractError

      // Add contracts that aren't already in auction results (avoid duplicates)
      for (const contract of contracts || []) {
        if (!auctionPlayerIds.has(contract.player_id) && contract.player) {
          const player = contract.player as SalaryCapPlayer
          // Use franchise tag cost if player is franchise tagged
          const salary = contract.is_franchise_tagged
            ? getFranchiseTagCost(player.position, contract.salary || 0)
            : (contract.salary || 0)

          rosterPlayers.push({
            id: contract.id,
            player_id: contract.player_id,
            player,
            salary,
            source: 'contract',
            years_remaining: contract.is_franchise_tagged ? 1 : contract.years_remaining,
            is_franchise_tagged: contract.is_franchise_tagged,
          })
        }
      }

      // 3. Fetch signed free agents ($5 each)
      const { data: signedFAs, error: faError } = await supabase
        .from('salarycap_free_agent_pickups')
        .select('id, player_id, player:salarycap_players(*)')
        .eq('owner_id', ownerId)
        .eq('offseason_decision', 'sign_fa')

      if (faError) throw faError

      // Add free agents that aren't already on roster
      const existingPlayerIds = new Set(rosterPlayers.map(p => p.player_id))
      for (const fa of signedFAs || []) {
        if (!existingPlayerIds.has(fa.player_id) && fa.player) {
          rosterPlayers.push({
            id: fa.id,
            player_id: fa.player_id,
            player: fa.player as SalaryCapPlayer,
            salary: 5, // FA pickups are $5
            source: 'free_agent',
          })
        }
      }

      // 4. Fetch dead cap
      const { data: deadCapEntries, error: deadCapError } = await supabase
        .from('salarycap_dead_cap')
        .select('amount')
        .eq('owner_id', ownerId)
        .gt('years_remaining', 0)

      if (deadCapError) throw deadCapError

      const totalDeadCap = (deadCapEntries || []).reduce((sum, d) => sum + (d.amount || 0), 0)

      // 5. Fetch bonus cap
      const { data: bonusCapEntries, error: bonusCapError } = await supabase
        .from('salarycap_bonus_cap')
        .select('amount_2026')
        .eq('owner_id', ownerId)

      if (bonusCapError) throw bonusCapError

      const totalBonusCap = (bonusCapEntries || []).reduce((sum, b) => sum + (b.amount_2026 || 0), 0)

      setPlayers(rosterPlayers)
      setDeadCap(totalDeadCap)
      setBonusCap(totalBonusCap)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching owner roster:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [ownerId, includeAuctionResults, auctionId])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchRoster()
  }, [fetchRoster])

  // Set up real-time subscriptions for roster changes
  useEffect(() => {
    if (!ownerId) return

    const channel = supabase
      .channel(`roster-${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_contracts', filter: `owner_id=eq.${ownerId}` },
        () => fetchRoster()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_free_agent_pickups', filter: `owner_id=eq.${ownerId}` },
        () => fetchRoster()
      )

    // Also subscribe to auction results if we're including them
    if (includeAuctionResults && auctionId) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'salarycap_auction_results', filter: `auction_id=eq.${auctionId}` },
        () => fetchRoster()
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ownerId, includeAuctionResults, auctionId, fetchRoster])

  // Calculate derived values
  const totalSalary = players.reduce((sum, p) => sum + p.salary, 0)
  const effectiveCap = SALARY_CAP + bonusCap
  const capSpace = effectiveCap - totalSalary - deadCap
  const rosterCount = players.length
  const rosterSlotsRemaining = ROSTER_SIZE - rosterCount
  const maxBid = calculateMaxBid(capSpace, rosterSlotsRemaining)

  return {
    players,
    totalSalary,
    deadCap,
    bonusCap,
    effectiveCap,
    capSpace,
    rosterCount,
    rosterSlotsRemaining,
    maxBid,
    loading,
    error,
  }
}

// ============================================
// Batch Hook for Multiple Owners
// ============================================

export interface AllOwnersRosterState {
  ownerRosters: Map<string, OwnerRoster>
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAllOwnersRosters(
  ownerIds: string[],
  options: UseOwnerRosterOptions = {}
): AllOwnersRosterState {
  const { includeAuctionResults = true, auctionId } = options

  const [ownerRosters, setOwnerRosters] = useState<Map<string, OwnerRoster>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllRosters = useCallback(async () => {
    if (ownerIds.length === 0) {
      setOwnerRosters(new Map())
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const newRosters = new Map<string, OwnerRoster>()

      // Batch fetch all data to minimize queries
      let auctionResultsByOwner = new Map<string, any[]>()

      if (includeAuctionResults && auctionId) {
        const { data: allAuctionResults } = await supabase
          .from('salarycap_auction_results')
          .select('id, player_id, winning_bid, winner_id, player:salarycap_players(*)')
          .eq('auction_id', auctionId)
          .in('winner_id', ownerIds)

        for (const result of allAuctionResults || []) {
          if (!auctionResultsByOwner.has(result.winner_id)) {
            auctionResultsByOwner.set(result.winner_id, [])
          }
          auctionResultsByOwner.get(result.winner_id)!.push(result)
        }
      }

      // Fetch all contracts
      const { data: allContracts } = await supabase
        .from('salarycap_contracts')
        .select('id, player_id, owner_id, salary, years_remaining, is_franchise_tagged, player:salarycap_players(*)')
        .in('owner_id', ownerIds)
        .or('contract_status.eq.active,is_franchise_tagged.eq.true')

      const contractsByOwner = new Map<string, any[]>()
      for (const contract of allContracts || []) {
        if (!contractsByOwner.has(contract.owner_id)) {
          contractsByOwner.set(contract.owner_id, [])
        }
        contractsByOwner.get(contract.owner_id)!.push(contract)
      }

      // Fetch all free agents
      const { data: allFAs } = await supabase
        .from('salarycap_free_agent_pickups')
        .select('id, player_id, owner_id, player:salarycap_players(*)')
        .in('owner_id', ownerIds)
        .eq('offseason_decision', 'sign_fa')

      const fasByOwner = new Map<string, any[]>()
      for (const fa of allFAs || []) {
        if (!fasByOwner.has(fa.owner_id)) {
          fasByOwner.set(fa.owner_id, [])
        }
        fasByOwner.get(fa.owner_id)!.push(fa)
      }

      // Fetch all dead cap
      const { data: allDeadCap } = await supabase
        .from('salarycap_dead_cap')
        .select('owner_id, amount')
        .in('owner_id', ownerIds)
        .gt('years_remaining', 0)

      const deadCapByOwner = new Map<string, number>()
      for (const dc of allDeadCap || []) {
        deadCapByOwner.set(dc.owner_id, (deadCapByOwner.get(dc.owner_id) || 0) + (dc.amount || 0))
      }

      // Fetch all bonus cap
      const { data: allBonusCap } = await supabase
        .from('salarycap_bonus_cap')
        .select('owner_id, amount_2026')
        .in('owner_id', ownerIds)

      const bonusCapByOwner = new Map<string, number>()
      for (const bc of allBonusCap || []) {
        bonusCapByOwner.set(bc.owner_id, (bonusCapByOwner.get(bc.owner_id) || 0) + (bc.amount_2026 || 0))
      }

      // Build roster for each owner
      for (const ownerId of ownerIds) {
        const rosterPlayers: RosterPlayer[] = []
        const auctionPlayerIds = new Set<string>()

        // Add auction results
        const ownerAuctionResults = auctionResultsByOwner.get(ownerId) || []
        for (const result of ownerAuctionResults) {
          auctionPlayerIds.add(result.player_id)
          if (result.player) {
            rosterPlayers.push({
              id: result.id,
              player_id: result.player_id,
              player: result.player as SalaryCapPlayer,
              salary: result.winning_bid,
              source: 'auction',
            })
          }
        }

        // Add contracts (not duplicating auction results)
        const ownerContracts = contractsByOwner.get(ownerId) || []
        for (const contract of ownerContracts) {
          if (!auctionPlayerIds.has(contract.player_id) && contract.player) {
            const player = contract.player as SalaryCapPlayer
            // Use franchise tag cost if player is franchise tagged
            const salary = contract.is_franchise_tagged
              ? getFranchiseTagCost(player.position, contract.salary || 0)
              : (contract.salary || 0)

            rosterPlayers.push({
              id: contract.id,
              player_id: contract.player_id,
              player,
              salary,
              source: 'contract',
              years_remaining: contract.is_franchise_tagged ? 1 : contract.years_remaining,
              is_franchise_tagged: contract.is_franchise_tagged,
            })
          }
        }

        // Add free agents
        const existingPlayerIds = new Set(rosterPlayers.map(p => p.player_id))
        const ownerFAs = fasByOwner.get(ownerId) || []
        for (const fa of ownerFAs) {
          if (!existingPlayerIds.has(fa.player_id) && fa.player) {
            rosterPlayers.push({
              id: fa.id,
              player_id: fa.player_id,
              player: fa.player as SalaryCapPlayer,
              salary: 5,
              source: 'free_agent',
            })
          }
        }

        const ownerDeadCap = deadCapByOwner.get(ownerId) || 0
        const ownerBonusCap = bonusCapByOwner.get(ownerId) || 0
        const totalSalary = rosterPlayers.reduce((sum, p) => sum + p.salary, 0)
        const effectiveCap = SALARY_CAP + ownerBonusCap
        const capSpace = effectiveCap - totalSalary - ownerDeadCap
        const rosterCount = rosterPlayers.length
        const rosterSlotsRemaining = ROSTER_SIZE - rosterCount

        newRosters.set(ownerId, {
          players: rosterPlayers,
          totalSalary,
          deadCap: ownerDeadCap,
          bonusCap: ownerBonusCap,
          effectiveCap,
          capSpace,
          rosterCount,
          rosterSlotsRemaining,
          maxBid: calculateMaxBid(capSpace, rosterSlotsRemaining),
          loading: false,
          error: null,
        })
      }

      setOwnerRosters(newRosters)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching all owner rosters:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [ownerIds, includeAuctionResults, auctionId])

  useEffect(() => {
    fetchAllRosters()
  }, [fetchAllRosters])

  // Real-time subscriptions
  useEffect(() => {
    if (ownerIds.length === 0) return

    const channel = supabase
      .channel('all-rosters')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_contracts' },
        () => fetchAllRosters()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salarycap_free_agent_pickups' },
        () => fetchAllRosters()
      )

    if (includeAuctionResults && auctionId) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'salarycap_auction_results', filter: `auction_id=eq.${auctionId}` },
        () => fetchAllRosters()
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ownerIds, includeAuctionResults, auctionId, fetchAllRosters])

  return {
    ownerRosters,
    loading,
    error,
    refetch: fetchAllRosters,
  }
}
