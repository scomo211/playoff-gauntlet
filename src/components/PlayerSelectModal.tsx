import { useState, useMemo } from 'react'
import Modal from './Modal'
import { Position } from '../types/database'
import { PlayerWithTeam } from '../hooks/usePlayers'

interface PlayerSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (player: PlayerWithTeam) => void
  position: Position
  players: PlayerWithTeam[]
  currentLineupPlayerIds: string[]
  isPlayerUsed: (playerId: string) => boolean
  weekId?: number
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
}: PlayerSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')

  // Check if team is playing this week (seed 1 has bye in Wild Card)
  const isTeamPlayingThisWeek = (team: PlayerWithTeam['team']) => {
    if (!team || !team.is_alive) return false
    // Wild Card week: seed 1 teams have bye
    if (weekId === 1 && team.playoff_seed === 1) return false
    return true
  }

  // Get unique teams from available players
  const teams = useMemo(() => {
    const teamSet = new Map<string, { id: string; name: string; city: string }>()
    players.forEach(p => {
      if (p.team && isTeamPlayingThisWeek(p.team)) {
        teamSet.set(p.team.id, { id: p.team.id, name: p.team.name, city: p.team.city })
      }
    })
    return Array.from(teamSet.values()).sort((a, b) => a.city.localeCompare(b.city))
  }, [players, weekId])

  // Filter players
  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => p.position === position && isTeamPlayingThisWeek(p.team))
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
        // Sort: available first, then used
        const aUsed = isPlayerUsed(a.id) || currentLineupPlayerIds.includes(a.id)
        const bUsed = isPlayerUsed(b.id) || currentLineupPlayerIds.includes(b.id)
        if (aUsed && !bUsed) return 1
        if (!aUsed && bUsed) return -1
        return a.name.localeCompare(b.name)
      })
  }, [players, position, searchQuery, teamFilter, isPlayerUsed, currentLineupPlayerIds])

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
        {/* Search and filters */}
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map(player => {
              const isUsed = isPlayerUsed(player.id)
              const isInCurrentLineup = currentLineupPlayerIds.includes(player.id)
              const isDisabled = isUsed || isInCurrentLineup

              return (
                <button
                  key={player.id}
                  onClick={() => !isDisabled && handleSelect(player)}
                  disabled={isDisabled}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between transition ${
                    isDisabled
                      ? 'bg-gray-50 cursor-not-allowed'
                      : 'hover:bg-blue-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        isDisabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {player.team_id}
                    </div>
                    <div>
                      <div className={`font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                        {player.name}
                      </div>
                      <div className={`text-sm ${isDisabled ? 'text-gray-300' : 'text-gray-500'}`}>
                        {player.team?.city} {player.team?.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUsed && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                        Used
                      </span>
                    )}
                    {isInCurrentLineup && !isUsed && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                        In Lineup
                      </span>
                    )}
                    {!isDisabled && (
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No {position} players found
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          {filteredPlayers.filter(p => !isPlayerUsed(p.id) && !currentLineupPlayerIds.includes(p.id)).length} available
          {' / '}
          {filteredPlayers.length} total
        </div>
      </div>
    </Modal>
  )
}
