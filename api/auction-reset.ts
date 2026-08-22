import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Create Supabase client inside handler to ensure env vars are available
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase configuration' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { auction_id, force = false } = req.body

    if (!auction_id) {
      return res.status(400).json({ error: 'Missing required field: auction_id' })
    }

    // Get the auction
    const { data: auction, error: auctionError } = await supabase
      .from('salarycap_auction')
      .select('*')
      .eq('id', auction_id)
      .single()

    if (auctionError || !auction) {
      return res.status(400).json({ error: 'Auction not found' })
    }

    // Safety check: only allow reset on test auctions unless forced
    if (!auction.is_test && !force) {
      return res.status(400).json({
        error: 'Cannot reset a production auction. Use force=true to override (dangerous!)'
      })
    }

    // Get all player_ids from auction results (for cleaning up rosters/contracts)
    const { data: results } = await supabase
      .from('salarycap_auction_results')
      .select('player_id')
      .eq('auction_id', auction_id)

    const draftedPlayerIds = results?.map(r => r.player_id) || []

    // Delete in order respecting foreign key constraints

    // 1. Delete bids (references auction_item)
    // Fetch item IDs first since Supabase doesn't support subqueries in delete
    const { data: itemIds } = await supabase
      .from('salarycap_auction_item')
      .select('id')
      .eq('auction_id', auction_id)

    if (itemIds && itemIds.length > 0) {
      await supabase
        .from('salarycap_auction_bids')
        .delete()
        .in('auction_item_id', itemIds.map(i => i.id))
    }

    // 2. Delete contracts created during this auction
    if (draftedPlayerIds.length > 0) {
      await supabase
        .from('salarycap_contracts')
        .delete()
        .in('player_id', draftedPlayerIds)
        .eq('acquisition_type', 'auction')
    }

    // 3. Delete rosters created during this auction
    if (draftedPlayerIds.length > 0) {
      await supabase
        .from('salarycap_rosters')
        .delete()
        .in('player_id', draftedPlayerIds)
    }

    // 4. Delete auction results
    await supabase
      .from('salarycap_auction_results')
      .delete()
      .eq('auction_id', auction_id)

    // 5. Delete auction items
    await supabase
      .from('salarycap_auction_item')
      .delete()
      .eq('auction_id', auction_id)

    // 6. Delete the auction itself
    await supabase
      .from('salarycap_auction')
      .delete()
      .eq('id', auction_id)

    return res.status(200).json({
      success: true,
      message: `Auction reset complete. Removed ${draftedPlayerIds.length} drafted players from rosters and contracts.`,
      players_removed: draftedPlayerIds.length,
    })
  } catch (error) {
    console.error('Error resetting auction:', error)
    return res.status(500).json({
      error: 'Failed to reset auction',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
