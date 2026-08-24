import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const ROSTER_SIZE = 24
const SPEED_UP_THRESHOLD = 50 // After 50 nominations, speed up

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
    const { auction_item_id, force_close = false } = req.body

    if (!auction_item_id) {
      return res.status(400).json({ error: 'Missing required field: auction_item_id' })
    }

    // Get the auction item
    const { data: auctionItem, error: itemError } = await supabase
      .from('salarycap_auction_item')
      .select('*, player:salarycap_players(*), auction:salarycap_auction(*)')
      .eq('id', auction_item_id)
      .single()

    if (itemError || !auctionItem) {
      return res.status(400).json({ error: 'Auction item not found' })
    }

    if (auctionItem.status !== 'active') {
      return res.status(400).json({ error: 'This auction has already ended' })
    }

    // Check if timer has expired (unless force close)
    const timerEndAt = new Date(auctionItem.timer_end_at).getTime()
    const now = Date.now()
    if (!force_close && now < timerEndAt) {
      return res.status(400).json({
        error: 'Auction timer has not expired yet',
        seconds_remaining: Math.ceil((timerEndAt - now) / 1000)
      })
    }

    const auction = auctionItem.auction

    // Don't auto-close if auction is paused (unless force close from admin)
    if (!force_close && auction.status !== 'active') {
      return res.status(400).json({ error: 'Auction is paused' })
    }

    // Calculate celebration end time (10 seconds from now)
    const celebrationEndAt = new Date(Date.now() + 10000).toISOString()

    // Atomic update to mark item as sold (prevent double-close)
    const { data: closedItem, error: closeError } = await supabase
      .from('salarycap_auction_item')
      .update({
        status: 'sold',
        celebration_end_at: celebrationEndAt,
      })
      .eq('id', auction_item_id)
      .eq('status', 'active') // Only update if still active
      .select()
      .single()

    if (closeError || !closedItem) {
      return res.status(409).json({ error: 'Auction already closed by another request' })
    }

    // Create the result record
    const { data: result, error: resultError } = await supabase
      .from('salarycap_auction_results')
      .insert({
        auction_id: auction.id,
        player_id: auctionItem.player_id,
        winner_id: auctionItem.current_high_bidder,
        winning_bid: auctionItem.current_bid,
        nomination_number: auction.total_nominations,
      })
      .select('*, player:salarycap_players(*), winner:salarycap_owners!winner_id(*)')
      .single()

    if (resultError) throw resultError

    // Add player to winner's roster
    await supabase.from('salarycap_rosters').insert({
      owner_id: auctionItem.current_high_bidder,
      player_id: auctionItem.player_id,
    })

    // Create contract record (years to be finalized post-draft)
    await supabase.from('salarycap_contracts').insert({
      player_id: auctionItem.player_id,
      owner_id: auctionItem.current_high_bidder,
      salary: auctionItem.current_bid,
      years_total: 1,
      years_remaining: 1,
      contract_status: 'active',
      acquisition_type: 'auction',
      acquisition_year: new Date().getFullYear(),
    })

    // Calculate next nominator
    // Need to find the next owner who hasn't filled their roster
    let nextNominatorIndex = (auction.current_nominator_index + 1) % auction.nomination_order.length
    let nextNominatorId = auction.nomination_order[nextNominatorIndex]
    let checkedCount = 0
    let draftComplete = false

    // Find next owner with roster slots remaining
    while (checkedCount < auction.nomination_order.length) {
      const ownerId = auction.nomination_order[nextNominatorIndex]

      // Check if this owner's roster is full (check actual roster, not just auction results)
      const { data: rosterEntries } = await supabase
        .from('salarycap_rosters')
        .select('id')
        .eq('owner_id', ownerId)

      const rosterCount = rosterEntries?.length || 0
      if (rosterCount < ROSTER_SIZE) {
        nextNominatorId = ownerId
        break
      }

      nextNominatorIndex = (nextNominatorIndex + 1) % auction.nomination_order.length
      checkedCount++
    }

    // If we've checked all owners and they're all full, draft is complete
    if (checkedCount >= auction.nomination_order.length) {
      draftComplete = true
    }

    // Determine if we need to speed up timer (after 50 nominations)
    const newTotalNominations = auction.total_nominations
    let timerUpdates = {}
    if (newTotalNominations === SPEED_UP_THRESHOLD) {
      timerUpdates = {
        timer_duration: 20,
        timer_reset_threshold: 5,
        timer_reset_to: 5,
      }
    }

    // Update auction state
    if (draftComplete) {
      await supabase
        .from('salarycap_auction')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', auction.id)
    } else {
      await supabase
        .from('salarycap_auction')
        .update({
          current_nominator_index: nextNominatorIndex,
          updated_at: new Date().toISOString(),
          ...timerUpdates,
        })
        .eq('id', auction.id)
    }

    // Get next nominator info
    let nextNominator = null
    if (!draftComplete) {
      const { data: nominatorData } = await supabase
        .from('salarycap_owners')
        .select('id, owner_name, team_name')
        .eq('id', nextNominatorId)
        .single()
      nextNominator = nominatorData
    }

    // Note: Bot nomination is now handled by auction-bot-tick.ts after celebration ends
    // This ensures all clients see the celebration screen before the next item appears

    return res.status(200).json({
      success: true,
      result: {
        player_name: auctionItem.player?.name,
        winner_name: result.winner?.owner_name,
        winning_bid: auctionItem.current_bid,
        nomination_number: auction.total_nominations,
      },
      next_nominator: nextNominator,
      draft_complete: draftComplete,
      timer_sped_up: newTotalNominations === SPEED_UP_THRESHOLD,
      celebration_end_at: celebrationEndAt,
      message: draftComplete
        ? 'Draft complete! All rosters are full.'
        : `${auctionItem.player?.name} sold to ${result.winner?.owner_name} for $${auctionItem.current_bid}. ${nextNominator?.owner_name} is up next.`
    })
  } catch (error) {
    console.error('Error closing auction:', error)
    return res.status(500).json({
      error: 'Failed to close auction',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
