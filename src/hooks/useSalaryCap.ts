import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  SalaryCapSettings,
  SalaryCapOwner,
  SalaryCapPlayer,
  SalaryCapContract,
  SalaryCapContractWithPlayer,
  SalaryCapDeadCap,
  SalaryCapBonusCap,
  SalaryCapTransaction,
  TeamCapSummary,
  FreeAgentInfo,
  calculateDeadCap,
  calculateFaExtensionCost,
  calculateCapSpace,
} from '../types/salarycap'

// ============================================
// Settings Hook
// ============================================

export function useSalaryCapSettings() {
  const [settings, setSettings] = useState<SalaryCapSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('salarycap_settings')
          .select('*')
          .single()

        if (error) throw error
        setSettings(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const updateSettings = async (updates: Partial<SalaryCapSettings>): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('salarycap_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1)

      if (error) throw error

      setSettings(prev => prev ? { ...prev, ...updates } : null)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update settings' }
    }
  }

  return { settings, loading, error, updateSettings }
}

// ============================================
// Owners Hook
// ============================================

export function useSalaryCapOwners() {
  const [owners, setOwners] = useState<SalaryCapOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('salarycap_owners')
        .select('*, profile:profiles(*)')
        .eq('is_active', true)
        .order('owner_name')

      if (error) throw error
      setOwners(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch owners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOwners()
  }, [fetchOwners])

  const getOwnerByProfileId = (profileId: string): SalaryCapOwner | undefined => {
    return owners.find(o => o.profile_id === profileId)
  }

  const getOwnerById = (ownerId: string): SalaryCapOwner | undefined => {
    return owners.find(o => o.id === ownerId)
  }

  return { owners, loading, error, refetch: fetchOwners, getOwnerByProfileId, getOwnerById }
}

// ============================================
// My Team Hook (for current user)
// ============================================

export function useSalaryCapMyTeam() {
  const { user } = useAuth()
  const { settings } = useSalaryCapSettings()
  const [owner, setOwner] = useState<SalaryCapOwner | null>(null)
  const [contracts, setContracts] = useState<SalaryCapContractWithPlayer[]>([])
  const [deadCap, setDeadCap] = useState<SalaryCapDeadCap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMyTeam = useCallback(async () => {
    if (!user) {
      setOwner(null)
      setContracts([])
      setDeadCap([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Find the owner linked to this user
      const { data: ownerData, error: ownerError } = await supabase
        .from('salarycap_owners')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (ownerError) {
        if (ownerError.code === 'PGRST116') {
          // No owner found for this user
          setOwner(null)
          setContracts([])
          setDeadCap([])
          setError(null)
          return
        }
        throw ownerError
      }

      setOwner(ownerData)

      // Fetch contracts for this owner
      const { data: contractData, error: contractError } = await supabase
        .from('salarycap_contracts')
        .select('*, player:salarycap_players(*)')
        .eq('owner_id', ownerData.id)
        .order('salary', { ascending: false })

      if (contractError) throw contractError
      setContracts(contractData || [])

      // Fetch dead cap
      const { data: deadCapData, error: deadCapError } = await supabase
        .from('salarycap_dead_cap')
        .select('*')
        .eq('owner_id', ownerData.id)
        .gt('years_remaining', 0)

      if (deadCapError) throw deadCapError
      setDeadCap(deadCapData || [])

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchMyTeam()
  }, [fetchMyTeam])

  const totalSalary = contracts.reduce((sum, c) => sum + c.salary, 0)
  const totalDeadCap = deadCap.reduce((sum, d) => sum + d.amount, 0)
  const capSpace = settings ? calculateCapSpace(settings.salary_cap, totalSalary, totalDeadCap) : 0

  return {
    owner,
    contracts,
    deadCap,
    totalSalary,
    totalDeadCap,
    capSpace,
    loading,
    error,
    refetch: fetchMyTeam,
  }
}

// ============================================
// Single Team Hook (for viewing any team)
// ============================================

export function useSalaryCapTeam(ownerId: string | null) {
  const { settings } = useSalaryCapSettings()
  const [owner, setOwner] = useState<SalaryCapOwner | null>(null)
  const [contracts, setContracts] = useState<SalaryCapContractWithPlayer[]>([])
  const [deadCap, setDeadCap] = useState<SalaryCapDeadCap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    if (!ownerId) {
      setOwner(null)
      setContracts([])
      setDeadCap([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch owner
      const { data: ownerData, error: ownerError } = await supabase
        .from('salarycap_owners')
        .select('*, profile:profiles(*)')
        .eq('id', ownerId)
        .single()

      if (ownerError) throw ownerError
      setOwner(ownerData)

      // Fetch contracts
      const { data: contractData, error: contractError } = await supabase
        .from('salarycap_contracts')
        .select('*, player:salarycap_players(*)')
        .eq('owner_id', ownerId)
        .order('salary', { ascending: false })

      if (contractError) throw contractError
      setContracts(contractData || [])

      // Fetch dead cap
      const { data: deadCapData, error: deadCapError } = await supabase
        .from('salarycap_dead_cap')
        .select('*')
        .eq('owner_id', ownerId)
        .gt('years_remaining', 0)

      if (deadCapError) throw deadCapError
      setDeadCap(deadCapData || [])

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team')
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const totalSalary = contracts.reduce((sum, c) => sum + c.salary, 0)
  const totalDeadCap = deadCap.reduce((sum, d) => sum + d.amount, 0)
  const capSpace = settings ? calculateCapSpace(settings.salary_cap, totalSalary, totalDeadCap) : 0

  return {
    owner,
    contracts,
    deadCap,
    totalSalary,
    totalDeadCap,
    capSpace,
    loading,
    error,
    refetch: fetchTeam,
  }
}

// ============================================
// Bonus Cap Hook
// ============================================

export function useBonusCap(ownerId: string | null) {
  const [bonusCapEntries, setBonusCapEntries] = useState<SalaryCapBonusCap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBonusCap = useCallback(async () => {
    if (!ownerId) {
      setBonusCapEntries([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('salarycap_bonus_cap')
        .select('*, corresponding_owner:salarycap_owners!salarycap_bonus_cap_corresponding_owner_id_fkey(*)')
        .eq('owner_id', ownerId)
        .order('trade_year', { ascending: false })

      if (error) throw error
      setBonusCapEntries(data || [])
      setError(null)
    } catch (err) {
      // Table might not exist yet
      setBonusCapEntries([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    fetchBonusCap()
  }, [fetchBonusCap])

  // Calculate net bonus cap for each year
  const net2026 = bonusCapEntries.reduce((sum, e) => sum + (e.amount_2026 || 0), 0)
  const net2027 = bonusCapEntries.reduce((sum, e) => sum + (e.amount_2027 || 0), 0)
  const net2028 = bonusCapEntries.reduce((sum, e) => sum + (e.amount_2028 || 0), 0)
  const net2029 = bonusCapEntries.reduce((sum, e) => sum + (e.amount_2029 || 0), 0)
  const net2030 = bonusCapEntries.reduce((sum, e) => sum + (e.amount_2030 || 0), 0)

  return {
    bonusCapEntries,
    net2026,
    net2027,
    net2028,
    net2029,
    net2030,
    loading,
    error,
    refetch: fetchBonusCap,
  }
}

// ============================================
// All Teams Hook (for dashboard/overview)
// ============================================

export function useSalaryCapAllTeams() {
  const { settings } = useSalaryCapSettings()
  const [teams, setTeams] = useState<TeamCapSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllTeams = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch all owners
      const { data: owners, error: ownerError } = await supabase
        .from('salarycap_owners')
        .select('*')
        .eq('is_active', true)
        .order('owner_name')

      if (ownerError) throw ownerError

      // Fetch all contracts with players
      const { data: contracts, error: contractError } = await supabase
        .from('salarycap_contracts')
        .select('*, player:salarycap_players(*)')

      if (contractError) throw contractError

      // Fetch all dead cap
      const { data: allDeadCap, error: deadCapError } = await supabase
        .from('salarycap_dead_cap')
        .select('*')
        .gt('years_remaining', 0)

      if (deadCapError) throw deadCapError

      // Fetch all bonus cap
      let allBonusCap: SalaryCapBonusCap[] = []
      try {
        const { data: bonusCapData } = await supabase
          .from('salarycap_bonus_cap')
          .select('*')

        allBonusCap = bonusCapData || []
      } catch {
        // Table might not exist yet
      }

      // Build team summaries
      const teamSummaries: TeamCapSummary[] = (owners || []).map(owner => {
        const ownerContracts = (contracts || []).filter(c => c.owner_id === owner.id)
        const ownerDeadCap = (allDeadCap || []).filter(d => d.owner_id === owner.id)
        const ownerBonusCap = allBonusCap.filter(b => b.owner_id === owner.id)

        // Only count active contracts toward salary cap (not expired or free agent pickups)
        const activeContracts = ownerContracts.filter(c => c.contract_status === 'active')
        const totalSalary = activeContracts.reduce((sum, c) => sum + c.salary, 0)
        const totalDeadCapAmount = ownerDeadCap.reduce((sum, d) => sum + d.amount, 0)
        // Sum bonus cap for current year (2026)
        const totalBonusCapAmount = ownerBonusCap.reduce((sum, b) => sum + (b.amount_2026 || 0), 0)

        // Cap space = salary_cap + bonus_cap - salary - dead_cap
        const effectiveCap = settings ? settings.salary_cap + totalBonusCapAmount : 0
        const capSpace = effectiveCap - totalSalary - totalDeadCapAmount

        return {
          owner,
          contracts: ownerContracts,
          deadCap: ownerDeadCap,
          bonusCap: ownerBonusCap,
          totalSalary,
          totalDeadCap: totalDeadCapAmount,
          totalBonusCap: totalBonusCapAmount,
          capSpace,
          playerCount: activeContracts.length,
        }
      })

      setTeams(teamSummaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }, [settings])

  useEffect(() => {
    if (settings) {
      fetchAllTeams()
    }
  }, [fetchAllTeams, settings])

  return { teams, loading, error, refetch: fetchAllTeams }
}

// ============================================
// Free Agents Hook
// ============================================

export function useSalaryCapFreeAgents() {
  const { settings } = useSalaryCapSettings()
  const [freeAgents, setFreeAgents] = useState<FreeAgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFreeAgents() {
      try {
        setLoading(true)

        // Get all players
        const { data: allPlayers, error: playerError } = await supabase
          .from('salarycap_players')
          .select('*')
          .eq('is_active', true)

        if (playerError) throw playerError

        // Get all rostered player IDs
        const { data: contracts, error: contractError } = await supabase
          .from('salarycap_contracts')
          .select('player_id')

        if (contractError) throw contractError

        const rosteredIds = new Set((contracts || []).map(c => c.player_id))

        // Filter to free agents and sort by fantasy_rank (nulls at end)
        const faPlayers = (allPlayers || [])
          .filter(p => !rosteredIds.has(p.id))
          .sort((a, b) => {
            if (a.fantasy_rank === null && b.fantasy_rank === null) return 0
            if (a.fantasy_rank === null) return 1
            if (b.fantasy_rank === null) return -1
            return a.fantasy_rank - b.fantasy_rank
          })

        // For now, we don't have previous salary info, so extension cost is base
        const freeAgentInfos: FreeAgentInfo[] = faPlayers.map(player => ({
          player,
          previousSalary: null,
          previousOwner: null,
          extensionCost: settings ? calculateFaExtensionCost(null, settings.fa_extension_base, settings.fa_extension_percent) : 5,
        }))

        setFreeAgents(freeAgentInfos)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch free agents')
      } finally {
        setLoading(false)
      }
    }

    if (settings) {
      fetchFreeAgents()
    }
  }, [settings])

  return { freeAgents, loading, error }
}

// ============================================
// Transactions Hook
// ============================================

export function useSalaryCapTransactions(limit: number = 50) {
  const [transactions, setTransactions] = useState<SalaryCapTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const { data, error } = await supabase
          .from('salarycap_transactions')
          .select(`
            *,
            player:salarycap_players(*),
            from_owner:salarycap_owners!salarycap_transactions_from_owner_id_fkey(*),
            to_owner:salarycap_owners!salarycap_transactions_to_owner_id_fkey(*)
          `)
          .order('transaction_date', { ascending: false })
          .limit(limit)

        if (error) throw error
        setTransactions(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transactions')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [limit])

  return { transactions, loading, error }
}

// ============================================
// Players Hook
// ============================================

export function useSalaryCapPlayers() {
  const [players, setPlayers] = useState<SalaryCapPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const { data, error } = await supabase
          .from('salarycap_players')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        setPlayers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch players')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  const getPlayerById = (id: string): SalaryCapPlayer | undefined => {
    return players.find(p => p.id === id)
  }

  const getPlayersBySleeperId = (sleeperId: string): SalaryCapPlayer | undefined => {
    return players.find(p => p.sleeper_player_id === sleeperId)
  }

  return { players, loading, error, getPlayerById, getPlayersBySleeperId }
}

// ============================================
// Admin Contract Management Hook
// ============================================

export function useSalaryCapAdminContracts() {
  const [loading, setLoading] = useState(false)

  const createContract = async (contract: {
    player_id: string
    owner_id: string
    salary: number
    years_total: number
    years_remaining: number
    acquisition_type: string
    acquisition_year?: number
  }): Promise<{ error: string | null; id?: string }> => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('salarycap_contracts')
        .insert(contract)
        .select('id')
        .single()

      if (error) throw error
      return { error: null, id: data.id }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to create contract' }
    } finally {
      setLoading(false)
    }
  }

  const updateContract = async (
    contractId: string,
    updates: Partial<SalaryCapContract>
  ): Promise<{ error: string | null }> => {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('salarycap_contracts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', contractId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update contract' }
    } finally {
      setLoading(false)
    }
  }

  const deleteContract = async (contractId: string): Promise<{ error: string | null }> => {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('salarycap_contracts')
        .delete()
        .eq('id', contractId)

      if (error) throw error
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete contract' }
    } finally {
      setLoading(false)
    }
  }

  const cutPlayer = async (
    contractId: string,
    settings: SalaryCapSettings
  ): Promise<{ error: string | null }> => {
    try {
      setLoading(true)

      // Get the contract
      const { data: contract, error: fetchError } = await supabase
        .from('salarycap_contracts')
        .select('*, player:salarycap_players(*)')
        .eq('id', contractId)
        .single()

      if (fetchError) throw fetchError

      // Calculate dead cap
      const deadCapAmount = calculateDeadCap(
        contract.salary,
        contract.years_remaining,
        settings.dead_cap_percent
      )

      // Create dead cap entry
      if (deadCapAmount > 0 && contract.years_remaining > 0) {
        const { error: deadCapError } = await supabase
          .from('salarycap_dead_cap')
          .insert({
            owner_id: contract.owner_id,
            player_name: contract.player.name,
            amount: deadCapAmount / contract.years_remaining, // Per year
            years_remaining: contract.years_remaining,
            original_salary: contract.salary,
            cut_year: settings.current_season,
          })

        if (deadCapError) throw deadCapError
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('salarycap_transactions')
        .insert({
          transaction_type: 'cut',
          player_id: contract.player_id,
          player_name: contract.player.name,
          from_owner_id: contract.owner_id,
          salary: contract.salary,
          years: contract.years_remaining,
          dead_cap_amount: deadCapAmount,
          season: settings.current_season,
        })

      if (transactionError) throw transactionError

      // Delete the contract
      const { error: deleteError } = await supabase
        .from('salarycap_contracts')
        .delete()
        .eq('id', contractId)

      if (deleteError) throw deleteError

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to cut player' }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    createContract,
    updateContract,
    deleteContract,
    cutPlayer,
  }
}

// ============================================
// Is Salary Cap Owner Hook
// ============================================

export function useIsSalaryCapOwner() {
  const { user } = useAuth()
  const [isOwner, setIsOwner] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkOwner() {
      if (!user) {
        setIsOwner(false)
        setOwnerId(null)
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('salarycap_owners')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (error) {
          setIsOwner(false)
          setOwnerId(null)
        } else {
          setIsOwner(true)
          setOwnerId(data.id)
        }
      } catch {
        setIsOwner(false)
        setOwnerId(null)
      } finally {
        setLoading(false)
      }
    }

    checkOwner()
  }, [user])

  return { isOwner, ownerId, loading }
}
