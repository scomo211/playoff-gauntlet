import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Sleeper stats response type
interface SleeperPlayerStats {
  player_id: string
  stats: {
    // Passing
    pass_att?: number
    pass_cmp?: number
    pass_yd?: number
    pass_td?: number
    pass_int?: number
    pass_2pt?: number
    // Rushing
    rush_att?: number
    rush_yd?: number
    rush_td?: number
    rush_2pt?: number
    // Receiving
    rec?: number
    rec_yd?: number
    rec_td?: number
    rec_2pt?: number
    // Kicking
    fgm?: number
    fgm_yds?: number  // Total FG yards (Sleeper provides directly)
    fgm_0_19?: number
    fgm_20_29?: number
    fgm_30_39?: number
    fgm_40_49?: number
    fgm_50p?: number
    xpm?: number
    xpmiss?: number
    // Defense (Sleeper field names)
    def_st_fum_rec?: number  // fumble recoveries
    fum_rec?: number         // alternative name for fumble recoveries
    def_int?: number         // interceptions (alternative)
    int?: number             // interceptions (Sleeper uses this)
    sack?: number            // sacks
    safe?: number            // safeties
    pts_allow?: number       // points allowed
    // TD fields - don't use generic "td" as it includes offensive TDs!
    def_td?: number          // defensive TD
    st_td?: number           // special teams TD
    int_ret_td?: number      // interception return TD
    fum_ret_td?: number      // fumble return TD
    // Misc
    fum_lost?: number
    pr_td?: number
    kr_td?: number
  }
}

// Calculate fantasy points based on scoring rules
function calculatePoints(stats: SleeperPlayerStats['stats'], position: string): number {
  let points = 0

  // Passing: 0.04/yard, +6 TD, -2 INT, +2 2PT
  points += (stats.pass_yd || 0) * 0.04
  points += (stats.pass_td || 0) * 6
  points += (stats.pass_int || 0) * -2
  points += (stats.pass_2pt || 0) * 2

  // Rushing: 0.1/yard, +6 TD, +2 2PT
  points += (stats.rush_yd || 0) * 0.1
  points += (stats.rush_td || 0) * 6
  points += (stats.rush_2pt || 0) * 2

  // Receiving (Half PPR): +0.5 reception, 0.1/yard, +6 TD, +2 2PT
  points += (stats.rec || 0) * 0.5
  points += (stats.rec_yd || 0) * 0.1
  points += (stats.rec_td || 0) * 6
  points += (stats.rec_2pt || 0) * 2

  // Kicking: 0.1/FG yard, +1 XP, -1 XP miss
  // Sleeper provides fgm_yds directly, or we calculate from buckets as fallback
  let fgYards = stats.fgm_yds || 0
  if (!fgYards && (stats.fgm_0_19 || stats.fgm_20_29 || stats.fgm_30_39 || stats.fgm_40_49 || stats.fgm_50p)) {
    // Fallback: calculate from buckets using average distances
    fgYards =
      (stats.fgm_0_19 || 0) * 17 +    // avg 17 yards
      (stats.fgm_20_29 || 0) * 25 +   // avg 25 yards
      (stats.fgm_30_39 || 0) * 35 +   // avg 35 yards
      (stats.fgm_40_49 || 0) * 45 +   // avg 45 yards
      (stats.fgm_50p || 0) * 53       // avg 53 yards
  }
  points += fgYards * 0.1
  points += (stats.xpm || 0) * 1
  points += (stats.xpmiss || 0) * -1

  // Defense: +2 fumble rec, +2 INT, +1 sack, +2 safety, +6 def/ST TD
  if (position === 'DEF') {
    // Use Sleeper field names with fallbacks
    // Note: Sleeper's generic "td" field includes offensive TDs, don't use it!
    // Only count TDs from specific defensive/ST fields
    const fumbleRec = stats.def_st_fum_rec || stats.fum_rec || 0
    const interceptions = stats.int || stats.def_int || 0
    // Only count defensive/ST TDs from specific fields, NOT generic "td"
    const defTDs = (stats.def_td || 0) + (stats.st_td || 0) + (stats.int_ret_td || 0) + (stats.fum_ret_td || 0)

    points += fumbleRec * 2
    points += interceptions * 2
    points += (stats.sack || 0) * 1
    points += (stats.safe || 0) * 2
    points += defTDs * 6

    // Points allowed scoring
    const ptsAllowed = stats.pts_allow || 0
    if (ptsAllowed <= 6) points += 10
    else if (ptsAllowed <= 13) points += 7
    else if (ptsAllowed <= 20) points += 4
    else if (ptsAllowed <= 27) points += 1
    else if (ptsAllowed <= 34) points += 0
    else if (ptsAllowed <= 41) points += -1
    else points += -3
  }

  // Misc: -2 fumble lost, +6 punt/kick return TD
  points += (stats.fum_lost || 0) * -2
  points += (stats.pr_td || 0) * 6
  points += (stats.kr_td || 0) * 6

  return Math.round(points * 100) / 100
}

// Map Sleeper defense IDs to our database IDs
function mapPlayerId(sleeperId: string): string {
  // Sleeper uses team abbreviation for defenses (e.g., "LAR")
  // Our database uses "TEAM_DEF" format (e.g., "LAR_DEF")
  const defenseTeams = ['LAR', 'CAR', 'DEN', 'BUF', 'PIT', 'BAL', 'LAC', 'HOU', 'GB', 'PHI', 'WAS', 'TB', 'MIN', 'DET', 'KC', 'SF']
  if (defenseTeams.includes(sleeperId)) {
    return `${sleeperId}_DEF`
  }
  return sleeperId
}

async function fetchSleeperStats(week: number, testMode: boolean = false): Promise<SleeperPlayerStats[]> {
  // Use 2024 data for testing, 2025 for production (2025-2026 NFL season)
  const season = testMode ? '2024' : '2025'
  const url = `https://api.sleeper.com/stats/nfl/${season}/${week}?season_type=post`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status}`)
  }

  const data = await response.json()

  // Transform Sleeper's response format and map player IDs
  return data.map((item: { player_id: string; stats: SleeperPlayerStats['stats'] }) => ({
    player_id: mapPlayerId(item.player_id),
    stats: item.stats || {}
  }))
}

async function supabaseRequest(path: string, options: RequestInit = {}, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': options.method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        // Retry on 502/503/504 errors (transient)
        if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < retries) {
          console.log(`Supabase ${response.status} error, retrying (attempt ${attempt}/${retries})...`)
          await new Promise(r => setTimeout(r, 1000 * attempt)) // Exponential backoff
          continue
        }
        throw new Error(`Supabase error: ${response.status} - ${text.slice(0, 200)}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return response.json()
      }
      return null
    } catch (err) {
      if (attempt === retries) throw err
      console.log(`Request failed, retrying (attempt ${attempt}/${retries})...`)
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  // Test mode uses 2023 playoff data for testing before games start
  const testMode = req.query.test === 'true'

  try {
    // Get current week
    const weeks = await supabaseRequest('/weeks?is_current=eq.true&select=id')
    const currentWeek = weeks?.[0]?.id || 1

    console.log(`Updating scores for week ${currentWeek}${testMode ? ' (TEST MODE - using 2023 data)' : ''}`)

    // Fetch stats from Sleeper
    const sleeperStats = await fetchSleeperStats(currentWeek, testMode)
    console.log(`Fetched ${sleeperStats.length} player stats from Sleeper`)

    // Get all players in our database with their positions
    const players = await supabaseRequest('/players?select=id,position')
    const playerMap = new Map<string, string>(players.map((p: { id: string; position: string }) => [p.id, p.position]))

    // Calculate points for each player and build upsert data
    const playerStats: Array<{
      player_id: string
      week_id: number
      total_points: number
      pass_cmp: number
      pass_att: number
      pass_yards: number
      pass_td: number
      interceptions: number
      rush_att: number
      rush_yards: number
      rush_td: number
      receptions: number
      rec_yards: number
      rec_td: number
      fumbles_lost: number
      // Kicker stats
      fg_made_yards: number
      xp_made: number
      xp_missed: number
      // Defense stats
      def_pts_allowed: number
      def_sacks: number
      def_int: number
      def_fumble_rec: number
      def_safety: number
    }> = []

    for (const stat of sleeperStats) {
      const position = playerMap.get(stat.player_id)
      if (!position) continue // Skip players not in our database

      const points = calculatePoints(stat.stats, position)

      playerStats.push({
        player_id: stat.player_id,
        week_id: currentWeek,
        total_points: points,
        pass_cmp: stat.stats.pass_cmp || 0,
        pass_att: stat.stats.pass_att || 0,
        pass_yards: stat.stats.pass_yd || 0,
        pass_td: stat.stats.pass_td || 0,
        interceptions: stat.stats.pass_int || 0,
        rush_att: stat.stats.rush_att || 0,
        rush_yards: stat.stats.rush_yd || 0,
        rush_td: stat.stats.rush_td || 0,
        receptions: stat.stats.rec || 0,
        rec_yards: stat.stats.rec_yd || 0,
        rec_td: stat.stats.rec_td || 0,
        fumbles_lost: stat.stats.fum_lost || 0,
        // Kicker stats
        fg_made_yards: stat.stats.fgm_yds || 0,
        xp_made: stat.stats.xpm || 0,
        xp_missed: stat.stats.xpmiss || 0,
        // Defense stats
        def_pts_allowed: stat.stats.pts_allow || 0,
        def_sacks: stat.stats.sack || 0,
        def_int: stat.stats.int || stat.stats.def_int || 0,
        def_fumble_rec: stat.stats.def_st_fum_rec || stat.stats.fum_rec || 0,
        def_safety: stat.stats.safe || 0,
      })
    }

    console.log(`Calculated points for ${playerStats.length} players in our database`)

    // Upsert player_weekly_stats
    if (playerStats.length > 0) {
      await supabaseRequest('/player_weekly_stats', {
        method: 'POST',
        body: JSON.stringify(playerStats),
      })
    }

    // Update lineup_players.points_scored for current week
    // First get all lineups for current week
    const lineups = await supabaseRequest(
      `/lineups?week_id=eq.${currentWeek}&select=id,entry_id,lineup_players(id,player_id)`
    )

    // Create a map of player_id -> points for quick lookup
    const pointsMap = new Map(playerStats.map(p => [p.player_id, p.total_points]))

    // Batch update lineup_players - collect all updates first
    const lineupPlayerUpdates: Array<{ id: string; points_scored: number }> = []
    const lineupTotals: Map<string, number> = new Map()

    for (const lineup of lineups || []) {
      let lineupTotal = 0
      for (const lp of lineup.lineup_players || []) {
        const points = pointsMap.get(lp.player_id) || 0
        lineupPlayerUpdates.push({ id: lp.id, points_scored: points })
        lineupTotal += points
      }
      lineupTotals.set(lineup.id, Math.round(lineupTotal * 100) / 100)
    }

    // Update lineup_players in parallel batches
    const BATCH_SIZE = 20
    for (let i = 0; i < lineupPlayerUpdates.length; i += BATCH_SIZE) {
      const batch = lineupPlayerUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(update =>
          supabaseRequest(`/lineup_players?id=eq.${update.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ points_scored: update.points_scored }),
          })
        )
      )
    }

    console.log(`Updated ${lineupPlayerUpdates.length} lineup player scores`)

    // Update lineup totals in parallel batches
    const lineupUpdates = Array.from(lineupTotals.entries()).map(([id, total_points]) => ({
      id,
      total_points,
    }))

    for (let i = 0; i < lineupUpdates.length; i += BATCH_SIZE) {
      const batch = lineupUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(update =>
          supabaseRequest(`/lineups?id=eq.${update.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ total_points: update.total_points }),
          })
        )
      )
    }

    console.log(`Updated ${lineupUpdates.length} lineup totals`)

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      testMode,
      season: testMode ? '2024' : '2025',
      week: currentWeek,
      playersUpdated: playerStats.length,
      lineupsUpdated: lineupUpdates.length,
      lineupPlayersUpdated: lineupPlayerUpdates.length,
    })
  } catch (error) {
    console.error('Error updating scores:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
