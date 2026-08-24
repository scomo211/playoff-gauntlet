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

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function advanceNominator() {
  // Get active auction
  const { data: auction } = await supabase
    .from('salarycap_auction')
    .select('*')
    .eq('status', 'active')
    .single()

  if (!auction) {
    console.log('No active auction')
    return
  }

  console.log('Current index:', auction.current_nominator_index)

  // Find next owner with roster space (checking actual roster count, not just auction wins)
  let nextIndex = auction.current_nominator_index
  let checkedCount = 0

  while (checkedCount < auction.nomination_order.length) {
    const ownerId = auction.nomination_order[nextIndex]

    const { data: owner } = await supabase
      .from('salarycap_owners')
      .select('owner_name')
      .eq('id', ownerId)
      .single()

    // Check ACTUAL roster count (not just auction results)
    const { data: rosterEntries } = await supabase
      .from('salarycap_rosters')
      .select('id')
      .eq('owner_id', ownerId)

    const rosterCount = rosterEntries?.length || 0
    const hasSpace = rosterCount < ROSTER_SIZE

    console.log(`  ${owner?.owner_name}: ${rosterCount}/${ROSTER_SIZE} ${hasSpace ? '✓' : '✗ FULL'}`)

    if (hasSpace) {
      if (nextIndex !== auction.current_nominator_index) {
        console.log(`\nAdvancing to ${owner?.owner_name} (index ${nextIndex})`)

        await supabase
          .from('salarycap_auction')
          .update({ current_nominator_index: nextIndex })
          .eq('id', auction.id)

        console.log('Done!')
      } else {
        console.log(`\n${owner?.owner_name} is already up and has roster space.`)
      }
      return
    }

    nextIndex = (nextIndex + 1) % auction.nomination_order.length
    checkedCount++
  }

  console.log('\nAll rosters are full! Draft complete.')
}

advanceNominator().catch(console.error)
