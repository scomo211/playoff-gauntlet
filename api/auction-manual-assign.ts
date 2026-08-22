import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SALARY_CAP = 200

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
    const { player_id, owner_id, salary, auction_id } = req.body

    // Validate required fields
    if (!player_id || !owner_id || salary === undefined || !auction_id) {
      return res.status(400).json({
        error: 'Missing required fields: player_id, owner_id, salary, auction_id'
      })
    }

    const parsedSalary = parseInt(salary, 10)
    if (isNaN(parsedSalary) || parsedSalary < 1) {
      return res.status(400).json({ error: 'Salary must be a positive integer' })
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

    if (auction.status !== 'active' && auction.status !== 'paused') {
      return res.status(400).json({ error: 'Auction is not active' })
    }

    // Check if player is already rostered
    const { data: existingRoster } = await supabase
      .from('salarycap_rosters')
      .select('id')
      .eq('player_id', player_id)
      .maybeSingle()

    if (existingRoster) {
      return res.status(400).json({ error: 'Player is already rostered' })
    }

    // Check if player was already won in this auction
    const { data: existingResult } = await supabase
      .from('salarycap_auction_results')
      .select('id')
      .eq('auction_id', auction_id)
      .eq('player_id', player_id)
      .maybeSingle()

    if (existingResult) {
      return res.status(400).json({ error: 'Player was already won in this auction' })
    }

    // Get owner info
    const { data: owner, error: ownerError } = await supabase
      .from('salarycap_owners')
      .select('*')
      .eq('id', owner_id)
      .single()

    if (ownerError || !owner) {
      return res.status(400).json({ error: 'Owner not found' })
    }

    // Calculate owner's current spending in this auction
    const { data: ownerResults } = await supabase
      .from('salarycap_auction_results')
      .select('winning_bid')
      .eq('auction_id', auction_id)
      .eq('winner_id', owner_id)

    const totalSpent = (ownerResults || []).reduce((sum, r) => sum + r.winning_bid, 0)
    const remainingCap = SALARY_CAP - totalSpent

    if (parsedSalary > remainingCap) {
      return res.status(400).json({
        error: `Owner only has $${remainingCap} cap space remaining (spent $${totalSpent})`
      })
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('salarycap_players')
      .select('*')
      .eq('id', player_id)
      .single()

    if (playerError || !player) {
      return res.status(400).json({ error: 'Player not found' })
    }

    // Create the auction result record
    const newNominationNumber = auction.total_nominations + 1
    const { data: result, error: resultError } = await supabase
      .from('salarycap_auction_results')
      .insert({
        auction_id: auction_id,
        player_id: player_id,
        winner_id: owner_id,
        winning_bid: parsedSalary,
        nomination_number: newNominationNumber,
      })
      .select('*, player:salarycap_players(*), winner:salarycap_owners!winner_id(*)')
      .single()

    if (resultError) throw resultError

    // Add player to owner's roster
    const { error: rosterError } = await supabase
      .from('salarycap_rosters')
      .insert({
        owner_id: owner_id,
        player_id: player_id,
      })

    if (rosterError) throw rosterError

    // Increment total_nominations on auction
    const { error: updateError } = await supabase
      .from('salarycap_auction')
      .update({
        total_nominations: newNominationNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auction_id)

    if (updateError) throw updateError

    return res.status(200).json({
      success: true,
      result: {
        player_name: player.name,
        player_position: player.position,
        owner_name: owner.owner_name,
        salary: parsedSalary,
        nomination_number: newNominationNumber,
      },
      message: `${player.name} manually assigned to ${owner.owner_name} for $${parsedSalary}`
    })
  } catch (error) {
    console.error('Error in manual assignment:', error)
    return res.status(500).json({
      error: 'Failed to assign player',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
