import { useState, useEffect } from 'react'

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

// Full player data from Sleeper API
export interface SleeperPlayerFull {
  player_id: string
  first_name: string
  last_name: string
  full_name: string
  position: string
  team: string | null
  number: number | null
  height: string | null
  weight: string | null
  age: number | null
  college: string | null
  years_exp: number | null
  status: string | null
  injury_status: string | null
  injury_body_part: string | null
  injury_start_date: string | null
  depth_chart_position: string | null
  depth_chart_order: number | null
  search_rank: number | null
  espn_id: string | null
  yahoo_id: string | null
  rotowire_id: string | null
  sportradar_id: string | null
  birth_country: string | null
  active: boolean
}

// Cache for full player data
let fullPlayerCache: Map<string, SleeperPlayerFull> | null = null
let fullCacheTimestamp: number = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Fetch all NFL players with full data from Sleeper
 */
async function fetchFullSleeperPlayers(): Promise<Map<string, SleeperPlayerFull>> {
  const now = Date.now()

  // Return cached data if still valid
  if (fullPlayerCache && now - fullCacheTimestamp < CACHE_DURATION) {
    return fullPlayerCache
  }

  const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper players: ${response.statusText}`)
  }

  const data = await response.json()
  fullPlayerCache = new Map()

  for (const [playerId, player] of Object.entries(data)) {
    const p = player as Record<string, unknown>
    fullPlayerCache.set(playerId, {
      player_id: (p.player_id as string) || playerId,
      first_name: (p.first_name as string) || '',
      last_name: (p.last_name as string) || '',
      full_name: (p.full_name as string) || `${p.first_name} ${p.last_name}`,
      position: (p.position as string) || 'UNK',
      team: (p.team as string) || null,
      number: (p.number as number) ?? null,
      height: (p.height as string) || null,
      weight: (p.weight as string) || null,
      age: (p.age as number) ?? null,
      college: (p.college as string) || null,
      years_exp: (p.years_exp as number) ?? null,
      status: (p.status as string) || null,
      injury_status: (p.injury_status as string) || null,
      injury_body_part: (p.injury_body_part as string) || null,
      injury_start_date: (p.injury_start_date as string) || null,
      depth_chart_position: (p.depth_chart_position as string) || null,
      depth_chart_order: (p.depth_chart_order as number) ?? null,
      search_rank: (p.search_rank as number) ?? null,
      espn_id: (p.espn_id as string) || null,
      yahoo_id: (p.yahoo_id as string) || null,
      rotowire_id: (p.rotowire_id as string) || null,
      sportradar_id: (p.sportradar_id as string) || null,
      birth_country: (p.birth_country as string) || null,
      active: (p.active as boolean) ?? true,
    })
  }

  fullCacheTimestamp = now
  return fullPlayerCache
}

/**
 * Hook to fetch a single player's full data from Sleeper
 */
export function useSleeperPlayer(sleeperId: string | null | undefined) {
  const [player, setPlayer] = useState<SleeperPlayerFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sleeperId) {
      setPlayer(null)
      return
    }

    async function fetchPlayer(id: string) {
      setLoading(true)
      setError(null)

      try {
        const players = await fetchFullSleeperPlayers()
        const found = players.get(id)
        setPlayer(found || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch player')
        setPlayer(null)
      } finally {
        setLoading(false)
      }
    }

    fetchPlayer(sleeperId)
  }, [sleeperId])

  return { player, loading, error }
}

/**
 * Format height from inches to feet/inches display
 * Sleeper returns height as a string like "74" (inches)
 */
export function formatHeight(height: string | null): string {
  if (!height) return '—'
  const inches = parseInt(height, 10)
  if (isNaN(inches)) return height
  const feet = Math.floor(inches / 12)
  const remainingInches = inches % 12
  return `${feet}'${remainingInches}"`
}

/**
 * Format weight with "lbs" suffix
 */
export function formatWeight(weight: string | null): string {
  if (!weight) return '—'
  return `${weight} lbs`
}

/**
 * Format years of experience
 */
export function formatExperience(yearsExp: number | null): string {
  if (yearsExp === null || yearsExp === undefined) return '—'
  if (yearsExp === 0) return 'Rookie'
  if (yearsExp === 1) return '2nd year'
  if (yearsExp === 2) return '3rd year'
  return `${yearsExp + 1}th year`
}

/**
 * Get NFL team full name from abbreviation
 */
export const NFL_TEAMS: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAC: 'Jacksonville Jaguars',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  LV: 'Las Vegas Raiders',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
}

export function getTeamFullName(abbr: string | null): string {
  if (!abbr) return 'Free Agent'
  return NFL_TEAMS[abbr] || abbr
}
