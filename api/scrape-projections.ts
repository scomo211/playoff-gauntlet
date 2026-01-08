import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface ProjectionRow {
  player_name: string
  team_id: string
  week_id: number
  fantasy_points: number
}

// Team abbreviation mapping (FantasyPros uses some different abbrevs)
const TEAM_MAP: Record<string, string> = {
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF',
  'CAR': 'CAR', 'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE',
  'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GB': 'GB',
  'HOU': 'HOU', 'IND': 'IND', 'JAC': 'JAX', 'JAX': 'JAX',
  'KC': 'KC', 'LA': 'LAR', 'LAC': 'LAC', 'LAR': 'LAR',
  'LV': 'LV', 'MIA': 'MIA', 'MIN': 'MIN', 'NE': 'NE',
  'NO': 'NO', 'NYG': 'NYG', 'NYJ': 'NYJ', 'PHI': 'PHI',
  'PIT': 'PIT', 'SEA': 'SEA', 'SF': 'SF', 'TB': 'TB',
  'TEN': 'TEN', 'WAS': 'WAS'
}

function normalizeTeam(team: string): string {
  const upper = team.toUpperCase().trim()
  return TEAM_MAP[upper] || upper
}

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
    .trim()
}

// Calculate fantasy points using Playoff Gauntlet league scoring
function calculateQBPoints(stats: {
  passYards: number
  passTDs: number
  ints: number
  rushYards: number
  rushTDs: number
  fumblesLost: number
}): number {
  let points = 0
  points += stats.passYards * 0.04      // 0.04 per passing yard
  points += stats.passTDs * 6           // 6 pts per passing TD
  points += stats.ints * -2             // -2 per INT
  points += stats.rushYards * 0.1       // 0.1 per rushing yard
  points += stats.rushTDs * 6           // 6 pts per rushing TD
  points += stats.fumblesLost * -2      // -2 per fumble lost
  return Math.round(points * 100) / 100
}

function calculateSkillPoints(stats: {
  rushYards: number
  rushTDs: number
  receptions: number
  recYards: number
  recTDs: number
  fumblesLost: number
}): number {
  let points = 0
  points += stats.rushYards * 0.1       // 0.1 per rushing yard
  points += stats.rushTDs * 6           // 6 pts per rushing TD
  points += stats.receptions * 0.5      // 0.5 per reception (half PPR)
  points += stats.recYards * 0.1        // 0.1 per receiving yard
  points += stats.recTDs * 6            // 6 pts per receiving TD
  points += stats.fumblesLost * -2      // -2 per fumble lost
  return Math.round(points * 100) / 100
}

function calculateKickerPoints(stats: {
  fgMade: number
  xpMade: number
}): number {
  // Estimate average FG distance of 37 yards
  const avgFGYards = 37
  let points = 0
  points += stats.fgMade * avgFGYards * 0.1  // 0.1 per FG yard
  points += stats.xpMade * 1                  // 1 pt per XP
  return Math.round(points * 100) / 100
}

function calculateDSTPoints(stats: {
  sacks: number
  ints: number
  fumbleRec: number
  safeties: number
  defTDs: number
  ptsAllowed: number
}): number {
  let points = 0
  points += stats.sacks * 1             // 1 pt per sack
  points += stats.ints * 2              // 2 pts per INT
  points += stats.fumbleRec * 2         // 2 pts per fumble recovery
  points += stats.safeties * 2          // 2 pts per safety
  points += stats.defTDs * 6            // 6 pts per defensive TD

  // Points allowed scoring
  const pa = stats.ptsAllowed
  if (pa <= 6) points += 10
  else if (pa <= 13) points += 7
  else if (pa <= 20) points += 4
  else if (pa <= 27) points += 1
  else if (pa <= 34) points += 0
  else if (pa <= 41) points += -1
  else points += -3

  return Math.round(points * 100) / 100
}

async function fetchAndParseProjections(position: string): Promise<ProjectionRow[]> {
  const url = `https://www.fantasypros.com/nfl/projections/${position}.php`

  // Use Jina AI's reader API to render JavaScript and get readable content
  const jinaUrl = `https://r.jina.ai/${url}`

  const response = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
    }
  })

  if (!response.ok) {
    console.error(`Failed to fetch ${position} projections: ${response.status}`)
    return []
  }

  const text = await response.text()
  const rows: ProjectionRow[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Match pattern: [Player Name](url) TEAM followed by numbers
    // Example: [Josh Allen](url) BUF 30.1 20.3 236.0 1.6 0.7 6.8 34.7 0.7 0.0 22.5
    const playerMatch = line.match(/\[([^\]]+)\]\([^)]+\)\s+([A-Z]{2,3})\s+([\d.\s]+)/)

    if (!playerMatch) continue

    const name = normalizePlayerName(playerMatch[1])
    const team = normalizeTeam(playerMatch[2])
    const statsStr = playerMatch[3]

    if (!name || !team) continue

    // Parse the space-separated numbers
    const numbers = statsStr.trim().split(/\s+/).map(n => parseFloat(n)).filter(n => !isNaN(n))

    if (numbers.length < 3) continue

    let fantasyPoints = 0

    // QB stats order: ATT CMP YDS TDS INTS rush_ATT rush_YDS rush_TDS FL FPTS
    // Indices:        0   1   2   3   4     5         6         7      8  9
    if (position === 'qb' && numbers.length >= 10) {
      fantasyPoints = calculateQBPoints({
        passYards: numbers[2],   // YDS
        passTDs: numbers[3],     // TDS
        ints: numbers[4],        // INTS
        rushYards: numbers[6],   // rush YDS
        rushTDs: numbers[7],     // rush TDS
        fumblesLost: numbers[8]  // FL
      })
    }
    // RB stats order: ATT YDS TDS REC rec_YDS rec_TDS FL FPTS
    // Indices:        0   1   2   3   4       5       6  7
    else if (position === 'rb' && numbers.length >= 8) {
      fantasyPoints = calculateSkillPoints({
        rushYards: numbers[1],   // rush YDS
        rushTDs: numbers[2],     // rush TDS
        receptions: numbers[3],  // REC
        recYards: numbers[4],    // rec YDS
        recTDs: numbers[5],      // rec TDS
        fumblesLost: numbers[6]  // FL
      })
    }
    // WR/TE stats order: REC YDS TDS rush_ATT rush_YDS rush_TDS FL FPTS
    // Indices:           0   1   2   3        4        5        6  7
    else if ((position === 'wr' || position === 'te') && numbers.length >= 8) {
      fantasyPoints = calculateSkillPoints({
        receptions: numbers[0],  // REC
        recYards: numbers[1],    // rec YDS
        recTDs: numbers[2],      // rec TDS
        rushYards: numbers[4],   // rush YDS (after rush ATT)
        rushTDs: numbers[5],     // rush TDS
        fumblesLost: numbers[6]  // FL
      })
    }
    // K stats order: FG FGA XPT FPTS
    // Indices:       0  1   2   3
    else if (position === 'k' && numbers.length >= 4) {
      fantasyPoints = calculateKickerPoints({
        fgMade: numbers[0],      // FG
        xpMade: numbers[2]       // XPT
      })
    }
    // DST stats order: SACK INT FR FF TD SAFE PA YDS_AG FPTS
    // Indices:         0    1   2  3  4  5    6  7      8
    else if (position === 'dst' && numbers.length >= 9) {
      fantasyPoints = calculateDSTPoints({
        sacks: numbers[0],       // SACK
        ints: numbers[1],        // INT
        fumbleRec: numbers[2],   // FR
        defTDs: numbers[4],      // TD
        safeties: numbers[5],    // SAFE
        ptsAllowed: numbers[6]   // PA
      })
    }

    if (fantasyPoints > 0) {
      rows.push({
        player_name: name,
        team_id: team,
        week_id: 1,
        fantasy_points: fantasyPoints
      })
    }
  }

  return rows
}

// For DST, we need to handle team names specially
function normalizeDSTName(teamCity: string): string {
  const cityToTeam: Record<string, string> = {
    'arizona': 'cardinals', 'atlanta': 'falcons', 'baltimore': 'ravens',
    'buffalo': 'bills', 'carolina': 'panthers', 'chicago': 'bears',
    'cincinnati': 'bengals', 'cleveland': 'browns', 'dallas': 'cowboys',
    'denver': 'broncos', 'detroit': 'lions', 'green bay': 'packers',
    'houston': 'texans', 'indianapolis': 'colts', 'jacksonville': 'jaguars',
    'kansas city': 'chiefs', 'las vegas': 'raiders', 'los angeles chargers': 'chargers',
    'los angeles rams': 'rams', 'miami': 'dolphins', 'minnesota': 'vikings',
    'new england': 'patriots', 'new orleans': 'saints', 'new york giants': 'giants',
    'new york jets': 'jets', 'philadelphia': 'eagles', 'pittsburgh': 'steelers',
    'san francisco': '49ers', 'seattle': 'seahawks', 'tampa bay': 'buccaneers',
    'tennessee': 'titans', 'washington': 'commanders'
  }

  const lower = teamCity.toLowerCase()
  const teamName = cityToTeam[lower]
  return teamName ? `${teamName} defense` : `${lower} defense`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow manual trigger via GET for testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  // Get week from query param, default to 1
  const weekId = parseInt(req.query.week as string) || 1

  try {
    const positions = ['qb', 'rb', 'wr', 'te', 'k', 'dst']
    const allRows: ProjectionRow[] = []
    const results: Record<string, number> = {}

    for (const pos of positions) {
      console.log(`Fetching ${pos} projections...`)
      const rows = await fetchAndParseProjections(pos)

      // Set week ID and handle DST names
      for (const row of rows) {
        row.week_id = weekId
        if (pos === 'dst') {
          row.player_name = normalizeDSTName(row.player_name)
        }
      }

      allRows.push(...rows)
      results[pos] = rows.length

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500))
    }

    if (allRows.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No projections found - playoffs may not have started yet',
        timestamp: new Date().toISOString()
      })
    }

    // Delete existing projections for this week
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/projections?week_id=eq.${weekId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    )

    if (!deleteResponse.ok) {
      console.error('Failed to delete old projections:', await deleteResponse.text())
    }

    // Insert new projections
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/projections`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(allRows)
      }
    )

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text()
      console.error('Failed to insert projections:', errorText)
      return res.status(500).json({ error: 'Failed to save projections', details: errorText })
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      week: weekId,
      total: allRows.length,
      byPosition: results
    })
  } catch (error) {
    console.error('Error scraping projections:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
