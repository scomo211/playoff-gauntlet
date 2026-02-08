import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Playoff schedule for determining live games
const PLAYOFF_SCHEDULE = [
  // Week 1: Wild Card Weekend (Jan 10-12, 2026)
  { week_id: 1, away_team_id: 'LAR', home_team_id: 'CAR', kickoff: '2026-01-10T21:30:00Z' },
  { week_id: 1, away_team_id: 'GB', home_team_id: 'CHI', kickoff: '2026-01-11T00:00:00Z' },
  { week_id: 1, away_team_id: 'BUF', home_team_id: 'JAX', kickoff: '2026-01-11T14:30:00Z' },
  { week_id: 1, away_team_id: 'SF', home_team_id: 'PHI', kickoff: '2026-01-11T17:00:00Z' },
  { week_id: 1, away_team_id: 'LAC', home_team_id: 'NE', kickoff: '2026-01-11T20:30:00Z' },
  { week_id: 1, away_team_id: 'HOU', home_team_id: 'PIT', kickoff: '2026-01-13T01:15:00Z' },
  // Week 2: Divisional Round (Jan 17-18, 2026)
  { week_id: 2, away_team_id: 'BUF', home_team_id: 'DEN', kickoff: '2026-01-17T21:30:00Z' },
  { week_id: 2, away_team_id: 'SF', home_team_id: 'SEA', kickoff: '2026-01-18T01:00:00Z' },
  { week_id: 2, away_team_id: 'HOU', home_team_id: 'NE', kickoff: '2026-01-18T20:00:00Z' },
  { week_id: 2, away_team_id: 'LAR', home_team_id: 'CHI', kickoff: '2026-01-18T23:30:00Z' },
  // Week 3: Conference Championships (Jan 25, 2026)
  { week_id: 3, away_team_id: 'NE', home_team_id: 'DEN', kickoff: '2026-01-25T20:00:00Z' },
  { week_id: 3, away_team_id: 'LAR', home_team_id: 'SEA', kickoff: '2026-01-25T23:30:00Z' },
  // Week 4: Super Bowl LX (Feb 8, 2026)
  { week_id: 4, away_team_id: 'NE', home_team_id: 'SEA', kickoff: '2026-02-08T23:30:00Z' },
]

const GAME_DURATION_MS = 4.5 * 60 * 60 * 1000 // 4.5 hours for playoff games

// Player ID mappings: Sleeper ID -> Our DB ID
// Used when our database has a different ID than Sleeper
const PLAYER_ID_MAPPINGS: Record<string, string> = {
  '4177': '4971', // Mack Hollins - Sleeper uses 4177, our DB has 4971
}

function getTeamsWithLiveGames(weekId: number): Set<string> {
  const now = new Date()
  const liveTeams = new Set<string>()

  for (const game of PLAYOFF_SCHEDULE) {
    if (game.week_id !== weekId) continue

    const kickoff = new Date(game.kickoff)
    const estimatedEnd = new Date(kickoff.getTime() + GAME_DURATION_MS)

    // Game is live if current time is between kickoff and estimated end
    if (now >= kickoff && now <= estimatedEnd) {
      liveTeams.add(game.home_team_id)
      liveTeams.add(game.away_team_id)
      // Add defense IDs too
      liveTeams.add(`${game.home_team_id}_DEF`)
      liveTeams.add(`${game.away_team_id}_DEF`)
    }
  }

  return liveTeams
}

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

// Map Sleeper player IDs to our database IDs
function mapPlayerId(sleeperId: string): string {
  // Check explicit player ID mappings first
  if (PLAYER_ID_MAPPINGS[sleeperId]) {
    return PLAYER_ID_MAPPINGS[sleeperId]
  }

  // Sleeper uses team abbreviation for defenses (e.g., "LAR")
  // Our database uses "TEAM_DEF" format (e.g., "LAR_DEF")
  // All 14 playoff teams
  const defenseTeams = ['LAR', 'CAR', 'DEN', 'BUF', 'PIT', 'LAC', 'HOU', 'GB', 'PHI', 'SF', 'JAX', 'NE', 'CHI', 'SEA']
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

  // Handle team elimination: ?eliminate=LAR,DEN&week=3
  const eliminateTeams = req.query.eliminate as string | undefined
  const eliminateWeek = parseInt(req.query.week as string) || 3
  if (eliminateTeams) {
    const teamIds = eliminateTeams.split(',').map(t => t.trim().toUpperCase())
    console.log(`Eliminating teams: ${teamIds.join(', ')} in week ${eliminateWeek}`)

    for (const teamId of teamIds) {
      await supabaseRequest(`/teams?id=eq.${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_alive: false, eliminated_week: eliminateWeek })
      })
    }

    return res.status(200).json({
      success: true,
      message: `Eliminated teams: ${teamIds.join(', ')}`,
      eliminatedWeek: eliminateWeek
    })
  }

  // Test mode uses 2023 playoff data for testing before games start
  const testMode = req.query.test === 'true'
  // Force full update (all players) - use ?full=true
  const forceFullUpdate = req.query.full === 'true'

  try {
    // Get current week
    const weeks = await supabaseRequest('/weeks?is_current=eq.true&select=id')
    const currentWeek = weeks?.[0]?.id || 1

    // Get teams with live games
    const liveTeams = getTeamsWithLiveGames(currentWeek)
    const hasLiveGames = liveTeams.size > 0

    // If no live games and not forcing full update, skip
    if (!hasLiveGames && !forceFullUpdate && !testMode) {
      return res.status(200).json({
        success: true,
        message: 'No live games - skipping update',
        timestamp: new Date().toISOString(),
        week: currentWeek,
        liveTeams: [],
      })
    }

    console.log(`Updating scores for week ${currentWeek}${testMode ? ' (TEST MODE)' : ''}${forceFullUpdate ? ' (FULL UPDATE)' : ''}`)
    if (hasLiveGames) {
      console.log(`Live teams: ${Array.from(liveTeams).filter(t => !t.endsWith('_DEF')).join(', ')}`)
    }

    // Fetch stats from Sleeper
    const sleeperStats = await fetchSleeperStats(currentWeek, testMode)
    console.log(`Fetched ${sleeperStats.length} player stats from Sleeper`)

    // Get players - only from live teams unless forcing full update
    let playersQuery = '/players?select=id,position,team_id'
    if (hasLiveGames && !forceFullUpdate) {
      const teamIds = Array.from(liveTeams).filter(t => !t.endsWith('_DEF'))
      playersQuery += `&team_id=in.(${teamIds.join(',')})`
    }
    const players = await supabaseRequest(playersQuery)
    const playerMap = new Map<string, string>(players.map((p: { id: string; position: string }) => [p.id, p.position]))

    // Also add defense IDs to playerMap
    if (hasLiveGames && !forceFullUpdate) {
      for (const teamId of liveTeams) {
        if (teamId.endsWith('_DEF')) {
          playerMap.set(teamId, 'DEF')
        }
      }
    }

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
    // Create a set of player IDs that were updated
    const updatedPlayerIds = new Set(playerStats.map(p => p.player_id))

    // Create a map of player_id -> points for quick lookup
    const pointsMap = new Map(playerStats.map(p => [p.player_id, p.total_points]))

    // Get all lineups for current week
    const lineups = await supabaseRequest(
      `/lineups?week_id=eq.${currentWeek}&select=id,entry_id,lineup_players(id,player_id)`
    )

    // Only update lineup_players for players that have new stats
    // But always recalculate lineup totals to ensure correctness
    const lineupPlayerUpdates: Array<{ id: string; points_scored: number }> = []
    const lineupTotals: Map<string, number> = new Map()

    for (const lineup of lineups || []) {
      let lineupTotal = 0
      let hasUpdatedPlayer = false

      for (const lp of lineup.lineup_players || []) {
        // If this player was updated, add to updates
        if (updatedPlayerIds.has(lp.player_id)) {
          const points = pointsMap.get(lp.player_id) || 0
          lineupPlayerUpdates.push({ id: lp.id, points_scored: points })
          lineupTotal += points
          hasUpdatedPlayer = true
        } else {
          // For non-updated players, we need to fetch their current points
          // This will be done in a second pass for lineups that have updates
        }
      }

      // Only recalculate totals for lineups that had updated players
      if (hasUpdatedPlayer) {
        lineupTotals.set(lineup.id, -1) // Mark for recalculation
      }
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

    // Recalculate totals for lineups that had updates
    // Fetch fresh data AFTER the lineup_player updates are complete
    const lineupUpdates: Array<{ id: string; total_points: number }> = []

    if (lineupTotals.size > 0) {
      const lineupIds = Array.from(lineupTotals.keys())
      const lineupsWithPoints = await supabaseRequest(
        `/lineups?id=in.(${lineupIds.join(',')})&select=id,lineup_players(points_scored)`
      )

      for (const lineup of lineupsWithPoints || []) {
        const total = (lineup.lineup_players || []).reduce(
          (sum: number, lp: { points_scored: number }) => sum + (lp.points_scored || 0),
          0
        )
        lineupUpdates.push({ id: lineup.id, total_points: Math.round(total * 100) / 100 })
      }

      // Update lineup totals in parallel batches
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
    }

    console.log(`Updated ${lineupUpdates.length} lineup totals`)

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      testMode,
      fullUpdate: forceFullUpdate,
      season: testMode ? '2024' : '2025',
      week: currentWeek,
      liveTeams: Array.from(liveTeams).filter(t => !t.endsWith('_DEF')),
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
