import { supabase } from './supabase'

export interface CachedProjection {
  player_name: string
  team_id: string
  week_id: number
  fantasy_points: number
}

export async function fetchProjections(weekId: number): Promise<CachedProjection[]> {
  try {
    const { data, error } = await supabase
      .from('projections')
      .select('player_name, team_id, week_id, fantasy_points')
      .eq('week_id', weekId)

    if (error) {
      console.error('Failed to fetch projections from cache:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch projections:', error)
    return []
  }
}

// Create a lookup key from player name and team
export function createPlayerKey(name: string, teamId: string): string {
  // Normalize name: lowercase, remove periods, extra spaces, and common suffixes
  let normalizedName = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  // Remove common suffixes (jr, sr, ii, iii, iv, v) to match projection names
  normalizedName = normalizedName.replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
  return `${normalizedName}|${teamId.toUpperCase()}`
}

// Build projection map keyed by "name|team"
export function buildProjectionMap(projections: CachedProjection[]): Map<string, number> {
  const map = new Map<string, number>()

  for (const proj of projections) {
    const key = `${proj.player_name}|${proj.team_id.toUpperCase()}`
    map.set(key, proj.fantasy_points)
  }

  return map
}
