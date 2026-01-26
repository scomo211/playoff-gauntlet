import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Team } from '../types/database'

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

interface BracketTeam {
  team: Team | null
  seed: number | null
}

interface Matchup {
  top: BracketTeam
  bottom: BracketTeam
  winner?: Team | null
}

interface PlayoffBracketProps {
  onTeamClick?: (team: Team) => void
}

// Hardcoded historical results for when both teams are eliminated
// Format: { wcWinners: [seeds that won], divWinners: [seeds that won], champWinner: seed }
const HISTORICAL_RESULTS = {
  AFC: {
    wcWinners: [2, 3, 5], // NE beat LAC, JAX beat BUF, HOU beat PIT
    divWinners: [1, 2],   // DEN beat HOU, NE beat JAX
    champWinner: 2,       // NE beat DEN
  },
  NFC: {
    wcWinners: [2, 5, 6], // CHI beat GB, LAR beat CAR, SF beat PHI
    divWinners: [1, 5],   // SEA beat SF, LAR beat CHI
    champWinner: 1,       // SEA beat LAR
  }
}

export default function PlayoffBracket({ onTeamClick }: PlayoffBracketProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .order('conference', { ascending: true })
        .order('playoff_seed', { ascending: true })

      if (data) setTeams(data)
      setLoading(false)
    }
    fetchTeams()
  }, [])

  // Get team by conference and seed
  const getTeam = (conference: 'AFC' | 'NFC', seed: number): Team | undefined => {
    return teams.find(t => t.conference === conference && t.playoff_seed === seed)
  }

  // Determine winner of a matchup based on eliminations or historical data
  const getWinner = (team1: Team | null, team2: Team | null, conference?: 'AFC' | 'NFC', round?: 'wc' | 'div'): Team | null => {
    if (!team1 && !team2) return null
    if (!team1) return team2?.is_alive ? team2 : null
    if (!team2) return team1?.is_alive ? team1 : null

    // If one is eliminated and other is alive, the alive team won
    if (!team1.is_alive && team2.is_alive) return team2
    if (team1.is_alive && !team2.is_alive) return team1

    // Both eliminated - use historical data
    if (!team1.is_alive && !team2.is_alive && conference && round) {
      const history = HISTORICAL_RESULTS[conference]
      const winnerSeeds = round === 'wc' ? history.wcWinners : history.divWinners
      if (winnerSeeds.includes(team1.playoff_seed || 0)) return team1
      if (winnerSeeds.includes(team2.playoff_seed || 0)) return team2
    }

    // If both alive (current matchup), no winner yet
    return null
  }

  // Wild Card matchups (2v7, 3v6, 4v5)
  const getWildCardMatchups = (conference: 'AFC' | 'NFC'): Matchup[] => {
    const matchups = [
      {
        top: { team: getTeam(conference, 2) || null, seed: 2 },
        bottom: { team: getTeam(conference, 7) || null, seed: 7 },
      },
      {
        top: { team: getTeam(conference, 3) || null, seed: 3 },
        bottom: { team: getTeam(conference, 6) || null, seed: 6 },
      },
      {
        top: { team: getTeam(conference, 4) || null, seed: 4 },
        bottom: { team: getTeam(conference, 5) || null, seed: 5 },
      },
    ]

    // Add winners - use historical data for eliminated matchups
    return matchups.map(m => ({
      ...m,
      winner: getWinner(m.top.team, m.bottom.team, conference, 'wc')
    }))
  }

  // Get divisional matchups with reseeding
  const getDivisionalMatchups = (conference: 'AFC' | 'NFC'): { top: Matchup; bottom: Matchup } => {
    const seed1 = getTeam(conference, 1)
    const wcMatchups = getWildCardMatchups(conference)

    // Get wild card winners with their seeds
    const wcWinners: { team: Team; seed: number }[] = []
    wcMatchups.forEach(m => {
      if (m.winner) {
        wcWinners.push({ team: m.winner, seed: m.winner.playoff_seed || 0 })
      }
    })

    // Sort by seed (lowest seed number = highest seed)
    wcWinners.sort((a, b) => a.seed - b.seed)

    // 1 seed plays lowest remaining seed (highest seed number)
    // Other two winners play each other
    const lowestSeedWinner = wcWinners.length > 0 ? wcWinners[wcWinners.length - 1] : null
    const otherWinners = wcWinners.slice(0, -1)

    // Top matchup: 1 seed vs lowest remaining seed
    const topMatchup: Matchup = {
      top: { team: seed1 || null, seed: 1 },
      bottom: { team: lowestSeedWinner?.team || null, seed: lowestSeedWinner?.seed || null },
      winner: seed1 && lowestSeedWinner ? getWinner(seed1, lowestSeedWinner.team, conference, 'div') : null
    }

    // Bottom matchup: other two winners (higher seed on top)
    const bottomMatchup: Matchup = {
      top: { team: otherWinners[0]?.team || null, seed: otherWinners[0]?.seed || null },
      bottom: { team: otherWinners[1]?.team || null, seed: otherWinners[1]?.seed || null },
      winner: otherWinners.length === 2 ? getWinner(otherWinners[0].team, otherWinners[1].team, conference, 'div') : null
    }

    return { top: topMatchup, bottom: bottomMatchup }
  }

  // Get conference championship matchup
  const getChampionshipMatchup = (conference: 'AFC' | 'NFC'): Matchup => {
    const divMatchups = getDivisionalMatchups(conference)

    // Winners of divisional round with their seeds
    const divWinners: { team: Team; seed: number }[] = []
    if (divMatchups.top.winner) {
      divWinners.push({ team: divMatchups.top.winner, seed: divMatchups.top.winner.playoff_seed || 0 })
    }
    if (divMatchups.bottom.winner) {
      divWinners.push({ team: divMatchups.bottom.winner, seed: divMatchups.bottom.winner.playoff_seed || 0 })
    }

    // Sort by seed
    divWinners.sort((a, b) => a.seed - b.seed)

    // Determine championship winner using historical data or is_alive
    let champWinner: Team | null = null
    if (divWinners.length === 2) {
      const team1 = divWinners[0].team
      const team2 = divWinners[1].team
      // Check if one is eliminated (historical result)
      if (team1.is_alive && !team2.is_alive) champWinner = team1
      else if (!team1.is_alive && team2.is_alive) champWinner = team2
      // If both eliminated or both alive, use historical champWinner
      else {
        const history = HISTORICAL_RESULTS[conference]
        if (history.champWinner) {
          champWinner = divWinners.find(w => w.seed === history.champWinner)?.team || null
        }
      }
    }

    return {
      top: { team: divWinners[0]?.team || null, seed: divWinners[0]?.seed || null },
      bottom: { team: divWinners[1]?.team || null, seed: divWinners[1]?.seed || null },
      winner: champWinner
    }
  }

  // Get Super Bowl matchup
  const getSuperBowlMatchup = (): Matchup => {
    const afcChamp = getChampionshipMatchup('AFC')
    const nfcChamp = getChampionshipMatchup('NFC')

    return {
      top: { team: afcChamp.winner || null, seed: afcChamp.winner?.playoff_seed || null },
      bottom: { team: nfcChamp.winner || null, seed: nfcChamp.winner?.playoff_seed || null },
      winner: afcChamp.winner && nfcChamp.winner ? getWinner(afcChamp.winner, nfcChamp.winner) : null
    }
  }

  // Team slot component
  const TeamSlot = ({ team, seed, isEliminated, compact = false }: {
    team: Team | null
    seed: number | null
    isEliminated?: boolean
    compact?: boolean
  }) => {
    const eliminated = isEliminated ?? (team ? !team.is_alive : false)
    const clickable = team && onTeamClick

    if (!team) {
      return (
        <div className={`flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700 ${compact ? 'min-w-[120px]' : 'min-w-[140px]'}`}>
          <div className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded bg-slate-700 flex items-center justify-center`}>
            <span className="text-slate-500 text-xs">?</span>
          </div>
          <span className="text-slate-500 text-sm">TBD</span>
        </div>
      )
    }

    return (
      <button
        onClick={() => clickable && onTeamClick(team)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all ${
          eliminated
            ? 'bg-slate-800/30 border-slate-700/50 opacity-50'
            : 'bg-slate-800 border-slate-600 hover:border-field-500 hover:bg-slate-700'
        } ${compact ? 'min-w-[120px]' : 'min-w-[140px]'} ${clickable ? 'cursor-pointer' : ''}`}
      >
        {seed && (
          <span className={`text-xs font-bold ${eliminated ? 'text-slate-600' : 'text-slate-400'}`}>
            {seed}
          </span>
        )}
        <img
          src={getTeamLogoUrl(team.id)}
          alt={team.name}
          className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} object-contain ${eliminated ? 'grayscale' : ''}`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className={`text-sm font-medium truncate ${eliminated ? 'text-slate-500 line-through' : 'text-white'}`}>
            {team.name}
          </span>
        </div>
        {eliminated && (
          <span className="ml-auto text-[10px] text-red-400 font-medium">OUT</span>
        )}
      </button>
    )
  }

  // Matchup component with connector line
  const MatchupBlock = ({ matchup, showConnector = true }: { matchup: Matchup; showConnector?: boolean }) => (
    <div className="flex items-center">
      <div className="flex flex-col gap-1">
        <TeamSlot team={matchup.top.team} seed={matchup.top.seed} />
        <TeamSlot team={matchup.bottom.team} seed={matchup.bottom.seed} />
      </div>
      {showConnector && (
        <div className="w-4 h-8 border-r-2 border-t-2 border-b-2 border-slate-600 rounded-r ml-1" />
      )}
    </div>
  )

  // Mobile: Single team row (for bye teams)
  const MobileTeamRow = ({ team, seed, badge }: { team: Team | null; seed: number; badge?: string }) => {
    const eliminated = team ? !team.is_alive : false
    const clickable = team && onTeamClick

    return (
      <button
        onClick={() => clickable && onTeamClick(team)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          eliminated ? 'bg-slate-800/20' : 'bg-slate-800/40 hover:bg-slate-800/60 hover:ring-1 hover:ring-field-500/50'
        } ${clickable ? 'cursor-pointer' : ''}`}
      >
        <span className={`text-xs font-bold w-4 ${eliminated ? 'text-slate-600' : 'text-slate-400'}`}>
          {seed}
        </span>
        {team ? (
          <>
            <img
              src={getTeamLogoUrl(team.id)}
              alt={team.name}
              className={`w-6 h-6 object-contain ${eliminated ? 'grayscale opacity-50' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className={`text-sm font-medium flex-1 text-left ${eliminated ? 'text-slate-500 line-through' : 'text-white'}`}>
              {team.city} {team.name}
            </span>
          </>
        ) : (
          <span className="text-sm text-slate-500 flex-1 text-left">TBD</span>
        )}
        {badge && !eliminated && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
            {badge}
          </span>
        )}
        {eliminated && (
          <span className="text-[10px] font-medium text-red-400">OUT</span>
        )}
      </button>
    )
  }

  // Mobile: Matchup row (two teams side by side)
  const MobileMatchupRow = ({ matchup }: { matchup: Matchup }) => {
    const topEliminated = matchup.top.team ? !matchup.top.team.is_alive : false
    const bottomEliminated = matchup.bottom.team ? !matchup.bottom.team.is_alive : false

    const MobileTeamCell = ({ team, seed, eliminated }: { team: Team | null; seed: number | null; eliminated: boolean }) => {
      const clickable = team && onTeamClick
      return (
        <button
          onClick={() => clickable && onTeamClick(team)}
          className={`flex items-center gap-1.5 flex-1 min-w-0 px-1 py-0.5 rounded transition-all ${
            eliminated ? 'opacity-50' : clickable ? 'hover:bg-slate-700/50' : ''
          } ${clickable ? 'cursor-pointer' : ''}`}
        >
          <span className={`text-[10px] font-bold w-3 ${eliminated ? 'text-slate-600' : 'text-slate-500'}`}>
            {seed}
          </span>
          {team ? (
            <>
              <img
                src={getTeamLogoUrl(team.id)}
                alt={team.name}
                className={`w-5 h-5 object-contain flex-shrink-0 ${eliminated ? 'grayscale' : ''}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className={`text-xs font-medium truncate ${eliminated ? 'text-slate-500 line-through' : 'text-white'}`}>
                {team.name}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-500">TBD</span>
          )}
          {eliminated && (
            <span className="text-[9px] text-red-400 ml-auto flex-shrink-0">OUT</span>
          )}
        </button>
      )
    }

    return (
      <div className="flex items-center gap-1 px-1 py-1 rounded-lg bg-slate-800/30">
        <MobileTeamCell team={matchup.top.team} seed={matchup.top.seed} eliminated={topEliminated} />
        <span className="text-[10px] text-slate-600 font-medium flex-shrink-0">@</span>
        <MobileTeamCell team={matchup.bottom.team} seed={matchup.bottom.seed} eliminated={bottomEliminated} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card-solid p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Playoff Bracket</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  const afcWildCard = getWildCardMatchups('AFC')
  const nfcWildCard = getWildCardMatchups('NFC')
  const afcDivisional = getDivisionalMatchups('AFC')
  const nfcDivisional = getDivisionalMatchups('NFC')
  const afcChampionship = getChampionshipMatchup('AFC')
  const nfcChampionship = getChampionshipMatchup('NFC')
  const superBowl = getSuperBowlMatchup()

  // Helper to render a team slot or TBD placeholder
  const TeamOrTBD = ({ team, seed, label }: { team: Team | null; seed: number | null; label?: string }) => {
    if (team) {
      return <TeamSlot team={team} seed={seed} />
    }
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
        <span className="text-slate-500 text-sm">{label || 'TBD'}</span>
      </div>
    )
  }

  return (
    <div className="mb-8 overflow-x-auto">
      <h2 className="text-lg font-bold text-white mb-6">Playoff Bracket</h2>

      {/* Desktop Bracket */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-center gap-4 min-w-[1000px]">
          {/* AFC Side */}
          <div className="flex items-center gap-3">
            {/* AFC Wild Card */}
            <div className="flex flex-col gap-6">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Wild Card</div>
              {afcWildCard.map((matchup, i) => (
                <MatchupBlock key={`afc-wc-${i}`} matchup={matchup} />
              ))}
            </div>

            {/* AFC Divisional */}
            <div className="flex flex-col gap-16 items-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Divisional</div>
              {/* 1 seed vs lowest wild card winner */}
              <div className="flex items-center">
                <div className="flex flex-col gap-1">
                  <TeamOrTBD team={afcDivisional.top.top.team} seed={afcDivisional.top.top.seed} />
                  <TeamOrTBD team={afcDivisional.top.bottom.team} seed={afcDivisional.top.bottom.seed} label="WC Winner" />
                </div>
                <div className="w-4 h-8 border-r-2 border-t-2 border-b-2 border-slate-600 rounded-r ml-1" />
              </div>
              {/* Other divisional matchup */}
              <div className="flex items-center">
                <div className="flex flex-col gap-1">
                  <TeamOrTBD team={afcDivisional.bottom.top.team} seed={afcDivisional.bottom.top.seed} label="WC Winner" />
                  <TeamOrTBD team={afcDivisional.bottom.bottom.team} seed={afcDivisional.bottom.bottom.seed} label="WC Winner" />
                </div>
                <div className="w-4 h-8 border-r-2 border-t-2 border-b-2 border-slate-600 rounded-r ml-1" />
              </div>
            </div>

            {/* AFC Championship */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">AFC Champ</div>
              <div className="flex flex-col gap-1 mt-16">
                <TeamOrTBD team={afcChampionship.top.team} seed={afcChampionship.top.seed} label="DIV Winner" />
                <TeamOrTBD team={afcChampionship.bottom.team} seed={afcChampionship.bottom.seed} label="DIV Winner" />
              </div>
            </div>
          </div>

          {/* Super Bowl */}
          <div className="flex flex-col items-center px-6">
            <div className="text-center text-xs font-medium text-gold-400 uppercase tracking-wider mb-4">Super Bowl</div>
            <div className="bg-gradient-to-b from-gold-500/20 to-gold-600/10 border-2 border-gold-500/30 rounded-xl p-4 min-w-[160px]">
              <div className="flex flex-col gap-2">
                {superBowl.top.team ? (
                  <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                    <span className="text-xs font-bold text-red-400">AFC</span>
                    <img src={getTeamLogoUrl(superBowl.top.team.id)} alt={superBowl.top.team.name} className="w-6 h-6 object-contain" />
                    <span className="text-sm font-medium text-white">{superBowl.top.team.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                    <span className="text-slate-500 text-sm">AFC Champion</span>
                  </div>
                )}
                <div className="text-center text-gold-400 font-bold text-xs">VS</div>
                {superBowl.bottom.team ? (
                  <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                    <span className="text-xs font-bold text-blue-400">NFC</span>
                    <img src={getTeamLogoUrl(superBowl.bottom.team.id)} alt={superBowl.bottom.team.name} className="w-6 h-6 object-contain" />
                    <span className="text-sm font-medium text-white">{superBowl.bottom.team.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                    <span className="text-slate-500 text-sm">NFC Champion</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NFC Side (mirrored) */}
          <div className="flex items-center gap-3 flex-row-reverse">
            {/* NFC Wild Card */}
            <div className="flex flex-col gap-6">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Wild Card</div>
              {nfcWildCard.map((matchup, i) => (
                <div key={`nfc-wc-${i}`} className="flex items-center flex-row-reverse">
                  <div className="flex flex-col gap-1">
                    <TeamSlot team={matchup.top.team} seed={matchup.top.seed} />
                    <TeamSlot team={matchup.bottom.team} seed={matchup.bottom.seed} />
                  </div>
                  <div className="w-4 h-8 border-l-2 border-t-2 border-b-2 border-slate-600 rounded-l mr-1" />
                </div>
              ))}
            </div>

            {/* NFC Divisional */}
            <div className="flex flex-col gap-16 items-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Divisional</div>
              <div className="flex items-center flex-row-reverse">
                <div className="flex flex-col gap-1">
                  <TeamOrTBD team={nfcDivisional.top.top.team} seed={nfcDivisional.top.top.seed} />
                  <TeamOrTBD team={nfcDivisional.top.bottom.team} seed={nfcDivisional.top.bottom.seed} label="WC Winner" />
                </div>
                <div className="w-4 h-8 border-l-2 border-t-2 border-b-2 border-slate-600 rounded-l mr-1" />
              </div>
              <div className="flex items-center flex-row-reverse">
                <div className="flex flex-col gap-1">
                  <TeamOrTBD team={nfcDivisional.bottom.top.team} seed={nfcDivisional.bottom.top.seed} label="WC Winner" />
                  <TeamOrTBD team={nfcDivisional.bottom.bottom.team} seed={nfcDivisional.bottom.bottom.seed} label="WC Winner" />
                </div>
                <div className="w-4 h-8 border-l-2 border-t-2 border-b-2 border-slate-600 rounded-l mr-1" />
              </div>
            </div>

            {/* NFC Championship */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">NFC Champ</div>
              <div className="flex flex-col gap-1 mt-16">
                <TeamOrTBD team={nfcChampionship.top.team} seed={nfcChampionship.top.seed} label="DIV Winner" />
                <TeamOrTBD team={nfcChampionship.bottom.team} seed={nfcChampionship.bottom.seed} label="DIV Winner" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Bracket - Compact View */}
      <div className="lg:hidden">
        {/* AFC Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">AFC</div>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          {/* AFC 1 Seed (Bye) */}
          <MobileTeamRow team={afcDivisional.top.top.team || null} seed={1} badge="BYE" />

          {/* AFC Wild Card Games */}
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-2 mb-1">Wild Card</div>
          <div className="space-y-1">
            {afcWildCard.map((matchup, i) => (
              <MobileMatchupRow key={`afc-m-wc-${i}`} matchup={matchup} />
            ))}
          </div>

          {/* AFC Divisional - show if we have winners */}
          {(afcDivisional.top.bottom.team || afcDivisional.bottom.top.team) && (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-3 mb-1">Divisional</div>
              <div className="space-y-1">
                {afcDivisional.top.bottom.team && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                    <span className="text-slate-500">1</span>
                    <span className="text-white">{afcDivisional.top.top.team?.name}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-slate-500">{afcDivisional.top.bottom.seed}</span>
                    <span className="text-white">{afcDivisional.top.bottom.team?.name}</span>
                  </div>
                )}
                {afcDivisional.bottom.top.team && afcDivisional.bottom.bottom.team && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                    <span className="text-slate-500">{afcDivisional.bottom.top.seed}</span>
                    <span className="text-white">{afcDivisional.bottom.top.team?.name}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-slate-500">{afcDivisional.bottom.bottom.seed}</span>
                    <span className="text-white">{afcDivisional.bottom.bottom.team?.name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* AFC Championship - show if we have divisional winners */}
          {afcChampionship.top.team && afcChampionship.bottom.team && (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-3 mb-1">AFC Championship</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                <span className="text-slate-500">{afcChampionship.top.seed}</span>
                <span className="text-white">{afcChampionship.top.team?.name}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-slate-500">{afcChampionship.bottom.seed}</span>
                <span className="text-white">{afcChampionship.bottom.team?.name}</span>
              </div>
            </>
          )}
        </div>

        {/* NFC Section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">NFC</div>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          {/* NFC 1 Seed (Bye) */}
          <MobileTeamRow team={nfcDivisional.top.top.team || null} seed={1} badge="BYE" />

          {/* NFC Wild Card Games */}
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-2 mb-1">Wild Card</div>
          <div className="space-y-1">
            {nfcWildCard.map((matchup, i) => (
              <MobileMatchupRow key={`nfc-m-wc-${i}`} matchup={matchup} />
            ))}
          </div>

          {/* NFC Divisional - show if we have winners */}
          {(nfcDivisional.top.bottom.team || nfcDivisional.bottom.top.team) && (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-3 mb-1">Divisional</div>
              <div className="space-y-1">
                {nfcDivisional.top.bottom.team && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                    <span className="text-slate-500">1</span>
                    <span className="text-white">{nfcDivisional.top.top.team?.name}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-slate-500">{nfcDivisional.top.bottom.seed}</span>
                    <span className="text-white">{nfcDivisional.top.bottom.team?.name}</span>
                  </div>
                )}
                {nfcDivisional.bottom.top.team && nfcDivisional.bottom.bottom.team && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                    <span className="text-slate-500">{nfcDivisional.bottom.top.seed}</span>
                    <span className="text-white">{nfcDivisional.bottom.top.team?.name}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-slate-500">{nfcDivisional.bottom.bottom.seed}</span>
                    <span className="text-white">{nfcDivisional.bottom.bottom.team?.name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* NFC Championship - show if we have divisional winners */}
          {nfcChampionship.top.team && nfcChampionship.bottom.team && (
            <>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-3 mb-1">NFC Championship</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/30 text-xs">
                <span className="text-slate-500">{nfcChampionship.top.seed}</span>
                <span className="text-white">{nfcChampionship.top.team?.name}</span>
                <span className="text-slate-600">vs</span>
                <span className="text-slate-500">{nfcChampionship.bottom.seed}</span>
                <span className="text-white">{nfcChampionship.bottom.team?.name}</span>
              </div>
            </>
          )}
        </div>

        {/* Super Bowl - show if we have conference champions */}
        {superBowl.top.team && superBowl.bottom.team && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold text-gold-400 uppercase tracking-wider">Super Bowl</div>
              <div className="flex-1 h-px bg-gold-500/30"></div>
            </div>
            <div className="flex items-center justify-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-gold-500/20 via-gold-600/10 to-gold-500/20 border border-gold-500/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-400">AFC</span>
                <img src={getTeamLogoUrl(superBowl.top.team.id)} alt={superBowl.top.team.name} className="w-6 h-6 object-contain" />
                <span className="text-sm font-medium text-white">{superBowl.top.team.name}</span>
              </div>
              <span className="text-gold-400 font-bold text-xs">VS</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400">NFC</span>
                <img src={getTeamLogoUrl(superBowl.bottom.team.id)} alt={superBowl.bottom.team.name} className="w-6 h-6 object-contain" />
                <span className="text-sm font-medium text-white">{superBowl.bottom.team.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-800 border border-slate-600"></div>
          <span>Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-800/30 border border-slate-700/50 opacity-50"></div>
          <span>Eliminated</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-800/50 border border-dashed border-slate-600"></div>
          <span>TBD</span>
        </div>
      </div>
    </div>
  )
}
