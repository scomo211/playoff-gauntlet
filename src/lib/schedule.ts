// NFL Playoff Schedule 2025-2026 Season
// Game times are in Eastern Time (ET)

export type GameStatus = 'upcoming' | 'live' | 'final'

export interface Game {
  week_id: number
  home_team_id: string
  away_team_id: string
  kickoff: string  // ISO timestamp in ET
}

// 2025-2026 NFL Playoff Schedule
// Wild Card: Jan 11-13, 2026
// Divisional: Jan 18-19, 2026
// Championship: Jan 26, 2026
// Super Bowl: Feb 9, 2026
export const PLAYOFF_SCHEDULE: Game[] = [
  // Week 1: Wild Card Weekend (Jan 10-13, 2026)
  // Saturday Jan 10 (ET = UTC-5)
  { week_id: 1, away_team_id: 'LAR', home_team_id: 'CAR', kickoff: '2026-01-10T21:30:00Z' }, // 4:30pm ET - FINAL
  { week_id: 1, away_team_id: 'GB', home_team_id: 'CHI', kickoff: '2026-01-11T01:00:00Z' },  // 8:00pm ET Sat
  // Sunday Jan 11
  { week_id: 1, away_team_id: 'DEN', home_team_id: 'BUF', kickoff: '2026-01-11T18:00:00Z' }, // 1:00pm ET
  { week_id: 1, away_team_id: 'PIT', home_team_id: 'BAL', kickoff: '2026-01-11T21:30:00Z' }, // 4:30pm ET
  { week_id: 1, away_team_id: 'LAC', home_team_id: 'HOU', kickoff: '2026-01-12T01:00:00Z' }, // 8:00pm ET
  // Monday Jan 12
  { week_id: 1, away_team_id: 'WAS', home_team_id: 'TB', kickoff: '2026-01-12T18:00:00Z' },  // 1:00pm ET
  { week_id: 1, away_team_id: 'MIN', home_team_id: 'DET', kickoff: '2026-01-13T01:15:00Z' }, // 8:15pm ET Mon
]

// Get the game for a team in a specific week
export function getGameForTeam(teamId: string, weekId: number): Game | null {
  return PLAYOFF_SCHEDULE.find(
    g => g.week_id === weekId && (g.home_team_id === teamId || g.away_team_id === teamId)
  ) || null
}

// Determine the status of a game
// Average NFL game is ~3 hours 12 minutes, we'll use 3.5 hours to be safe
const GAME_DURATION_MS = 3.5 * 60 * 60 * 1000

export function getGameStatus(game: Game | null): GameStatus {
  if (!game) return 'upcoming'

  const now = new Date()
  const kickoff = new Date(game.kickoff)
  const estimatedEnd = new Date(kickoff.getTime() + GAME_DURATION_MS)

  if (now < kickoff) {
    return 'upcoming'
  } else if (now > estimatedEnd) {
    return 'final'
  } else {
    return 'live'
  }
}

// Get game status for a specific team in a week
export function getTeamGameStatus(teamId: string | undefined, weekId: number): GameStatus {
  if (!teamId) return 'upcoming'
  const game = getGameForTeam(teamId, weekId)
  return getGameStatus(game)
}

// Check if a team has a bye week
export function isTeamOnBye(_teamId: string, weekId: number, playoffSeed: number | null): boolean {
  // Week 1: Seed 1 in each conference has a bye
  if (weekId === 1 && playoffSeed === 1) {
    return true
  }
  return false
}
