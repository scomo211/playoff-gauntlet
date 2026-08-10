import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ROSTER_SIZE = 24
const SALARY_CAP = 400

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { auction_item_id, amount, owner_id } = req.body

    if (!auction_item_id || !amount || !owner_id) {
      return res.status(400).json({ error: 'Missing required fields: auction_item_id, amount, owner_id' })
    }

    // Get the auction item with auction info
    const { data: auctionItem, error: itemError } = await supabase
      .from('salarycap_auction_item')
      .select('*, auction:salarycap_auction(*)')
      .eq('id', auction_item_id)
      .single()

    if (itemError || !auctionItem) {
      return res.status(400).json({ error: 'Auction item not found' })
    }

    if (auctionItem.status !== 'active') {
      return res.status(400).json({ error: 'This auction has already ended' })
    }

    // Check if timer has expired
    const timerEndAt = new Date(auctionItem.timer_end_at).getTime()
    const now = Date.now()
    if (now >= timerEndAt) {
      return res.status(400).json({ error: 'Auction timer has expired' })
    }

    // Check if bid is higher than current bid
    if (amount <= auctionItem.current_bid) {
      return res.status(400).json({
        error: `Bid must be higher than current bid of $${auctionItem.current_bid}`,
        current_bid: auctionItem.current_bid
      })
    }

    // Check if owner is already the high bidder
    if (auctionItem.current_high_bidder === owner_id) {
      return res.status(400).json({ error: 'You are already the high bidder' })
    }

    // Get owner's current state (spent, roster count)
    const { data: ownerResults } = await supabase
      .from('salarycap_auction_results')
      .select('winning_bid')
      .eq('auction_id', auctionItem.auction_id)
      .eq('winner_id', owner_id)

    const totalSpent = ownerResults?.reduce((sum, r) => sum + r.winning_bid, 0) || 0
    const playersWon = ownerResults?.length || 0
    const remainingCap = SALARY_CAP - totalSpent
    const rosterSlotsRemaining = ROSTER_SIZE - playersWon

    // Check if owner's roster is full
    if (rosterSlotsRemaining <= 0) {
      return res.status(400).json({ error: 'Your roster is full' })
    }

    // Calculate max bid
    const maxBid = rosterSlotsRemaining <= 1
      ? remainingCap
      : remainingCap - (rosterSlotsRemaining - 1)

    if (amount > maxBid) {
      return res.status(400).json({
        error: `Bid exceeds your max bid of $${maxBid}`,
        max_bid: maxBid,
        remaining_cap: remainingCap,
        roster_slots_remaining: rosterSlotsRemaining
      })
    }

    // Get auction settings for timer reset
    const auction = auctionItem.auction
    const secondsRemaining = Math.floor((timerEndAt - now) / 1000)

    // Determine if we need to reset the timer
    let newTimerEndAt = auctionItem.timer_end_at
    if (secondsRemaining < auction.timer_reset_threshold) {
      // Reset timer
      newTimerEndAt = new Date(now + auction.timer_reset_to * 1000).toISOString()
    }

    // Atomic update: only update if current_bid matches what we read
    // This prevents race conditions where two bids come in simultaneously
    const { data: updatedItem, error: updateError } = await supabase
      .from('salarycap_auction_item')
      .update({
        current_bid: amount,
        current_high_bidder: owner_id,
        timer_end_at: newTimerEndAt,
      })
      .eq('id', auction_item_id)
      .eq('current_bid', auctionItem.current_bid) // Optimistic locking
      .eq('status', 'active')
      .select()
      .single()

    if (updateError || !updatedItem) {
      // Someone else bid first - fetch current state
      const { data: currentItem } = await supabase
        .from('salarycap_auction_item')
        .select('current_bid, current_high_bidder')
        .eq('id', auction_item_id)
        .single()

      return res.status(409).json({
        error: 'Outbid - someone placed a higher bid',
        current_bid: currentItem?.current_bid || auctionItem.current_bid,
        your_bid: amount
      })
    }

    // Record the bid in history
    await supabase.from('salarycap_auction_bids').insert({
      auction_item_id: auction_item_id,
      owner_id: owner_id,
      amount: amount,
    })

    return res.status(200).json({
      success: true,
      new_bid: amount,
      new_high_bidder: owner_id,
      timer_end_at: newTimerEndAt,
      timer_was_reset: newTimerEndAt !== auctionItem.timer_end_at
    })
  } catch (error) {
    console.error('Error placing bid:', error)
    return res.status(500).json({
      error: 'Failed to place bid',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
