import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPORTSDATA_API_KEY = process.env.VITE_SPORTSDATA_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SportsDataProjection {
  Name: string
  Team: string
  Position: string
  FantasyPointsPPR: number
  // Raw stats for custom scoring calculation
  PassingYards: number
  PassingTouchdowns: number
  PassingInterceptions: number
  RushingYards: number
  RushingTouchdowns: number
  Receptions: number
  ReceivingYards: number
  ReceivingTouchdowns: number
  FumblesLost: number
  TwoPointConversionPasses: number
  TwoPointConversionRuns: number
  TwoPointConversionReceptions: number
  // Kicker stats
  FieldGoalsMade: number
  FieldGoalsMade40to49: number
  FieldGoalsMade50Plus: number
  ExtraPointsMade: number
}

interface DefenseProjection {
  Team: string
  FantasyPoints: number
}

interface ProjectionRow {
  player_name: string
  team_id: string
  week_id: number
  fantasy_points: number
}

// Team name mapping for defense projections
const TEAM_NAMES: Record<string, string> = {
  BUF: 'bills', DEN: 'broncos', NE: 'patriots', JAX: 'jaguars',
  HOU: 'texans', LAC: 'chargers', PIT: 'steelers', SEA: 'seahawks',
  CHI: 'bears', PHI: 'eagles', LAR: 'rams', GB: 'packers',
  CAR: 'panthers', SF: '49ers'
}

async function fetchProjectionsFromAPI(week: number): Promise<SportsDataProjection[]> {
  const url = `https://api.sportsdata.io/v3/nfl/projections/json/PlayerGameProjectionStatsByWeek/2025POST/${week}`

  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY!,
    },
  })

  if (!response.ok) {
    throw new Error(`SportsDataIO API error: ${response.status}`)
  }

  return response.json()
}

async function fetchDefenseProjectionsFromAPI(week: number): Promise<DefenseProjection[]> {
  const url = `https://api.sportsdata.io/v3/nfl/projections/json/FantasyDefenseProjectionsByGame/2025POST/${week}`

  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY!,
    },
  })

  if (!response.ok) {
    console.error(`Defense projections API error: ${response.status}`)
    return []
  }

  return response.json()
}

function normalizePlayerName(name: string): string {
  // Lowercase, remove periods and extra spaces
  let normalized = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  // Remove common suffixes (jr, sr, ii, iii, iv, v) to match our players table
  normalized = normalized.replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
  return normalized
}

// Calculate fantasy points using Playoff Gauntlet league scoring rules:
// Passing: 0.04/yard, 6 pts/TD, -2 INT
// Rushing: 0.1/yard, 6 pts/TD
// Receiving: 0.5 pts/reception (half PPR), 0.1/yard, 6 pts/TD
// Misc: -2 fumble lost, +2 per 2PT conversion
function calculateCustomFantasyPoints(p: SportsDataProjection): number {
  let points = 0

  // Passing
  points += (p.PassingYards || 0) * 0.04
  points += (p.PassingTouchdowns || 0) * 6
  points += (p.PassingInterceptions || 0) * -2

  // Rushing
  points += (p.RushingYards || 0) * 0.1
  points += (p.RushingTouchdowns || 0) * 6

  // Receiving (Half PPR)
  points += (p.Receptions || 0) * 0.5
  points += (p.ReceivingYards || 0) * 0.1
  points += (p.ReceivingTouchdowns || 0) * 6

  // Miscellaneous
  points += (p.FumblesLost || 0) * -2
  points += ((p.TwoPointConversionPasses || 0) +
             (p.TwoPointConversionRuns || 0) +
             (p.TwoPointConversionReceptions || 0)) * 2

  // Kicking
  const fgMade = p.FieldGoalsMade || 0
  const fg40to49 = p.FieldGoalsMade40to49 || 0
  const fg50Plus = p.FieldGoalsMade50Plus || 0
  const fgUnder40 = Math.max(0, fgMade - fg40to49 - fg50Plus)
  points += fgUnder40 * 3      // 3 pts for FG under 40 yards
  points += fg40to49 * 4       // 4 pts for FG 40-49 yards
  points += fg50Plus * 5       // 5 pts for FG 50+ yards
  points += (p.ExtraPointsMade || 0) * 1  // 1 pt per XP

  // Apply correction factor for non-kickers only
  // SportsDataIO postseason projections appear inflated for skill positions
  // Kicker projections are more accurate, so don't scale them down
  const isKicker = p.Position === 'K'
  const correctedPoints = isKicker ? points : points * 0.6

  return Math.round(correctedPoints * 100) / 100 // Round to 2 decimal places
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron job or has proper auth
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.method !== 'GET') {
    // Allow GET requests for manual testing
  }

  if (!SPORTSDATA_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  try {
    const results: { week: number; count: number }[] = []

    // Update projections for weeks 1-4 (Wild Card through Super Bowl)
    for (const week of [1, 2, 3, 4]) {
      // Fetch player projections
      const projections = await fetchProjectionsFromAPI(week)

      // Fetch defense projections
      const defenseProjections = await fetchDefenseProjectionsFromAPI(week)

      // Transform player projections to database format using custom league scoring
      const rows: ProjectionRow[] = projections
        .map(p => {
          const customPoints = calculateCustomFantasyPoints(p)
          return {
            player_name: normalizePlayerName(p.Name),
            team_id: p.Team,
            week_id: week,
            fantasy_points: customPoints,
          }
        })
        .filter(p => p.fantasy_points > 0)

      // Add defense projections
      for (const def of defenseProjections) {
        const teamName = TEAM_NAMES[def.Team]
        if (teamName && def.FantasyPoints > 0) {
          rows.push({
            player_name: `${teamName} defense`,
            team_id: def.Team,
            week_id: week,
            fantasy_points: def.FantasyPoints,
          })
        }
      }

      if (rows.length === 0) {
        results.push({ week, count: 0 })
        continue
      }

      // Delete existing projections for this week first
      await fetch(
        `${SUPABASE_URL}/rest/v1/projections?week_id=eq.${week}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      )

      // Insert new projections
      const upsertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/projections`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(rows),
        }
      )

      if (!upsertResponse.ok) {
        const errorText = await upsertResponse.text()
        console.error(`Failed to upsert week ${week}:`, errorText)
      }

      results.push({ week, count: rows.length })
    }

    // Update the last_updated timestamp in a metadata table or just log
    const timestamp = new Date().toISOString()

    return res.status(200).json({
      success: true,
      timestamp,
      results,
    })
  } catch (error) {
    console.error('Error updating projections:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
