import { Team } from '../types/database'

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

  // Week 2: Divisional
  if (weekId === 2) {
    // Need to determine wild card winners
    // For now, check which teams are still alive from wild card matchups
    const wcMatchups = [
      { high: 2, low: 7 },
      { high: 3, low: 6 },
      { high: 4, low: 5 },
    ]

    // Get wild card winners (alive teams that weren't on bye)
    const wcWinners: Team[] = []
    wcMatchups.forEach(({ high, low }) => {
      const highTeam = getTeamBySeed(high)
      const lowTeam = getTeamBySeed(low)
      if (highTeam?.is_alive) wcWinners.push(highTeam)
      else if (lowTeam?.is_alive) wcWinners.push(lowTeam)
    })

    // Sort by seed (lowest number first = highest seed)
    wcWinners.sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99))

    // Seed 1 plays the lowest remaining seed (last in sorted winners)
    if (seed === 1) {
      const opponent = wcWinners[wcWinners.length - 1] || null
      if (opponent) {
        return { opponent, isHome: true, isBye: false, displayText: `vs ${getTeamAbbr(opponent)}` }
      }
      return { opponent: null, isHome: false, isBye: false, displayText: 'TBD' }
    }

    // Check if this team is one of the WC winners
    const thisTeamIndex = wcWinners.findIndex(t => t.id === team.id)
    if (thisTeamIndex === -1) {
      // Team was eliminated in wild card
      return { opponent: null, isHome: false, isBye: false, displayText: 'ELIM' }
    }

    // Lowest seed plays 1 seed
    if (thisTeamIndex === wcWinners.length - 1) {
      const seed1 = getTeamBySeed(1)
      if (seed1?.is_alive) {
        return { opponent: seed1, isHome: false, isBye: false, displayText: `at ${getTeamAbbr(seed1)}` }
      }
    }

    // Other two winners play each other
    const otherWinners = wcWinners.slice(0, -1)
    if (otherWinners.length === 2) {
      const oppIndex = otherWinners.findIndex(t => t.id !== team.id)
      if (oppIndex !== -1) {
        const opponent = otherWinners[oppIndex]
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
