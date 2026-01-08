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

export default function PlayoffBracket() {
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

  // Get alive teams by conference
  const getAliveTeams = (conference: 'AFC' | 'NFC'): Team[] => {
    return teams.filter(t => t.conference === conference && t.is_alive && t.playoff_seed)
  }

  // Determine divisional round matchups based on who's still alive
  const getDivisionalMatchups = (conference: 'AFC' | 'NFC'): { high: Matchup; low: Matchup } => {
    const alive = getAliveTeams(conference).sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99))
    const seed1 = getTeam(conference, 1)

    // If 4+ teams alive, we're still in wild card or just finished
    // If 2-3 teams alive, we're in divisional or beyond
    if (alive.length >= 4) {
      // Divisional matchups will be 1 vs lowest, and 2nd vs 3rd lowest
      const seed1Alive = seed1?.is_alive
      if (seed1Alive) {
        // 1 seed plays lowest remaining (after wild card winners determined)
        return {
          high: {
            top: { team: seed1 || null, seed: 1 },
            bottom: { team: null, seed: null } // TBD - lowest remaining
          },
          low: {
            top: { team: null, seed: null }, // TBD
            bottom: { team: null, seed: null } // TBD
          }
        }
      }
    }

    return {
      high: { top: { team: null, seed: null }, bottom: { team: null, seed: null } },
      low: { top: { team: null, seed: null }, bottom: { team: null, seed: null } }
    }
  }

  // Wild Card matchups (2v7, 3v6, 4v5)
  const getWildCardMatchups = (conference: 'AFC' | 'NFC'): Matchup[] => {
    return [
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
  }

  // Team slot component
  const TeamSlot = ({ team, seed, isEliminated, compact = false }: {
    team: Team | null
    seed: number | null
    isEliminated?: boolean
    compact?: boolean
  }) => {
    const eliminated = isEliminated ?? (team ? !team.is_alive : false)

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
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all ${
        eliminated
          ? 'bg-slate-800/30 border-slate-700/50 opacity-50'
          : 'bg-slate-800 border-slate-600 hover:border-slate-500'
      } ${compact ? 'min-w-[120px]' : 'min-w-[140px]'}`}>
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
      </div>
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
  const afcSeed1 = getTeam('AFC', 1)
  const nfcSeed1 = getTeam('NFC', 1)

  // Determine conference championship teams (if we're that far)
  const afcAlive = getAliveTeams('AFC')
  const nfcAlive = getAliveTeams('NFC')

  return (
    <div className="card-solid p-4 sm:p-6 mb-8 overflow-x-auto">
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
                  <TeamSlot team={afcSeed1 || null} seed={1} />
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                </div>
                <div className="w-4 h-8 border-r-2 border-t-2 border-b-2 border-slate-600 rounded-r ml-1" />
              </div>
              {/* Other divisional matchup */}
              <div className="flex items-center">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                </div>
                <div className="w-4 h-8 border-r-2 border-t-2 border-b-2 border-slate-600 rounded-r ml-1" />
              </div>
            </div>

            {/* AFC Championship */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">AFC Champ</div>
              <div className="flex flex-col gap-1 mt-16">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                  <span className="text-slate-500 text-sm">DIV Winner</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                  <span className="text-slate-500 text-sm">DIV Winner</span>
                </div>
              </div>
            </div>
          </div>

          {/* Super Bowl */}
          <div className="flex flex-col items-center px-6">
            <div className="text-center text-xs font-medium text-gold-400 uppercase tracking-wider mb-4">Super Bowl</div>
            <div className="bg-gradient-to-b from-gold-500/20 to-gold-600/10 border-2 border-gold-500/30 rounded-xl p-4 min-w-[160px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                  <span className="text-slate-500 text-sm">AFC Champion</span>
                </div>
                <div className="text-center text-gold-400 font-bold text-xs">VS</div>
                <div className="flex items-center gap-2 px-2 py-2 bg-slate-900/80 rounded border border-slate-600">
                  <span className="text-slate-500 text-sm">NFC Champion</span>
                </div>
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
                  <TeamSlot team={nfcSeed1 || null} seed={1} />
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                </div>
                <div className="w-4 h-8 border-l-2 border-t-2 border-b-2 border-slate-600 rounded-l mr-1" />
              </div>
              <div className="flex items-center flex-row-reverse">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                    <span className="text-slate-500 text-sm">WC Winner</span>
                  </div>
                </div>
                <div className="w-4 h-8 border-l-2 border-t-2 border-b-2 border-slate-600 rounded-l mr-1" />
              </div>
            </div>

            {/* NFC Championship */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">NFC Champ</div>
              <div className="flex flex-col gap-1 mt-16">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                  <span className="text-slate-500 text-sm">DIV Winner</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-dashed border-slate-600 min-w-[140px]">
                  <span className="text-slate-500 text-sm">DIV Winner</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Bracket - Stacked View */}
      <div className="lg:hidden space-y-6">
        {/* AFC Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-bold text-red-400">AFC</div>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          {/* AFC 1 Seed (Bye) */}
          <div className="mb-3">
            <div className="text-xs text-slate-500 mb-1">1 Seed (Bye)</div>
            <TeamSlot team={afcSeed1 || null} seed={1} compact />
          </div>

          {/* AFC Wild Card Games */}
          <div className="text-xs text-slate-500 mb-2">Wild Card</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {afcWildCard.map((matchup, i) => (
              <div key={`afc-m-wc-${i}`} className="bg-slate-800/30 rounded-lg p-2">
                <div className="flex flex-col gap-1">
                  <TeamSlot team={matchup.top.team} seed={matchup.top.seed} compact />
                  <div className="text-center text-xs text-slate-600">vs</div>
                  <TeamSlot team={matchup.bottom.team} seed={matchup.bottom.seed} compact />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NFC Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-bold text-blue-400">NFC</div>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          {/* NFC 1 Seed (Bye) */}
          <div className="mb-3">
            <div className="text-xs text-slate-500 mb-1">1 Seed (Bye)</div>
            <TeamSlot team={nfcSeed1 || null} seed={1} compact />
          </div>

          {/* NFC Wild Card Games */}
          <div className="text-xs text-slate-500 mb-2">Wild Card</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {nfcWildCard.map((matchup, i) => (
              <div key={`nfc-m-wc-${i}`} className="bg-slate-800/30 rounded-lg p-2">
                <div className="flex flex-col gap-1">
                  <TeamSlot team={matchup.top.team} seed={matchup.top.seed} compact />
                  <div className="text-center text-xs text-slate-600">vs</div>
                  <TeamSlot team={matchup.bottom.team} seed={matchup.bottom.seed} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
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
