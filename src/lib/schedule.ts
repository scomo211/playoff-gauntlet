// NFL Playoff Schedule 2025-2026 Season
// Game times are in Eastern Time (ET), stored as UTC
// Source: https://www.cbssports.com/nfl/news/2026-nfl-playoff-schedule-dates-times-tv-wild-card-to-super-bowl/

export type GameStatus = 'upcoming' | 'live' | 'final'

export interface Game {
  week_id: number
  home_team_id: string
  away_team_id: string
  kickoff: string  // ISO timestamp in UTC
}

// 2025-2026 NFL Playoff Schedule
// Wild Card: Jan 10-12, 2026
// Divisional: Jan 17-18, 2026
// Conference Championships: Jan 25, 2026
// Super Bowl LX: Feb 8, 2026 at Levi's Stadium, Santa Clara
//
// First-round byes: Denver Broncos (AFC #1), Seattle Seahawks (NFC #1)

export const PLAYOFF_SCHEDULE: Game[] = [
  // Week 1: Wild Card Weekend (Jan 10-12, 2026)
  // Saturday Jan 10
  { week_id: 1, away_team_id: 'LAR', home_team_id: 'CAR', kickoff: '2026-01-10T21:30:00Z' }, // 4:30pm ET
  { week_id: 1, away_team_id: 'GB', home_team_id: 'CHI', kickoff: '2026-01-11T00:00:00Z' },  // 7:00pm ET Sat (adjusted for final)
  // Sunday Jan 11
  { week_id: 1, away_team_id: 'BUF', home_team_id: 'JAX', kickoff: '2026-01-11T14:30:00Z' }, // adjusted for final
  { week_id: 1, away_team_id: 'SF', home_team_id: 'PHI', kickoff: '2026-01-11T17:00:00Z' },  // adjusted for final
  { week_id: 1, away_team_id: 'LAC', home_team_id: 'NE', kickoff: '2026-01-11T20:30:00Z' },  // adjusted for final
  // Monday Jan 12
  { week_id: 1, away_team_id: 'HOU', home_team_id: 'PIT', kickoff: '2026-01-13T01:15:00Z' }, // 8:15pm ET Mon

  // Week 2: Divisional Round (Jan 17-18, 2026)
  // Saturday Jan 17
  { week_id: 2, away_team_id: 'BUF', home_team_id: 'DEN', kickoff: '2026-01-17T21:30:00Z' }, // 4:30pm ET - Bills @ Broncos
  { week_id: 2, away_team_id: 'SF', home_team_id: 'SEA', kickoff: '2026-01-18T01:00:00Z' },  // 8:00pm ET Sat - 49ers @ Seahawks
  // Sunday Jan 18
  { week_id: 2, away_team_id: 'HOU', home_team_id: 'NE', kickoff: '2026-01-18T20:00:00Z' },  // 3:00pm ET - Texans @ Patriots
  { week_id: 2, away_team_id: 'LAR', home_team_id: 'CHI', kickoff: '2026-01-18T23:30:00Z' }, // 6:30pm ET - Rams @ Bears

  // Week 3: Conference Championships (Jan 25, 2026)
  { week_id: 3, away_team_id: 'NE', home_team_id: 'DEN', kickoff: '2026-01-25T20:00:00Z' }, // 3:00pm ET - AFC: Patriots @ Broncos
  { week_id: 3, away_team_id: 'LAR', home_team_id: 'SEA', kickoff: '2026-01-25T23:30:00Z' }, // 6:30pm ET - NFC: Rams @ Seahawks

  // Week 4: Super Bowl LX (Feb 8, 2026) - Levi's Stadium, Santa Clara
  // NE (AFC Champion) vs SEA (NFC Champion, higher seed = home)
  { week_id: 4, away_team_id: 'NE', home_team_id: 'SEA', kickoff: '2026-02-08T23:30:00Z' }, // 6:30pm ET
]

// Get the game for a team in a specific week
export function getGameForTeam(teamId: string, weekId: number): Game | null {
  return PLAYOFF_SCHEDULE.find(
    g => g.week_id === weekId && (g.home_team_id === teamId || g.away_team_id === teamId)
  ) || null
}

// Determine the status of a game
// Playoff games often run longer - use 4.5 hours to be safe
const GAME_DURATION_MS = 4.5 * 60 * 60 * 1000

// Weeks that are fully complete - all games final
const COMPLETED_WEEKS = [1, 2, 3, 4]

export function getGameStatus(game: Game | null, weekId?: number): GameStatus {
  if (!game) return 'upcoming'

  // If the week is marked as complete, all games are final
  if (weekId && COMPLETED_WEEKS.includes(weekId)) {
    return 'final'
  }

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
  return getGameStatus(game, weekId)
}

// Check if a team has a bye week
export function isTeamOnBye(_teamId: string, weekId: number, playoffSeed: number | null): boolean {
  // Week 1: Seed 1 in each conference has a bye
  if (weekId === 1 && playoffSeed === 1) {
    return true
  }
  return false
}
