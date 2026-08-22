import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const ROSTER_SIZE = 24
const SALARY_CAP = 400

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
    const { player_id, opening_bid, owner_id } = req.body

    if (!player_id || !opening_bid || !owner_id) {
      return res.status(400).json({ error: 'Missing required fields: player_id, opening_bid, owner_id' })
    }

    if (opening_bid < 1) {
      return res.status(400).json({ error: 'Opening bid must be at least $1' })
    }

    // Get active auction
    const { data: auction, error: auctionError } = await supabase
      .from('salarycap_auction')
      .select('*')
      .eq('status', 'active')
      .single()

    if (auctionError || !auction) {
      return res.status(400).json({ error: 'No active auction found' })
    }

    // Check if there's already an active item
    const { data: activeItem } = await supabase
      .from('salarycap_auction_item')
      .select('id')
      .eq('auction_id', auction.id)
      .eq('status', 'active')
      .single()

    if (activeItem) {
      return res.status(400).json({ error: 'An auction is already in progress. Wait for it to complete.' })
    }

    // Verify it's this owner's turn
    const currentNominatorId = auction.nomination_order[auction.current_nominator_index]
    if (currentNominatorId !== owner_id) {
      return res.status(403).json({ error: 'It is not your turn to nominate' })
    }

    // Check player hasn't already been won
    const { data: existingResult } = await supabase
      .from('salarycap_auction_results')
      .select('id')
      .eq('auction_id', auction.id)
      .eq('player_id', player_id)
      .single()

    if (existingResult) {
      return res.status(400).json({ error: 'This player has already been drafted' })
    }

    // Get owner's current state (spent, roster count)
    const { data: ownerResults } = await supabase
      .from('salarycap_auction_results')
      .select('winning_bid')
      .eq('auction_id', auction.id)
      .eq('winner_id', owner_id)

    const totalSpent = ownerResults?.reduce((sum, r) => sum + r.winning_bid, 0) || 0
    const playersWon = ownerResults?.length || 0
    const remainingCap = SALARY_CAP - totalSpent
    const rosterSlotsRemaining = ROSTER_SIZE - playersWon

    // Calculate max bid
    const maxBid = rosterSlotsRemaining <= 1
      ? remainingCap
      : remainingCap - (rosterSlotsRemaining - 1)

    if (opening_bid > maxBid) {
      return res.status(400).json({
        error: `Opening bid exceeds your max bid of $${maxBid}`,
        max_bid: maxBid,
        remaining_cap: remainingCap,
        roster_slots_remaining: rosterSlotsRemaining
      })
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('salarycap_players')
      .select('id, name, position')
      .eq('id', player_id)
      .single()

    if (playerError || !player) {
      return res.status(400).json({ error: 'Player not found' })
    }

    // Calculate timer end time
    const timerEndAt = new Date(Date.now() + auction.timer_duration * 1000).toISOString()

    // Create auction item
    const { data: auctionItem, error: itemError } = await supabase
      .from('salarycap_auction_item')
      .insert({
        auction_id: auction.id,
        player_id: player_id,
        nominated_by: owner_id,
        opening_bid: opening_bid,
        current_bid: opening_bid,
        current_high_bidder: owner_id, // Nominator starts as high bidder
        timer_end_at: timerEndAt,
        status: 'active',
      })
      .select('*, player:salarycap_players(*), nominator:salarycap_owners!nominated_by(*)')
      .single()

    if (itemError) throw itemError

    // Record the opening bid
    await supabase.from('salarycap_auction_bids').insert({
      auction_item_id: auctionItem.id,
      owner_id: owner_id,
      amount: opening_bid,
    })

    // Update auction nomination count
    await supabase
      .from('salarycap_auction')
      .update({
        total_nominations: auction.total_nominations + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', auction.id)

    return res.status(200).json({
      success: true,
      auction_item: auctionItem,
      timer_end_at: timerEndAt,
      message: `${player.name} nominated at $${opening_bid}`
    })
  } catch (error) {
    console.error('Error nominating player:', error)
    return res.status(500).json({
      error: 'Failed to nominate player',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
