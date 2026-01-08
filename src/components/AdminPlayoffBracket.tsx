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
  round: 'wildcard' | 'divisional' | 'championship' | 'superbowl'
}

interface AdminPlayoffBracketProps {
  onSelectWinner: (winner: Team, loser: Team, round: string) => Promise<void>
  onReinstate: (team: Team) => Promise<void>
}

export default function AdminPlayoffBracket({ onSelectWinner, onReinstate }: AdminPlayoffBracketProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('conference', { ascending: true })
      .order('playoff_seed', { ascending: true })

    if (data) setTeams(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTeams()

    // Subscribe to team changes
    const channel = supabase
      .channel('admin-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Get team by conference and seed
  const getTeam = (conference: 'AFC' | 'NFC', seed: number): Team | undefined => {
    return teams.find(t => t.conference === conference && t.playoff_seed === seed)
  }

  // Determine winner of a matchup based on eliminations
  const getWinner = (team1: Team | null, team2: Team | null): Team | null => {
    if (!team1 && !team2) return null
    if (!team1) return team2?.is_alive ? team2 : null
    if (!team2) return team1?.is_alive ? team1 : null
    if (!team1.is_alive && team2.is_alive) return team2
    if (team1.is_alive && !team2.is_alive) return team1
    return null
  }

  // Wild Card matchups (2v7, 3v6, 4v5)
  const getWildCardMatchups = (conference: 'AFC' | 'NFC'): Matchup[] => {
    const matchups = [
      {
        top: { team: getTeam(conference, 2) || null, seed: 2 },
        bottom: { team: getTeam(conference, 7) || null, seed: 7 },
        round: 'wildcard' as const,
      },
      {
        top: { team: getTeam(conference, 3) || null, seed: 3 },
        bottom: { team: getTeam(conference, 6) || null, seed: 6 },
        round: 'wildcard' as const,
      },
      {
        top: { team: getTeam(conference, 4) || null, seed: 4 },
        bottom: { team: getTeam(conference, 5) || null, seed: 5 },
        round: 'wildcard' as const,
      },
    ]

    return matchups.map(m => ({
      ...m,
      winner: getWinner(m.top.team, m.bottom.team)
    }))
  }

  // Get divisional matchups with reseeding
  const getDivisionalMatchups = (conference: 'AFC' | 'NFC'): { top: Matchup; bottom: Matchup } => {
    const seed1 = getTeam(conference, 1)
    const wcMatchups = getWildCardMatchups(conference)

    const wcWinners: { team: Team; seed: number }[] = []
    wcMatchups.forEach(m => {
      if (m.winner) {
        wcWinners.push({ team: m.winner, seed: m.winner.playoff_seed || 0 })
      }
    })

    wcWinners.sort((a, b) => a.seed - b.seed)

    const lowestSeedWinner = wcWinners.length > 0 ? wcWinners[wcWinners.length - 1] : null
    const otherWinners = wcWinners.slice(0, -1)

    const topMatchup: Matchup = {
      top: { team: seed1 || null, seed: 1 },
      bottom: { team: lowestSeedWinner?.team || null, seed: lowestSeedWinner?.seed || null },
      winner: seed1 && lowestSeedWinner ? getWinner(seed1, lowestSeedWinner.team) : null,
      round: 'divisional',
    }

    const bottomMatchup: Matchup = {
      top: { team: otherWinners[0]?.team || null, seed: otherWinners[0]?.seed || null },
      bottom: { team: otherWinners[1]?.team || null, seed: otherWinners[1]?.seed || null },
      winner: otherWinners.length === 2 ? getWinner(otherWinners[0].team, otherWinners[1].team) : null,
      round: 'divisional',
    }

    return { top: topMatchup, bottom: bottomMatchup }
  }

  // Get conference championship matchup
  const getChampionshipMatchup = (conference: 'AFC' | 'NFC'): Matchup => {
    const divMatchups = getDivisionalMatchups(conference)

    const divWinners: { team: Team; seed: number }[] = []
    if (divMatchups.top.winner) {
      divWinners.push({ team: divMatchups.top.winner, seed: divMatchups.top.winner.playoff_seed || 0 })
    }
    if (divMatchups.bottom.winner) {
      divWinners.push({ team: divMatchups.bottom.winner, seed: divMatchups.bottom.winner.playoff_seed || 0 })
    }

    divWinners.sort((a, b) => a.seed - b.seed)

    return {
      top: { team: divWinners[0]?.team || null, seed: divWinners[0]?.seed || null },
      bottom: { team: divWinners[1]?.team || null, seed: divWinners[1]?.seed || null },
      winner: divWinners.length === 2 ? getWinner(divWinners[0].team, divWinners[1].team) : null,
      round: 'championship',
    }
  }

  // Get Super Bowl matchup
  const getSuperBowlMatchup = (): Matchup => {
    const afcChamp = getChampionshipMatchup('AFC')
    const nfcChamp = getChampionshipMatchup('NFC')

    return {
      top: { team: afcChamp.winner || null, seed: afcChamp.winner?.playoff_seed || null },
      bottom: { team: nfcChamp.winner || null, seed: nfcChamp.winner?.playoff_seed || null },
      winner: afcChamp.winner && nfcChamp.winner ? getWinner(afcChamp.winner, nfcChamp.winner) : null,
      round: 'superbowl',
    }
  }

  // Handle clicking on a team to select as winner
  const handleSelectWinner = async (winner: Team, loser: Team, round: string) => {
    if (processing) return

    const confirmMsg = `Select ${winner.city} ${winner.name} as the winner?\n\nThis will eliminate ${loser.city} ${loser.name}.`
    if (!confirm(confirmMsg)) return

    setProcessing(winner.id)
    try {
      await onSelectWinner(winner, loser, round)
    } finally {
      setProcessing(null)
    }
  }

  // Handle reinstating an eliminated team
  const handleReinstate = async (team: Team) => {
    if (processing) return
    if (!confirm(`Reinstate ${team.city} ${team.name}?`)) return

    setProcessing(team.id)
    try {
      await onReinstate(team)
    } finally {
      setProcessing(null)
    }
  }

  // Clickable team slot for matchup selection
  const ClickableTeamSlot = ({
    team,
    seed,
    opponent,
    round,
    isWinner
  }: {
    team: Team | null
    seed: number | null
    opponent: Team | null
    round: string
    isWinner: boolean
  }) => {
    if (!team) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 min-w-[160px]">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-slate-400 text-xs">?</span>
          </div>
          <span className="text-slate-400 text-sm">TBD</span>
        </div>
      )
    }

    const eliminated = !team.is_alive
    const canSelect = !eliminated && opponent && opponent.is_alive && !isWinner
    const isProcessing = processing === team.id

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => canSelect && opponent && handleSelectWinner(team, opponent, round)}
          disabled={!canSelect || isProcessing}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 min-w-[160px] transition-all ${
            isWinner
              ? 'bg-green-50 border-green-500 ring-2 ring-green-200'
              : eliminated
              ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
              : canSelect
              ? 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer shadow-sm hover:shadow'
              : 'bg-white border-gray-200'
          }`}
        >
          {seed && (
            <span className={`text-xs font-bold w-4 ${eliminated ? 'text-gray-400' : 'text-gray-500'}`}>
              {seed}
            </span>
          )}
          <img
            src={getTeamLogoUrl(team.id)}
            alt={team.name}
            className={`w-8 h-8 object-contain ${eliminated ? 'grayscale' : ''}`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span className={`text-sm font-semibold truncate ${
              isWinner ? 'text-green-700' : eliminated ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}>
              {team.name}
            </span>
            <span className={`text-xs ${eliminated ? 'text-gray-400' : 'text-gray-500'}`}>
              {team.city}
            </span>
          </div>
          {isWinner && (
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {eliminated && (
            <span className="text-xs text-red-500 font-medium flex-shrink-0">OUT</span>
          )}
          {isProcessing && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent flex-shrink-0"></div>
          )}
        </button>
        {eliminated && (
          <button
            onClick={() => handleReinstate(team)}
            disabled={isProcessing}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
            title="Reinstate team"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  // Matchup block with VS indicator
  const MatchupBlock = ({ matchup, label }: { matchup: Matchup; label?: string }) => {
    const topIsWinner = matchup.winner?.id === matchup.top.team?.id
    const bottomIsWinner = matchup.winner?.id === matchup.bottom.team?.id

    return (
      <div className="flex flex-col">
        {label && (
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</div>
        )}
        <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <ClickableTeamSlot
            team={matchup.top.team}
            seed={matchup.top.seed}
            opponent={matchup.bottom.team}
            round={matchup.round}
            isWinner={topIsWinner}
          />
          <div className="text-center text-xs text-gray-400 font-medium py-1">vs</div>
          <ClickableTeamSlot
            team={matchup.bottom.team}
            seed={matchup.bottom.seed}
            opponent={matchup.top.team}
            round={matchup.round}
            isWinner={bottomIsWinner}
          />
        </div>
      </div>
    )
  }

  // 1-seed bye display
  const ByeTeamSlot = ({ team, conference }: { team: Team | null; conference: string }) => {
    if (!team) return null
    const eliminated = !team.is_alive

    return (
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          {conference} #1 Seed (Bye)
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 min-w-[160px] ${
            eliminated ? 'bg-gray-100 border-gray-200 opacity-50' : 'bg-white border-amber-300'
          }`}>
            <span className="text-xs font-bold w-4 text-amber-600">1</span>
            <img
              src={getTeamLogoUrl(team.id)}
              alt={team.name}
              className={`w-8 h-8 object-contain ${eliminated ? 'grayscale' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-sm font-semibold ${eliminated ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {team.name}
              </span>
              <span className="text-xs text-gray-500">{team.city}</span>
            </div>
            {!eliminated && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">BYE</span>
            )}
            {eliminated && (
              <span className="text-xs text-red-500 font-medium">OUT</span>
            )}
          </div>
          {eliminated && (
            <button
              onClick={() => handleReinstate(team)}
              disabled={processing === team.id}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
              title="Reinstate team"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
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

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">Click on a team to select them as the winner</p>
            <p className="mt-1">The losing team will be eliminated. Use the refresh icon to reinstate an eliminated team if needed.</p>
          </div>
        </div>
      </div>

      {/* AFC Bracket */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <h2 className="text-lg font-bold text-gray-900">AFC Bracket</h2>
          <span className="text-sm text-gray-500">
            ({teams.filter(t => t.conference === 'AFC' && t.is_alive).length} teams remaining)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 1 Seed Bye */}
          <div>
            <ByeTeamSlot team={getTeam('AFC', 1) || null} conference="AFC" />
          </div>

          {/* Wild Card */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">Wild Card Round</div>
            {afcWildCard.map((matchup, i) => (
              <MatchupBlock key={`afc-wc-${i}`} matchup={matchup} />
            ))}
          </div>

          {/* Divisional */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">Divisional Round</div>
            <MatchupBlock matchup={afcDivisional.top} label="#1 vs Lowest Seed" />
            <MatchupBlock matchup={afcDivisional.bottom} label="Other Winners" />
          </div>

          {/* Championship */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">AFC Championship</div>
            <MatchupBlock matchup={afcChampionship} />
          </div>
        </div>
      </div>

      {/* NFC Bracket */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <h2 className="text-lg font-bold text-gray-900">NFC Bracket</h2>
          <span className="text-sm text-gray-500">
            ({teams.filter(t => t.conference === 'NFC' && t.is_alive).length} teams remaining)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 1 Seed Bye */}
          <div>
            <ByeTeamSlot team={getTeam('NFC', 1) || null} conference="NFC" />
          </div>

          {/* Wild Card */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">Wild Card Round</div>
            {nfcWildCard.map((matchup, i) => (
              <MatchupBlock key={`nfc-wc-${i}`} matchup={matchup} />
            ))}
          </div>

          {/* Divisional */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">Divisional Round</div>
            <MatchupBlock matchup={nfcDivisional.top} label="#1 vs Lowest Seed" />
            <MatchupBlock matchup={nfcDivisional.bottom} label="Other Winners" />
          </div>

          {/* Championship */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">NFC Championship</div>
            <MatchupBlock matchup={nfcChampionship} />
          </div>
        </div>
      </div>

      {/* Super Bowl */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl shadow-sm border border-amber-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
          </svg>
          <h2 className="text-lg font-bold text-gray-900">Super Bowl</h2>
        </div>

        <div className="max-w-md mx-auto">
          <MatchupBlock matchup={superBowl} />

          {superBowl.winner && (
            <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-xl border-2 border-amber-300 text-center">
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2">Champion</div>
              <div className="flex items-center justify-center gap-3">
                <img
                  src={getTeamLogoUrl(superBowl.winner.id)}
                  alt={superBowl.winner.name}
                  className="w-12 h-12 object-contain"
                />
                <div>
                  <div className="text-xl font-bold text-gray-900">{superBowl.winner.city} {superBowl.winner.name}</div>
                  <div className="text-sm text-amber-700">Super Bowl Champions</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
