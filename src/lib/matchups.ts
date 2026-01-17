import { Team } from '../types/database'
import { getGameForTeam } from './schedule'

export interface OpponentInfo {
  opponent: Team | null
  isHome: boolean // true = "vs", false = "at"
  isBye: boolean
  displayText: string // e.g., "vs BUF" or "at KC" or "BYE"
}

// Get team abbreviation (use team ID which is the abbreviation)
const getTeamAbbr = (team: Team): string => team.id

// Determine opponent for a given team in a given week
export function getOpponentInfo(
  team: Team | null,
  weekId: number,
  allTeams: Team[]
): OpponentInfo {
  if (!team) {
    return { opponent: null, isHome: false, isBye: false, displayText: '' }
  }

  // Team is eliminated
  if (!team.is_alive) {
    return { opponent: null, isHome: false, isBye: false, displayText: 'ELIM' }
  }

  const conference = team.conference
  const seed = team.playoff_seed

  // Get teams in same conference
  const confTeams = allTeams.filter(t => t.conference === conference)
  const getTeamBySeed = (s: number) => confTeams.find(t => t.playoff_seed === s)

  // Helper to find opponent and determine home/away
  const findOpponent = (opponentSeed: number | null): OpponentInfo => {
    if (opponentSeed === null) {
      return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
    }
    const opponent = getTeamBySeed(opponentSeed)
    if (!opponent || !opponent.is_alive) {
      return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
    }
    // Higher seed (lower number) is home
    const isHome = (seed || 99) < (opponentSeed || 99)
    const displayText = isHome ? `vs ${getTeamAbbr(opponent)}` : `at ${getTeamAbbr(opponent)}`
    return { opponent, isHome, isBye: false, displayText }
  }

  // Week 1: Wild Card
  if (weekId === 1) {
    // Seed 1 has bye
    if (seed === 1) {
      return { opponent: null, isHome: false, isBye: true, displayText: 'BYE' }
    }
    // Wild Card matchups: 2v7, 3v6, 4v5
    const wcMatchups: Record<number, number> = { 2: 7, 7: 2, 3: 6, 6: 3, 4: 5, 5: 4 }
    const oppSeed = wcMatchups[seed || 0]
    return findOpponent(oppSeed)
  }

  // Week 2: Divisional - Use hardcoded schedule
  if (weekId === 2) {
    const game = getGameForTeam(team.id, weekId)
    if (game) {
      const isHome = game.home_team_id === team.id
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      const opponent = allTeams.find(t => t.id === opponentId)
      if (opponent) {
        return {
          opponent,
          isHome,
          isBye: false,
          displayText: isHome ? `vs ${opponentId}` : `at ${opponentId}`
        }
      }
    }
    return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
  }

  // Week 3: Conference Championship
  if (weekId === 3) {
    // Find the two remaining alive teams in conference
    const aliveInConf = confTeams.filter(t => t.is_alive)
    if (aliveInConf.length === 2) {
      const opponent = aliveInConf.find(t => t.id !== team.id)
      if (opponent) {
        const isHome = (team.playoff_seed || 99) < (opponent.playoff_seed || 99)
        return {
          opponent,
          isHome,
          isBye: false,
          displayText: isHome ? `vs ${getTeamAbbr(opponent)}` : `at ${getTeamAbbr(opponent)}`
        }
      }
    }
    return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
  }

  // Week 4: Super Bowl
  if (weekId === 4) {
    // Find opponent from other conference
    const otherConf = conference === 'AFC' ? 'NFC' : 'AFC'
    const otherConfTeams = allTeams.filter(t => t.conference === otherConf && t.is_alive)
    if (otherConfTeams.length === 1) {
      const opponent = otherConfTeams[0]
      // Super Bowl is neutral site, but higher seed is technically "home"
      const isHome = (team.playoff_seed || 99) < (opponent.playoff_seed || 99)
      return {
        opponent,
        isHome,
        isBye: false,
        displayText: `vs ${getTeamAbbr(opponent)}`  // Always "vs" for Super Bowl (neutral site)
      }
    }
    return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
  }

  return { opponent: null, isHome: false, isBye: false, displayText: '' }
}
