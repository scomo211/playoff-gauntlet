import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function snapshotRosters() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  
  console.log('Creating roster snapshot...\n')

  // 1. All contracts with player and owner info
  const { data: contracts, error: contractsError } = await supabase
    .from('salarycap_contracts')
    .select(`
      *,
      player:salarycap_players(id, name, position, nfl_team, sleeper_player_id),
      owner:salarycap_owners(id, owner_name, sleeper_display_name)
    `)
    .order('owner_id')

  if (contractsError) throw contractsError

  // 2. All free agent pickups
  const { data: faPickups, error: faError } = await supabase
    .from('salarycap_free_agent_pickups')
    .select(`
      *,
      player:salarycap_players(id, name, position, nfl_team),
      owner:salarycap_owners(id, owner_name, sleeper_display_name)
    `)

  if (faError) throw faError

  // 3. All owners with their franchise tag decisions
  const { data: owners, error: ownersError } = await supabase
    .from('salarycap_owners')
    .select('*')

  if (ownersError) throw ownersError

  // 4. Bonus cap entries
  const { data: bonusCap, error: bonusError } = await supabase
    .from('salarycap_bonus_cap')
    .select('*')

  if (bonusError) throw bonusError

  // 5. Dead cap entries
  const { data: deadCap, error: deadError } = await supabase
    .from('salarycap_dead_cap')
    .select('*')

  if (deadError) throw deadError

  // 6. Draft availability
  const { data: draftAvail, error: draftError } = await supabase
    .from('salarycap_draft_availability')
    .select('*')

  if (draftError) throw draftError

  // 7. Settings
  const { data: settings, error: settingsError } = await supabase
    .from('salarycap_settings')
    .select('*')

  if (settingsError) throw settingsError

  const snapshot = {
    timestamp: new Date().toISOString(),
    description: 'Pre-finalization roster snapshot - 2026 offseason',
    tables: {
      contracts: contracts || [],
      free_agent_pickups: faPickups || [],
      owners: owners || [],
      bonus_cap: bonusCap || [],
      dead_cap: deadCap || [],
      draft_availability: draftAvail || [],
      settings: settings || [],
    },
    summary: {
      total_contracts: contracts?.length || 0,
      contracts_by_decision: {
        keep: contracts?.filter(c => c.offseason_decision === 'keep').length || 0,
        cut: contracts?.filter(c => c.offseason_decision === 'cut').length || 0,
        pending: contracts?.filter(c => c.offseason_decision === 'pending').length || 0,
        franchise_tag: contracts?.filter(c => c.offseason_decision === 'franchise_tag').length || 0,
      },
      contracts_by_status: {
        active: contracts?.filter(c => c.contract_status === 'active').length || 0,
        expired: contracts?.filter(c => c.contract_status === 'expired').length || 0,
      },
      franchise_tagged_players: contracts?.filter(c => c.is_franchise_tagged)
        .map(c => ({ player: c.player?.name, owner: c.owner?.owner_name, salary: c.salary })) || [],
      total_fa_pickups: faPickups?.length || 0,
      fa_by_decision: {
        sign_fa: faPickups?.filter(p => p.offseason_decision === 'sign_fa').length || 0,
        release: faPickups?.filter(p => p.offseason_decision === 'release').length || 0,
        pending: faPickups?.filter(p => p.offseason_decision === 'pending').length || 0,
      },
    }
  }

  // Write to file
  const filename = `snapshots/roster-snapshot-${timestamp}.json`
  fs.mkdirSync('snapshots', { recursive: true })
  fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2))

  console.log(`Snapshot saved to: ${filename}`)
  console.log('\n--- Summary ---')
  console.log(`Total contracts: ${snapshot.summary.total_contracts}`)
  console.log(`  - Keep: ${snapshot.summary.contracts_by_decision.keep}`)
  console.log(`  - Cut: ${snapshot.summary.contracts_by_decision.cut}`)
  console.log(`  - Pending: ${snapshot.summary.contracts_by_decision.pending}`)
  console.log(`  - Franchise Tag: ${snapshot.summary.contracts_by_decision.franchise_tag}`)
  console.log(`\nContract status:`)
  console.log(`  - Active: ${snapshot.summary.contracts_by_status.active}`)
  console.log(`  - Expired: ${snapshot.summary.contracts_by_status.expired}`)
  console.log(`\nFranchise tagged players:`)
  snapshot.summary.franchise_tagged_players.forEach(p => {
    console.log(`  - ${p.player} (${p.owner}) - $${p.salary}`)
  })
  console.log(`\nFA Pickups: ${snapshot.summary.total_fa_pickups}`)
  console.log(`  - Sign: ${snapshot.summary.fa_by_decision.sign_fa}`)
  console.log(`  - Release: ${snapshot.summary.fa_by_decision.release}`)
  console.log(`  - Pending: ${snapshot.summary.fa_by_decision.pending}`)
}

snapshotRosters().catch(console.error)
