import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { areLineupsLocked } from '../lib/kickoff'

interface TeamOwnership {
  team_id: string
  team_name: string
  city: string
  total_players_rostered: number
  avg_ownership: number
}

interface DeadManWalkingProps {
  weekId: number
}

// ESPN CDN for team logos
const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`

export default function DeadManWalking({ weekId }: DeadManWalkingProps) {
  const [deadTeam, setDeadTeam] = useState<TeamOwnership | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalLineups, setTotalLineups] = useState(0)

  useEffect(() => {
    async function fetchDeadManWalking() {
      setLoading(true)

      // First get total submitted lineups for this week
      const { count: lineupCount } = await supabase
        .from('lineups')
        .select('*', { count: 'exact', head: true })
        .eq('week_id', weekId)
        .eq('is_submitted', true)

      setTotalLineups(lineupCount || 0)

      if (!lineupCount || lineupCount === 0) {
        setDeadTeam(null)
        setLoading(false)
        return
      }

      // Get all alive playoff teams
      const { data: aliveTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, city')
        .eq('is_alive', true)

      if (teamsError || !aliveTeams) {
        console.error('Error fetching teams:', teamsError)
        setLoading(false)
        return
      }

      // Get all lineup players for submitted lineups this week with team info
      const { data: lineupPlayers, error } = await supabase
        .from('lineup_players')
        .select(`
          player_id,
          lineup:lineups!inner(week_id, is_submitted),
          player:players(
            team_id
          )
        `)
        .eq('lineup.week_id', weekId)
        .eq('lineup.is_submitted', true)

      if (error) {
        console.error('Error fetching lineup players:', error)
        setLoading(false)
        return
      }

      // Count roster spots per team
      const teamRosterCounts: Record<string, number> = {}

      // Initialize all alive teams with 0
      aliveTeams.forEach(team => {
        teamRosterCounts[team.id] = 0
      })

      lineupPlayers?.forEach((lp) => {
        const playerData = lp.player
        if (!playerData) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = Array.isArray(playerData) ? playerData[0] : playerData as any
        if (!player || !player.team_id) return

        // Only count if it's an alive playoff team
        if (teamRosterCounts[player.team_id] !== undefined) {
          teamRosterCounts[player.team_id]++
        }
      })

      // Find the team with the HIGHEST roster count among alive teams
      // This team is the one everyone is betting on - their opponent is the "dead man walking"
      let highestTeam: TeamOwnership | null = null
      let highestCount = -1

      aliveTeams.forEach(team => {
        const count = teamRosterCounts[team.id] || 0
        if (count > highestCount) {
          highestCount = count
          highestTeam = {
            team_id: team.id,
            team_name: team.name,
            city: team.city,
            total_players_rostered: count,
            avg_ownership: Math.round((count / (lineupCount * 7)) * 100) // 7 roster spots per lineup
          }
        }
      })

      setDeadTeam(highestTeam)
      setLoading(false)
    }

    fetchDeadManWalking()
  }, [weekId])

  if (loading) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4">Dead Team Walking</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  if (totalLineups === 0 || !deadTeam) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4">Dead Team Walking</h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No submitted lineups yet for Week {weekId}
        </p>
      </div>
    )
  }

  // Hide results until lineups are locked
  if (!areLineupsLocked()) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4">Dead Team Walking</h3>
        <div className="flex flex-col items-center justify-center py-12">
          <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-slate-400 text-sm text-center">
            Results revealed at kickoff
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-solid p-6 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white">Dead Team Walking</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        The team the league thinks has absolutely no shot to advance
      </p>

      {/* Team Display */}
      <div className="flex flex-col items-center justify-center py-4">
        {/* Team Logo - full color since this is the favored team */}
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-field-500/20 rounded-full blur-xl"></div>
          <img
            src={getTeamLogoUrl(deadTeam.team_id)}
            alt={deadTeam.team_name}
            className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {/* Skull and crossbones overlay */}
          <div className="absolute -top-3 -right-3">
            <svg className="w-12 h-12 sm:w-14 sm:h-14" viewBox="0 0 64 64" fill="none">
              {/* Crossbones */}
              <path d="M8 52L52 12" stroke="#DC2626" strokeWidth="6" strokeLinecap="round"/>
              <path d="M12 12L56 52" stroke="#DC2626" strokeWidth="6" strokeLinecap="round"/>
              <circle cx="8" cy="52" r="4" fill="#DC2626"/>
              <circle cx="52" cy="12" r="4" fill="#DC2626"/>
              <circle cx="12" cy="12" r="4" fill="#DC2626"/>
              <circle cx="56" cy="52" r="4" fill="#DC2626"/>
              {/* Skull */}
              <ellipse cx="32" cy="28" rx="14" ry="12" fill="#FEE2E2"/>
              <ellipse cx="32" cy="28" rx="14" ry="12" stroke="#DC2626" strokeWidth="2"/>
              {/* Eye sockets */}
              <ellipse cx="27" cy="26" rx="4" ry="5" fill="#DC2626"/>
              <ellipse cx="37" cy="26" rx="4" ry="5" fill="#DC2626"/>
              {/* Nose */}
              <path d="M32 30L30 34H34L32 30Z" fill="#DC2626"/>
              {/* Teeth */}
              <rect x="26" y="36" width="12" height="6" rx="1" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1"/>
              <line x1="29" y1="36" x2="29" y2="42" stroke="#DC2626" strokeWidth="1"/>
              <line x1="32" y1="36" x2="32" y2="42" stroke="#DC2626" strokeWidth="1"/>
              <line x1="35" y1="36" x2="35" y2="42" stroke="#DC2626" strokeWidth="1"/>
            </svg>
          </div>
        </div>

        {/* Team Name */}
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {deadTeam.city} {deadTeam.team_name}
          </div>
          <div className="text-field-400 text-sm font-medium">
            {deadTeam.team_name} players were started {deadTeam.total_players_rostered} times across {totalLineups} lineups
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex items-center gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-field-400">{deadTeam.avg_ownership}%</div>
            <div className="text-xs text-slate-500">Avg Ownership</div>
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div>
            <div className="text-2xl font-bold text-slate-400">{totalLineups}</div>
            <div className="text-xs text-slate-500">Total Lineups</div>
          </div>
        </div>
      </div>
    </div>
  )
}
