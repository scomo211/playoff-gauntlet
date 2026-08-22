import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const ROSTER_SIZE = 24
const SALARY_CAP = 400

// Bot configuration
const MAX_BOT_BIDS_PER_ITEM = 3 // Bots will only bid 3 times total per nominated player

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
    const { auction_id } = req.body

    if (!auction_id) {
      return res.status(400).json({ error: 'Missing required field: auction_id' })
    }

    // Get the auction with bot info
    const { data: auction, error: auctionError } = await supabase
      .from('salarycap_auction')
      .select('*')
      .eq('id', auction_id)
      .single()

    if (auctionError || !auction) {
      return res.status(400).json({ error: 'Auction not found' })
    }

    if (auction.status !== 'active') {
      return res.status(200).json({ success: true, action: 'none', reason: 'Auction not active' })
    }

    if (!auction.is_test) {
      return res.status(400).json({ error: 'Bot actions only allowed on test auctions' })
    }

    const botOwnerIds: string[] = auction.bot_owner_ids || []
    if (botOwnerIds.length === 0) {
      return res.status(200).json({ success: true, action: 'none', reason: 'No bots in this auction' })
    }

    // Check for active auction item
    const { data: currentItem } = await supabase
      .from('salarycap_auction_item')
      .select('*, player:salarycap_players(name, position)')
      .eq('auction_id', auction_id)
      .eq('status', 'active')
      .single()

    // CASE 1: No active item - check if it's a bot's turn to nominate
    if (!currentItem) {
      const currentNominatorId = auction.nomination_order[auction.current_nominator_index]

      if (!botOwnerIds.includes(currentNominatorId)) {
        return res.status(200).json({
          success: true,
          action: 'waiting',
          reason: 'Human turn to nominate'
        })
      }

      // Bot's turn to nominate - pick a random available player
      const nominationResult = await botNominate(supabase, auction, currentNominatorId)
      return res.status(200).json(nominationResult)
    }

    // CASE 2: Active item - bots may bid
    const timerEndAt = new Date(currentItem.timer_end_at).getTime()
    const now = Date.now()

    if (now >= timerEndAt) {
      return res.status(200).json({
        success: true,
        action: 'waiting',
        reason: 'Timer expired, waiting for close'
      })
    }

    // Count how many bot bids have been placed on this item
    const { data: existingBids } = await supabase
      .from('salarycap_auction_bids')
      .select('owner_id')
      .eq('auction_item_id', currentItem.id)
      .in('owner_id', botOwnerIds)

    const botBidCount = existingBids?.length || 0

    // Check if bots have reached their bid limit for this item
    if (botBidCount >= MAX_BOT_BIDS_PER_ITEM) {
      return res.status(200).json({
        success: true,
        action: 'none',
        reason: `Bots already placed ${MAX_BOT_BIDS_PER_ITEM} bids on this player`
      })
    }

    // Find bots who can bid
    const eligibleBots = []
    for (const botId of botOwnerIds) {
      // Skip if bot is already high bidder
      if (currentItem.current_high_bidder === botId) continue

      // Calculate bot's max bid
      const { data: botResults } = await supabase
        .from('salarycap_auction_results')
        .select('winning_bid')
        .eq('auction_id', auction_id)
        .eq('winner_id', botId)

      const totalSpent = botResults?.reduce((sum, r) => sum + r.winning_bid, 0) || 0
      const playersWon = botResults?.length || 0
      const remainingCap = SALARY_CAP - totalSpent
      const rosterSlotsRemaining = ROSTER_SIZE - playersWon

      if (rosterSlotsRemaining <= 0) continue

      const maxBid = rosterSlotsRemaining <= 1
        ? remainingCap
        : remainingCap - (rosterSlotsRemaining - 1)

      const nextBid = currentItem.current_bid + 1

      if (nextBid <= maxBid) {
        eligibleBots.push({ botId, maxBid, nextBid })
      }
    }

    if (eligibleBots.length === 0) {
      return res.status(200).json({
        success: true,
        action: 'none',
        reason: 'No bots can afford to bid'
      })
    }

    // Calculate bid probability based on time remaining
    // Spread remaining bids across the remaining time
    const secondsRemaining = Math.floor((timerEndAt - now) / 1000)
    const bidsRemaining = MAX_BOT_BIDS_PER_ITEM - botBidCount

    // Probability to bid this tick (spread bids across remaining time)
    // Tick happens every ~4 seconds during bidding, so multiply accordingly
    // Also ensure we bid if time is running low and we still have bids to make
    const bidProbability = secondsRemaining <= 5
      ? 0.8  // High chance to bid in last 5 seconds
      : Math.min(0.4, (bidsRemaining / secondsRemaining) * 4)

    if (Math.random() > bidProbability) {
      return res.status(200).json({
        success: true,
        action: 'skipped',
        reason: `Bot chose not to bid (${Math.round(bidProbability * 100)}% chance, ${secondsRemaining}s left)`
      })
    }

    // Pick a random eligible bot to bid
    const bidder = eligibleBots[Math.floor(Math.random() * eligibleBots.length)]

    // Place the bid
    const bidResult = await placeBotBid(supabase, currentItem, bidder.botId, bidder.nextBid, auction)

    return res.status(200).json(bidResult)

  } catch (error) {
    console.error('Error in bot tick:', error)
    return res.status(500).json({
      error: 'Bot tick failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function botNominate(supabase: SupabaseClient, auction: any, botOwnerId: string) {
  // Get players already drafted
  const { data: draftedPlayers } = await supabase
    .from('salarycap_auction_results')
    .select('player_id')
    .eq('auction_id', auction.id)

  const draftedIds = new Set(draftedPlayers?.map(p => p.player_id) || [])

  // Get players with active contracts
  const { data: contractedPlayers } = await supabase
    .from('salarycap_contracts')
    .select('player_id')
    .or('contract_status.eq.active,is_franchise_tagged.eq.true')

  const contractedIds = new Set(contractedPlayers?.map(c => c.player_id) || [])

  // Get available players (sorted by fantasy rank)
  const { data: availablePlayers } = await supabase
    .from('salarycap_players')
    .select('id, name, position, fantasy_rank')
    .eq('is_active', true)
    .order('fantasy_rank', { ascending: true, nullsFirst: false })
    .limit(100)

  // Filter to truly available
  const candidates = (availablePlayers || []).filter(
    p => !draftedIds.has(p.id) && !contractedIds.has(p.id)
  )

  if (candidates.length === 0) {
    return { success: false, error: 'No players available to nominate' }
  }

  // Pick from top 30 available (weighted toward better players)
  const topCandidates = candidates.slice(0, 30)
  const selectedPlayer = topCandidates[Math.floor(Math.random() * topCandidates.length)]

  // Opening bid: $1 for bots
  const openingBid = 1

  // Calculate timer end
  const timerEndAt = new Date(Date.now() + auction.timer_duration * 1000).toISOString()

  // Create auction item
  const { data: auctionItem, error: itemError } = await supabase
    .from('salarycap_auction_item')
    .insert({
      auction_id: auction.id,
      player_id: selectedPlayer.id,
      nominated_by: botOwnerId,
      opening_bid: openingBid,
      current_bid: openingBid,
      current_high_bidder: botOwnerId,
      timer_end_at: timerEndAt,
      status: 'active',
    })
    .select()
    .single()

  if (itemError) {
    return { success: false, error: 'Failed to create nomination', details: itemError.message }
  }

  // Record opening bid
  await supabase.from('salarycap_auction_bids').insert({
    auction_item_id: auctionItem.id,
    owner_id: botOwnerId,
    amount: openingBid,
  })

  // Update nomination count
  await supabase
    .from('salarycap_auction')
    .update({
      total_nominations: auction.total_nominations + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', auction.id)

  return {
    success: true,
    action: 'nominated',
    player: selectedPlayer.name,
    position: selectedPlayer.position,
    opening_bid: openingBid,
    bot_id: botOwnerId
  }
}

async function placeBotBid(supabase: SupabaseClient, currentItem: any, botOwnerId: string, amount: number, auction: any) {
  const timerEndAt = new Date(currentItem.timer_end_at).getTime()
  const now = Date.now()
  const secondsRemaining = Math.floor((timerEndAt - now) / 1000)

  // Determine if timer needs reset
  let newTimerEndAt = currentItem.timer_end_at
  if (secondsRemaining < auction.timer_reset_threshold) {
    newTimerEndAt = new Date(now + auction.timer_reset_to * 1000).toISOString()
  }

  // Atomic update with optimistic locking
  const { data: updatedItem, error: updateError } = await supabase
    .from('salarycap_auction_item')
    .update({
      current_bid: amount,
      current_high_bidder: botOwnerId,
      timer_end_at: newTimerEndAt,
    })
    .eq('id', currentItem.id)
    .eq('current_bid', currentItem.current_bid)
    .eq('status', 'active')
    .select()
    .single()

  if (updateError || !updatedItem) {
    return {
      success: false,
      action: 'outbid',
      reason: 'Another bid came in first'
    }
  }

  // Record bid in history
  await supabase.from('salarycap_auction_bids').insert({
    auction_item_id: currentItem.id,
    owner_id: botOwnerId,
    amount: amount,
  })

  return {
    success: true,
    action: 'bid',
    amount: amount,
    bot_id: botOwnerId,
    player: currentItem.player?.name,
    timer_reset: newTimerEndAt !== currentItem.timer_end_at
  }
}
