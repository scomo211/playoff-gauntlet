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
    const { human_owner_ids, all_owner_ids } = req.body

    if (!human_owner_ids || !Array.isArray(human_owner_ids) || human_owner_ids.length === 0) {
      return res.status(400).json({ error: 'At least one human participant is required' })
    }

    if (!all_owner_ids || !Array.isArray(all_owner_ids)) {
      return res.status(400).json({ error: 'all_owner_ids is required' })
    }

    // Check if there's already an active auction
    const { data: existingAuctions } = await supabase
      .from('salarycap_auction')
      .select('id, status')
      .in('status', ['pending', 'active', 'paused'])

    if (existingAuctions && existingAuctions.length > 0) {
      return res.status(400).json({
        error: 'An auction is already in progress',
        auction_id: existingAuctions[0].id,
        status: existingAuctions[0].status
      })
    }

    // Determine bot owners (anyone not in human list)
    const botOwnerIds = all_owner_ids.filter((id: string) => !human_owner_ids.includes(id))

    // Create nomination order (humans first shuffled, then bots shuffled)
    const shuffledHumans = [...human_owner_ids].sort(() => Math.random() - 0.5)
    const shuffledBots = [...botOwnerIds].sort(() => Math.random() - 0.5)
    const nominationOrder = [...shuffledHumans, ...shuffledBots]

    // Create test auction
    const { data: auction, error: auctionError } = await supabase
      .from('salarycap_auction')
      .insert({
        status: 'active',
        nomination_order: nominationOrder,
        current_nominator_index: 0,
        total_nominations: 0,
        timer_duration: 30,
        timer_reset_threshold: 10,
        timer_reset_to: 10,
        is_test: true,
        bot_owner_ids: botOwnerIds,
      })
      .select()
      .single()

    if (auctionError) {
      throw auctionError
    }

    // Get first nominator info
    const firstNominatorId = nominationOrder[0]
    const { data: firstNominator } = await supabase
      .from('salarycap_owners')
      .select('id, owner_name')
      .eq('id', firstNominatorId)
      .single()

    return res.status(200).json({
      success: true,
      auction,
      first_nominator: firstNominator,
      human_count: human_owner_ids.length,
      bot_count: botOwnerIds.length,
      message: `Test auction started! ${human_owner_ids.length} humans, ${botOwnerIds.length} bots. ${firstNominator?.owner_name} nominates first.`
    })
  } catch (error: any) {
    console.error('Error starting test auction:', error)
    return res.status(500).json({
      error: 'Failed to start test auction',
      details: error?.message || error?.code || error?.hint || JSON.stringify(error)
    })
  }
}
