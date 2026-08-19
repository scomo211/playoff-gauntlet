import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function finalize() {
  console.log('Starting roster finalization...\n')

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
  console.log('Step 1: Processing contract cuts...')
  const { data: cutContracts, error: cutError } = await supabase
    .from('salarycap_contracts')
    .select('*, player:salarycap_players(name, position)')
    .eq('offseason_decision', 'cut')
    .eq('contract_status', 'active')

  if (cutError) throw cutError

  for (const contract of cutContracts || []) {
    try {
      const deadCapPerYear = Math.ceil(contract.salary * 0.4)

      if (contract.years_remaining > 0 && deadCapPerYear > 0) {
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

      await supabase.from('salarycap_contracts').delete().eq('id', contract.id)
      results.contractsCut++
      console.log(`  Cut: ${contract.player?.name} ($${contract.salary}, ${contract.years_remaining}yr)`)
    } catch (err) {
      results.errors.push(`Failed to cut contract ${contract.id}: ${err}`)
    }
  }
  console.log(`  Total: ${results.contractsCut} contracts cut, ${results.deadCapCreated} dead cap entries\n`)

  // 2. Process franchise tags
  console.log('Step 2: Processing franchise tags...')
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

      await supabase.from('salarycap_contracts').delete().eq('id', contract.id)
      results.franchiseTagsApplied++
      console.log(`  Tagged: ${contract.player?.name} at $${tagCost}`)
    } catch (err) {
      results.errors.push(`Failed to franchise tag contract ${contract.id}: ${err}`)
    }
  }
  console.log(`  Total: ${results.franchiseTagsApplied} tags applied\n`)

  // 3. Release expired contracts
  console.log('Step 3: Releasing expired contracts...')
  const { data: releasedExpired, error: releaseError } = await supabase
    .from('salarycap_contracts')
    .select('id, player:salarycap_players(name)')
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
  console.log(`  Total: ${results.expiredContractsReleased} expired contracts released\n`)

  // 4. Sign free agents
  console.log('Step 4: Signing free agent pickups...')
  const { data: signedFAs, error: signError } = await supabase
    .from('salarycap_free_agent_pickups')
    .select('*, player:salarycap_players(name, position)')
    .eq('offseason_decision', 'sign_fa')

  if (signError) throw signError

  for (const fa of signedFAs || []) {
    try {
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
        dead_cap_if_cut: 2,
      })

      await supabase.from('salarycap_free_agent_pickups').delete().eq('id', fa.id)
      results.freeAgentsSigned++
      console.log(`  Signed: ${fa.player?.name} at $5`)
    } catch (err) {
      results.errors.push(`Failed to sign FA ${fa.id}: ${err}`)
    }
  }
  console.log(`  Total: ${results.freeAgentsSigned} FAs signed\n`)

  // 5. Release free agent pickups
  console.log('Step 5: Releasing free agent pickups...')
  const { data: releasedFAs, error: releaseFAError } = await supabase
    .from('salarycap_free_agent_pickups')
    .select('id, player:salarycap_players(name)')
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
  console.log(`  Total: ${results.freeAgentsReleased} FAs released\n`)

  // 6. Count kept contracts (no decrement)
  console.log('Step 6: Counting kept contracts...')
  const { data: keptContracts, error: keepError } = await supabase
    .from('salarycap_contracts')
    .select('id')
    .eq('offseason_decision', 'keep')
    .eq('contract_status', 'active')

  if (keepError) throw keepError
  results.contractsKept = keptContracts?.length || 0
  console.log(`  Total: ${results.contractsKept} contracts kept (years NOT decremented)\n`)

  // 7. Mark finalized
  console.log('Step 7: Marking offseason as finalized...')
  await supabase
    .from('salarycap_settings')
    .update({
      offseason_finalized: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
  console.log('  Done!\n')

  console.log('=== FINALIZATION COMPLETE ===')
  console.log(JSON.stringify(results, null, 2))

  if (results.errors.length > 0) {
    console.log('\nErrors encountered:')
    results.errors.forEach(e => console.log(`  - ${e}`))
  }
}

finalize().catch(console.error)
