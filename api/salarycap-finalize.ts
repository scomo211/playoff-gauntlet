import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Franchise tag costs by position (2026)
const FRANCHISE_TAG_COSTS: Record<string, number> = {
  QB: 40,
  RB: 99,
  WR: 74,
  TE: 22,
}

function getFranchiseTagCost(position: string, previousSalary: number): number {
  const positionCost = FRANCHISE_TAG_COSTS[position] || 50
  return Math.max(positionCost, previousSalary)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const results = {
      contractsCut: 0,
      deadCapCreated: 0,
      franchiseTagsApplied: 0,
      expiredContractsReleased: 0,
      freeAgentsSigned: 0,
      freeAgentsReleased: 0,
      contractsKept: 0,
      errors: [] as string[],
    }

    // 1. Process contract cuts (offseason_decision = 'cut')
    const { data: cutContracts, error: cutError } = await supabase
      .from('salarycap_contracts')
      .select('*, player:salarycap_players(name, position)')
      .eq('offseason_decision', 'cut')
      .eq('contract_status', 'active')

    if (cutError) throw cutError

    for (const contract of cutContracts || []) {
      try {
        // Calculate dead cap: 40% of salary per year remaining, rounded up
        const deadCapPerYear = Math.ceil(contract.salary * 0.4)

        if (contract.years_remaining > 0 && deadCapPerYear > 0) {
          // Create dead cap entry
          await supabase.from('salarycap_dead_cap').insert({
            owner_id: contract.owner_id,
            player_name: contract.player?.name || 'Unknown',
            amount: deadCapPerYear,
            years_remaining: contract.years_remaining,
            original_salary: contract.salary,
            cut_year: 2026,
            drafted_year: contract.acquisition_year || 2025,
          })
          results.deadCapCreated++
        }

        // Delete the contract
        await supabase.from('salarycap_contracts').delete().eq('id', contract.id)
        results.contractsCut++
      } catch (err) {
        results.errors.push(`Failed to cut contract ${contract.id}: ${err}`)
      }
    }

    // 2. Process franchise tags (offseason_decision = 'franchise_tag')
    const { data: taggedContracts, error: tagError } = await supabase
      .from('salarycap_contracts')
      .select('*, player:salarycap_players(name, position)')
      .eq('offseason_decision', 'franchise_tag')
      .eq('contract_status', 'expired')

    if (tagError) throw tagError

    for (const contract of taggedContracts || []) {
      try {
        const position = contract.player?.position || 'WR'
        const tagCost = getFranchiseTagCost(position, contract.salary)

        // Create new franchise tag contract
        await supabase.from('salarycap_contracts').insert({
          player_id: contract.player_id,
          owner_id: contract.owner_id,
          salary: tagCost,
          years_total: 1,
          years_remaining: 1,
          acquisition_type: 'franchise_tag',
          acquisition_year: 2026,
          is_franchise_tagged: true,
          contract_status: 'active',
          offseason_decision: 'keep',
          dead_cap_if_cut: Math.ceil(tagCost * 0.4),
        })

        // Delete old expired contract
        await supabase.from('salarycap_contracts').delete().eq('id', contract.id)
        results.franchiseTagsApplied++
      } catch (err) {
        results.errors.push(`Failed to franchise tag contract ${contract.id}: ${err}`)
      }
    }

    // 3. Process released expired contracts (offseason_decision = 'release' AND contract_status = 'expired')
    const { data: releasedExpired, error: releaseError } = await supabase
      .from('salarycap_contracts')
      .select('id')
      .eq('offseason_decision', 'release')
      .eq('contract_status', 'expired')

    if (releaseError) throw releaseError

    for (const contract of releasedExpired || []) {
      try {
        await supabase.from('salarycap_contracts').delete().eq('id', contract.id)
        results.expiredContractsReleased++
      } catch (err) {
        results.errors.push(`Failed to release expired contract ${contract.id}: ${err}`)
      }
    }

    // 4. Process free agent signings (offseason_decision = 'sign_fa')
    const { data: signedFAs, error: signError } = await supabase
      .from('salarycap_free_agent_pickups')
      .select('*, player:salarycap_players(name, position)')
      .eq('offseason_decision', 'sign_fa')

    if (signError) throw signError

    for (const fa of signedFAs || []) {
      try {
        // Create new $5 contract
        await supabase.from('salarycap_contracts').insert({
          player_id: fa.player_id,
          owner_id: fa.owner_id,
          salary: 5,
          years_total: 1,
          years_remaining: 1,
          acquisition_type: 'fa_extension',
          acquisition_year: 2026,
          is_franchise_tagged: false,
          contract_status: 'active',
          offseason_decision: 'keep',
          dead_cap_if_cut: 2, // 40% of $5
        })

        // Delete from free agent pickups
        await supabase.from('salarycap_free_agent_pickups').delete().eq('id', fa.id)
        results.freeAgentsSigned++
      } catch (err) {
        results.errors.push(`Failed to sign FA ${fa.id}: ${err}`)
      }
    }

    // 5. Process free agent releases (offseason_decision = 'release' from free_agent_pickups)
    const { data: releasedFAs, error: releaseFAError } = await supabase
      .from('salarycap_free_agent_pickups')
      .select('id')
      .eq('offseason_decision', 'release')

    if (releaseFAError) throw releaseFAError

    for (const fa of releasedFAs || []) {
      try {
        await supabase.from('salarycap_free_agent_pickups').delete().eq('id', fa.id)
        results.freeAgentsReleased++
      } catch (err) {
        results.errors.push(`Failed to release FA ${fa.id}: ${err}`)
      }
    }

    // 6. Process kept contracts - decrement years_remaining
    const { data: keptContracts, error: keepError } = await supabase
      .from('salarycap_contracts')
      .select('id, years_remaining, salary')
      .eq('offseason_decision', 'keep')
      .eq('contract_status', 'active')

    if (keepError) throw keepError

    for (const contract of keptContracts || []) {
      try {
        const newYearsRemaining = contract.years_remaining - 1
        const newStatus = newYearsRemaining <= 0 ? 'expired' : 'active'
        const newDeadCap = newYearsRemaining > 0
          ? Math.ceil(contract.salary * 0.4 * newYearsRemaining)
          : 0

        await supabase
          .from('salarycap_contracts')
          .update({
            years_remaining: Math.max(0, newYearsRemaining),
            contract_status: newStatus,
            dead_cap_if_cut: newDeadCap,
            offseason_decision: 'pending', // Reset for next offseason
          })
          .eq('id', contract.id)

        results.contractsKept++
      } catch (err) {
        results.errors.push(`Failed to update kept contract ${contract.id}: ${err}`)
      }
    }

    // 7. Mark offseason as finalized in settings
    await supabase
      .from('salarycap_settings')
      .update({
        offseason_finalized: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)

    return res.status(200).json({
      success: true,
      message: 'Offseason finalized successfully',
      results,
    })

  } catch (error) {
    console.error('Finalize error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
