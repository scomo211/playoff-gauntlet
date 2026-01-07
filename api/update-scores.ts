import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Sleeper stats response type
interface SleeperPlayerStats {
  player_id: string
  stats: {
    // Passing
    pass_yd?: number
    pass_td?: number
    pass_int?: number
    pass_2pt?: number
    // Rushing
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
    fgm_yds?: number
    fgm_0_19?: number
    fgm_20_29?: number
    fgm_30_39?: number
    fgm_40_49?: number
    fgm_50p?: number
    xpm?: number
    xpmiss?: number
    // Defense
    def_st_fum_rec?: number
    def_int?: number
    sack?: number
    safe?: number
    pts_allow?: number
    // Misc
    fum_lost?: number
    pr_td?: number
    kr_td?: number
    def_td?: number
    st_td?: number
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
  // Sleeper gives us individual FG buckets, calculate yards
  const fgYards =
    (stats.fgm_0_19 || 0) * 17 +    // avg 17 yards
    (stats.fgm_20_29 || 0) * 25 +   // avg 25 yards
    (stats.fgm_30_39 || 0) * 35 +   // avg 35 yards
    (stats.fgm_40_49 || 0) * 45 +   // avg 45 yards
    (stats.fgm_50p || 0) * 53       // avg 53 yards
  points += fgYards * 0.1
  points += (stats.xpm || 0) * 1
  points += (stats.xpmiss || 0) * -1

  // Defense: +2 fumble rec, +2 INT, +1 sack, +2 safety
  if (position === 'DEF') {
    points += (stats.def_st_fum_rec || 0) * 2
    points += (stats.def_int || 0) * 2
    points += (stats.sack || 0) * 1
    points += (stats.safe || 0) * 2
    points += (stats.def_td || 0) * 6
    points += (stats.st_td || 0) * 6

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

async function fetchSleeperStats(week: number, testMode: boolean = false): Promise<SleeperPlayerStats[]> {
  // Use 2023 data for testing, 2024 for production
  const season = testMode ? '2023' : '2024'
  const url = `https://api.sleeper.com/stats/nfl/${season}/${week}?season_type=post`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status}`)
  }

  const data = await response.json()

  // Transform Sleeper's response format
  return data.map((item: { player_id: string; stats: SleeperPlayerStats['stats'] }) => ({
    player_id: item.player_id,
    stats: item.stats || {}
  }))
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
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
    throw new Error(`Supabase error: ${response.status} - ${text}`)
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json()
  }
  return null
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
      pass_yards: number
      pass_td: number
      interceptions: number
      rush_yards: number
      rush_td: number
      receptions: number
      rec_yards: number
      rec_td: number
      fumbles_lost: number
    }> = []

    for (const stat of sleeperStats) {
      const position = playerMap.get(stat.player_id)
      if (!position) continue // Skip players not in our database

      const points = calculatePoints(stat.stats, position)

      playerStats.push({
        player_id: stat.player_id,
        week_id: currentWeek,
        total_points: points,
        pass_yards: stat.stats.pass_yd || 0,
        pass_td: stat.stats.pass_td || 0,
        interceptions: stat.stats.pass_int || 0,
        rush_yards: stat.stats.rush_yd || 0,
        rush_td: stat.stats.rush_td || 0,
        receptions: stat.stats.rec || 0,
        rec_yards: stat.stats.rec_yd || 0,
        rec_td: stat.stats.rec_td || 0,
        fumbles_lost: stat.stats.fum_lost || 0,
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

    // Update each lineup_player's points
    let updatedLineupPlayers = 0
    for (const lineup of lineups || []) {
      for (const lp of lineup.lineup_players || []) {
        const points = pointsMap.get(lp.player_id) || 0
        await supabaseRequest(`/lineup_players?id=eq.${lp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ points_scored: points }),
        })
        updatedLineupPlayers++
      }
    }

    console.log(`Updated ${updatedLineupPlayers} lineup player scores`)

    // Recalculate lineup totals
    let updatedLineups = 0
    for (const lineup of lineups || []) {
      const lineupPlayers = await supabaseRequest(
        `/lineup_players?lineup_id=eq.${lineup.id}&select=points_scored`
      )
      const totalPoints = (lineupPlayers || []).reduce(
        (sum: number, lp: { points_scored: number }) => sum + (lp.points_scored || 0),
        0
      )

      await supabaseRequest(`/lineups?id=eq.${lineup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ total_points: Math.round(totalPoints * 100) / 100 }),
      })
      updatedLineups++
    }

    console.log(`Updated ${updatedLineups} lineup totals`)

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      testMode,
      season: testMode ? '2023' : '2024',
      week: currentWeek,
      playersUpdated: playerStats.length,
      lineupsUpdated: updatedLineups,
      lineupPlayersUpdated: updatedLineupPlayers,
    })
  } catch (error) {
    console.error('Error updating scores:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
