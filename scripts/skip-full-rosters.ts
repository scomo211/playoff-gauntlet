import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROSTER_SIZE = 24

function loadEnv(filename: string) {
  const envPath = resolve(process.cwd(), filename)
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        let value = match[2].trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        process.env[match[1].trim()] = value
      }
    }
  }
}

loadEnv('.env')
loadEnv('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function skipFullRosters() {
  // Get active auction
  const { data: auction, error: auctionError } = await supabase
    .from('salarycap_auction')
    .select('*')
    .eq('status', 'active')
    .single()

  if (auctionError || !auction) {
    console.error('No active auction found')
    return
  }

  console.log('Current nominator index:', auction.current_nominator_index)

  const currentNominatorId = auction.nomination_order[auction.current_nominator_index]
  const { data: currentOwner } = await supabase
    .from('salarycap_owners')
    .select('owner_name')
    .eq('id', currentNominatorId)
    .single()

  console.log('Current nominator:', currentOwner?.owner_name)

  // Find next owner with roster slots remaining
  let nextIndex = auction.current_nominator_index
  let checkedCount = 0

  while (checkedCount < auction.nomination_order.length) {
    const ownerId = auction.nomination_order[nextIndex]

    // Get owner info
    const { data: owner } = await supabase
      .from('salarycap_owners')
      .select('owner_name')
      .eq('id', ownerId)
      .single()

    // Check roster count
    const { data: results } = await supabase
      .from('salarycap_auction_results')
      .select('id')
      .eq('auction_id', auction.id)
      .eq('winner_id', ownerId)

    const playersWon = results?.length || 0

    console.log(`  ${owner?.owner_name}: ${playersWon}/${ROSTER_SIZE} players`)

    if (playersWon < ROSTER_SIZE) {
      // This owner can still nominate
      if (nextIndex !== auction.current_nominator_index) {
        console.log(`\nAdvancing to ${owner?.owner_name} (index ${nextIndex})`)

        await supabase
          .from('salarycap_auction')
          .update({ current_nominator_index: nextIndex })
          .eq('id', auction.id)

        console.log('Done! Nomination order updated.')
      } else {
        console.log(`\n${owner?.owner_name} is already up and has roster space.`)
      }
      return
    }

    // Move to next
    nextIndex = (nextIndex + 1) % auction.nomination_order.length
    checkedCount++
  }

  console.log('\nAll rosters are full! Draft should be complete.')
}

skipFullRosters().catch(console.error)
