import { useState, useMemo } from 'react'
import Modal from './Modal'
import { Position } from '../types/database'
import { PlayerWithTeam } from '../hooks/usePlayers'
import { getPlayerHeadshotUrl, PLACEHOLDER_IMAGE } from '../lib/playerImages'

interface PlayerSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (player: PlayerWithTeam) => void
  position: Position
  players: PlayerWithTeam[]
  currentLineupPlayerIds: string[]
  isPlayerUsed: (playerId: string) => boolean
  weekId?: number
  getProjection?: (playerName: string, teamId: string) => number | null
  projectionsLoading?: boolean
}

export default function PlayerSelectModal({
  isOpen,
  onClose,
  onSelect,
  position,
  players,
  currentLineupPlayerIds,
  isPlayerUsed,
  weekId = 1,
  getProjection,
  projectionsLoading = false,
}: PlayerSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')

  // Check if team has a bye this week
  const isTeamOnBye = (team: PlayerWithTeam['team']) => {
    if (!team || !team.is_alive) return false
    // Wild Card week: seed 1 teams have bye
    if (weekId === 1 && team.playoff_seed === 1) return true
    return false
  }

  // Get unique teams from available players (including bye teams)
  const teams = useMemo(() => {
    const teamSet = new Map<string, { id: string; name: string; city: string }>()
    players.forEach(p => {
      if (p.team && p.team.is_alive) {
        teamSet.set(p.team.id, { id: p.team.id, name: p.team.name, city: p.team.city })
      }
    })
    return Array.from(teamSet.values()).sort((a, b) => a.city.localeCompare(b.city))
  }, [players])

  // Filter players and remove duplicates (include bye team players)
  const filteredPlayers = useMemo(() => {
    const seen = new Set<string>()
    return players
      .filter(p => p.position === position && p.team?.is_alive)
      .filter(p => {
        // Remove duplicates by player ID
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })
      .filter(p => {
        if (searchQuery) {
          return p.name.toLowerCase().includes(searchQuery.toLowerCase())
        }
        return true
      })
      .filter(p => {
        if (teamFilter !== 'ALL') {
          return p.team_id === teamFilter
        }
        return true
      })
      .sort((a, b) => {
        // Sort: available first, then used/bye
        const aOnBye = isTeamOnBye(a.team)
        const bOnBye = isTeamOnBye(b.team)
        const aUsed = isPlayerUsed(a.id) || currentLineupPlayerIds.includes(a.id)
        const bUsed = isPlayerUsed(b.id) || currentLineupPlayerIds.includes(b.id)
        const aUnavailable = aUsed || aOnBye
        const bUnavailable = bUsed || bOnBye
        if (aUnavailable && !bUnavailable) return 1
        if (!aUnavailable && bUnavailable) return -1
        // Sort by projected points (highest first) if available
        if (getProjection && a.team_id && b.team_id) {
          const aProj = getProjection(a.name, a.team_id) ?? 0
          const bProj = getProjection(b.name, b.team_id) ?? 0
          if (aProj !== bProj) return bProj - aProj
        }
        return a.name.localeCompare(b.name)
      })
  }, [players, position, searchQuery, teamFilter, isPlayerUsed, currentLineupPlayerIds, getProjection, weekId])

  const handleSelect = (player: PlayerWithTeam) => {
    onSelect(player)
    setSearchQuery('')
    setTeamFilter('ALL')
    onClose()
  }

  const handleClose = () => {
    setSearchQuery('')
    setTeamFilter('ALL')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Select ${position}`}>
      <div className="space-y-4">
        {/* Projections loading indicator */}
        {projectionsLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
            Loading projections...
          </div>
        )}
        {/* Search and filters */}
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoFocus
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="ALL">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Player list */}
        <div className="max-h-80 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-700">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map(player => {
              const isUsed = isPlayerUsed(player.id)
              const isInCurrentLineup = currentLineupPlayerIds.includes(player.id)
              const onBye = isTeamOnBye(player.team)
              const isDisabled = isUsed || isInCurrentLineup || onBye

              return (
                <button
                  key={player.id}
                  onClick={() => !isDisabled && handleSelect(player)}
                  disabled={isDisabled}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between transition ${
                    isDisabled
                      ? 'bg-slate-800/50 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getPlayerHeadshotUrl(player.id)}
                      alt={player.name}
                      className={`w-10 h-10 rounded-full object-cover ${
                        isDisabled ? 'opacity-50 grayscale' : ''
                      }`}
                      style={{ backgroundColor: '#334155' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
                      }}
                    />
                    <div>
                      <div className={`font-medium ${isDisabled ? 'text-slate-500' : 'text-white'}`}>
                        {player.name}
                      </div>
                      <div className={`text-sm ${isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>
                        {player.team?.city} {player.team?.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getProjection && player.team_id && !onBye && (() => {
                      const proj = getProjection(player.name, player.team_id)
                      return proj !== null ? (
                        <span className={`text-sm font-semibold ${isDisabled ? 'text-slate-500' : 'text-emerald-400'}`}>
                          {proj.toFixed(1)} pts
                        </span>
                      ) : null
                    })()}
                    {onBye && (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-400 font-medium">
                        BYE
                      </span>
                    )}
                    {isUsed && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-900/50 text-red-400">
                        Used
                      </span>
                    )}
                    {isInCurrentLineup && !isUsed && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-400">
                        In Lineup
                      </span>
                    )}
                    {!isDisabled && (
                      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center text-slate-500">
              No {position} players found
            </div>
          )}
        </div>

        <div className="text-sm text-slate-400">
          {filteredPlayers.filter(p => !isPlayerUsed(p.id) && !currentLineupPlayerIds.includes(p.id) && !isTeamOnBye(p.team)).length} available
          {' / '}
          {filteredPlayers.length} total
        </div>
      </div>
    </Modal>
  )
}
