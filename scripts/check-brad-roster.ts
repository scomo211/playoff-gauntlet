import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

async function checkBrad() {
  // Find Brad
  const { data: brad } = await supabase
    .from('salarycap_owners')
    .select('id, owner_name')
    .ilike('owner_name', '%Brad%')
    .single()

  if (!brad) {
    console.log('Brad not found')
    return
  }

  console.log('Owner:', brad.owner_name, brad.id)

  // Check roster entries
  const { data: rosterEntries } = await supabase
    .from('salarycap_rosters')
    .select('*, player:salarycap_players(name)')
    .eq('owner_id', brad.id)

  console.log('\nRoster entries:', rosterEntries?.length)

  // Check contracts
  const { data: contracts } = await supabase
    .from('salarycap_contracts')
    .select('*, player:salarycap_players(name)')
    .eq('owner_id', brad.id)
    .eq('contract_status', 'active')

  console.log('Active contracts:', contracts?.length)

  // Check auction results
  const { data: auction } = await supabase
    .from('salarycap_auction')
    .select('id')
    .eq('status', 'active')
    .single()

  if (auction) {
    const { data: auctionWins } = await supabase
      .from('salarycap_auction_results')
      .select('*, player:salarycap_players(name)')
      .eq('auction_id', auction.id)
      .eq('winner_id', brad.id)

    console.log('Auction wins this draft:', auctionWins?.length)

    if (auctionWins) {
      console.log('\nAuction wins:')
      for (const win of auctionWins) {
        console.log(`  - ${win.player?.name} ($${win.winning_bid})`)
      }
    }
  }

  console.log('\nTotal roster should be: contracts + auction wins')
}

checkBrad().catch(console.error)
