import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { nomination_order } = req.body || {}

    // Get all active owners
    const { data: owners, error: ownersError } = await supabase
      .from('salarycap_owners')
      .select('id, owner_name')
      .eq('is_active', true)
      .order('owner_name')

    if (ownersError) throw ownersError
    if (!owners || owners.length === 0) {
      return res.status(400).json({ error: 'No active owners found' })
    }

    // Use provided order or create default order
    let order: string[]
    if (nomination_order && Array.isArray(nomination_order) && nomination_order.length === owners.length) {
      order = nomination_order
    } else {
      // Default: alphabetical order by owner name
      order = owners.map(o => o.id)
    }

    // Check if there's already an active auction
    const { data: existingAuction } = await supabase
      .from('salarycap_auction')
      .select('id, status')
      .in('status', ['pending', 'active', 'paused'])
      .single()

    if (existingAuction) {
      return res.status(400).json({
        error: 'An auction is already in progress',
        auction_id: existingAuction.id,
        status: existingAuction.status
      })
    }

    // Create new auction
    const { data: auction, error: auctionError } = await supabase
      .from('salarycap_auction')
      .insert({
        status: 'active',
        nomination_order: order,
        current_nominator_index: 0,
        total_nominations: 0,
        timer_duration: 30,
        timer_reset_threshold: 10,
        timer_reset_to: 10,
      })
      .select()
      .single()

    if (auctionError) throw auctionError

    // Get first nominator info
    const firstNominatorId = order[0]
    const firstNominator = owners.find(o => o.id === firstNominatorId)

    return res.status(200).json({
      success: true,
      auction,
      first_nominator: firstNominator,
      message: `Auction started! ${firstNominator?.owner_name} is first to nominate.`
    })
  } catch (error) {
    console.error('Error starting auction:', error)
    return res.status(500).json({
      error: 'Failed to start auction',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
