// Supabase Storage for player headshots (cached from Sleeper CDN)
const SUPABASE_STORAGE = 'https://ljwzxhtsbsarqwvclckm.supabase.co/storage/v1/object/public/headshots'

export function getPlayerHeadshotUrl(playerId: string): string {
  // For team defenses (e.g., "BUF_DEF"), use team logo
  if (playerId.endsWith('_DEF')) {
    return `${SUPABASE_STORAGE}/${playerId}.png`
  }
  return `${SUPABASE_STORAGE}/${playerId}.jpg`
}

export function getTeamLogoUrl(teamId: string): string {
  return `${SUPABASE_STORAGE}/${teamId}_DEF.png`
}

// Fallback placeholder for when image fails to load
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#1e293b" width="100" height="100"/>
    <text x="50" y="55" font-family="system-ui" font-size="40" fill="#475569" text-anchor="middle">?</text>
  </svg>
`)
