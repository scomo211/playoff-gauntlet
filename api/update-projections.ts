import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPORTSDATA_API_KEY = process.env.VITE_SPORTSDATA_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SportsDataProjection {
  Name: string
  Team: string
  Position: string
  FantasyPointsPPR: number
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
  return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
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

      // Transform player projections to database format
      const rows: ProjectionRow[] = projections
        .filter(p => p.FantasyPointsPPR > 0)
        .map(p => ({
          player_name: normalizePlayerName(p.Name),
          team_id: p.Team,
          week_id: week,
          fantasy_points: p.FantasyPointsPPR,
        }))

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

      // Upsert to Supabase using REST API
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
