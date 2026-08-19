import {
  SleeperUser,
  SleeperRoster,
  SleeperPlayer,
  OWNER_MAPPING,
} from '../types/salarycap'

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'
const LEAGUE_ID = '1257102944021520384'

// Cache for player data (it's a large file)
let playerCache: Map<string, SleeperPlayer> | null = null
let playerCacheTimestamp: number = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Fetch all users/owners in the league
 */
export async function fetchSleeperUsers(): Promise<SleeperUser[]> {
  const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/users`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper users: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Fetch all rosters in the league
 */
export async function fetchSleeperRosters(): Promise<SleeperRoster[]> {
  const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/rosters`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper rosters: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Fetch league info
 */
export async function fetchSleeperLeague(): Promise<{
  name: string
  season: string
  total_rosters: number
  roster_positions: string[]
}> {
  const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper league: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Fetch all NFL players from Sleeper
 * Note: This is a large file (~5MB), so we cache it
 */
export async function fetchSleeperPlayers(): Promise<Map<string, SleeperPlayer>> {
  const now = Date.now()

  // Return cached data if still valid
  if (playerCache && now - playerCacheTimestamp < CACHE_DURATION) {
    return playerCache
  }

  const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper players: ${response.statusText}`)
  }

  const data = await response.json()
  playerCache = new Map()

  for (const [playerId, player] of Object.entries(data)) {
    const p = player as {
      player_id: string
      full_name: string
      first_name: string
      last_name: string
      position: string
      team: string | null
      active: boolean
    }
    playerCache.set(playerId, {
      player_id: p.player_id || playerId,
      full_name: p.full_name || `${p.first_name} ${p.last_name}`,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      position: p.position || 'UNK',
      team: p.team || null,
      active: p.active ?? true,
    })
  }

  playerCacheTimestamp = now
  return playerCache
}

/**
 * Get player details for a specific player ID
 */
export async function getSleeperPlayer(playerId: string): Promise<SleeperPlayer | null> {
  const players = await fetchSleeperPlayers()
  return players.get(playerId) || null
}

/**
 * Get player details for multiple player IDs
 */
export async function getSleeperPlayersBatch(playerIds: string[]): Promise<Map<string, SleeperPlayer>> {
  const players = await fetchSleeperPlayers()
  const result = new Map<string, SleeperPlayer>()

  for (const id of playerIds) {
    const player = players.get(id)
    if (player) {
      result.set(id, player)
    }
  }

  return result
}

/**
 * Get the owner name from the mapping based on Sleeper username
 */
export function getOwnerNameFromSleeper(sleeperDisplayName: string): string {
  const mapping = OWNER_MAPPING[sleeperDisplayName]
  return mapping?.owner_name || sleeperDisplayName
}

/**
 * Get the Sleeper user ID from the mapping based on username
 */
export function getSleeperUserIdFromUsername(username: string): string | null {
  const mapping = OWNER_MAPPING[username]
  return mapping?.sleeper_user_id || null
}

/**
 * Fetch complete roster data with user and player details
 */
export async function fetchCompleteRosterData(): Promise<{
  users: SleeperUser[]
  rosters: SleeperRoster[]
  players: Map<string, SleeperPlayer>
  rostersByOwner: Map<string, { user: SleeperUser; roster: SleeperRoster; players: SleeperPlayer[] }>
}> {
  // Fetch all data in parallel
  const [users, rosters, players] = await Promise.all([
    fetchSleeperUsers(),
    fetchSleeperRosters(),
    fetchSleeperPlayers(),
  ])

  // Create a map of user_id -> user
  const userMap = new Map<string, SleeperUser>()
  for (const user of users) {
    userMap.set(user.user_id, user)
  }

  // Build roster data by owner
  const rostersByOwner = new Map<string, { user: SleeperUser; roster: SleeperRoster; players: SleeperPlayer[] }>()

  for (const roster of rosters) {
    const user = userMap.get(roster.owner_id)
    if (!user) continue

    const rosterPlayers: SleeperPlayer[] = []
    for (const playerId of roster.players || []) {
      const player = players.get(playerId)
      if (player) {
        rosterPlayers.push(player)
      }
    }

    rostersByOwner.set(roster.owner_id, {
      user,
      roster,
      players: rosterPlayers,
    })
  }

  return {
    users,
    rosters,
    players,
    rostersByOwner,
  }
}

/**
 * Map Sleeper position to our position type
 */
export function mapSleeperPosition(position: string): 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | null {
  const posMap: Record<string, 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'> = {
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    K: 'K',
    DEF: 'DEF',
    // Handle some edge cases
    FB: 'RB',
  }
  return posMap[position] || null
}

/**
 * Clear the player cache (useful for forcing a refresh)
 */
export function clearSleeperCache(): void {
  playerCache = null
  playerCacheTimestamp = 0
}
