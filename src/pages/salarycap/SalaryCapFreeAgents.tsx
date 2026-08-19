import { useState, useMemo, useEffect } from 'react'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { supabase } from '../../lib/supabase'

const NFL_TEAMS = [
  'ALL', 'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAC', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ',
  'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
] as const

type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE'

// Position colors matching design system
const POS_COLOR: Record<string, string> = {
  QB: 'text-pos-qb', RB: 'text-pos-rb', WR: 'text-pos-wr',
  TE: 'text-pos-te', K: 'text-pos-k', DEF: 'text-pos-def',
}

interface Player {
  id: string
  name: string
  position: string
  nfl_team: string | null
  fantasy_rank: number | null
  is_rookie: boolean
}

interface PlayerWithRoster extends Player {
  isRostered: boolean
  ownerName: string | null
}

// Avatar component matching SalaryCapOffseason style
function Avatar({ name, position, dimmed = false }: { name: string; position: string; dimmed?: boolean }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <div className={`w-[38px] h-[38px] rounded-[10px] bg-surface-well border border-hairline-strong flex items-center justify-center font-data font-bold text-[11px] text-[#4d5766] flex-none relative overflow-hidden ${dimmed ? 'opacity-50' : ''}`}>
      {initials}
      <span className={`absolute bottom-0 left-0 right-0 text-[6.5px] py-[1.5px] font-bold tracking-[0.1em] bg-[rgba(9,12,17,0.85)] text-center ${POS_COLOR[position] || 'text-fg-subtle'}`}>
        {position}
      </span>
    </div>
  )
}

// Rookie badge
function RookieBadge() {
  return (
    <span className="inline-block font-data text-[9px] font-bold text-gold-500 bg-gold-500/15 px-[5px] py-[1px] rounded-[4px] ml-[6px]">
      R
    </span>
  )
}

// Custom hook to fetch all players with roster info
function useAllPlayersWithRoster() {
  const [players, setPlayers] = useState<PlayerWithRoster[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)

        // Get all active players
        const { data: allPlayers, error: playerError } = await supabase
          .from('salarycap_players')
          .select('id, name, position, nfl_team, fantasy_rank, is_rookie')
          .eq('is_active', true)

        if (playerError) throw playerError

        // Get all contracts with owner info
        const { data: contracts, error: contractError } = await supabase
          .from('salarycap_contracts')
          .select('player_id, owner:salarycap_owners(owner_name)')
          .eq('contract_status', 'active')

        if (contractError) throw contractError

        // Create a map of player_id -> owner_name
        const rosterMap = new Map<string, string>()
        for (const contract of contracts || []) {
          // Supabase returns the joined owner as an object (not array for single relation)
          const owner = contract.owner as unknown as { owner_name: string } | null
          if (owner?.owner_name) {
            rosterMap.set(contract.player_id, owner.owner_name)
          }
        }

        // Combine players with roster info
        const playersWithRoster: PlayerWithRoster[] = (allPlayers || []).map(player => ({
          ...player,
          isRostered: rosterMap.has(player.id),
          ownerName: rosterMap.get(player.id) || null,
        }))

        // Sort by fantasy_rank (nulls at end)
        playersWithRoster.sort((a, b) => {
          if (a.fantasy_rank === null && b.fantasy_rank === null) return 0
          if (a.fantasy_rank === null) return 1
          if (b.fantasy_rank === null) return -1
          return a.fantasy_rank - b.fantasy_rank
        })

        setPlayers(playersWithRoster)
      } catch (err) {
        console.error('Failed to fetch players:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  return { players, loading }
}

export default function SalaryCapFreeAgents() {
  const { players, loading } = useAllPlayersWithRoster()
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideRostered, setHideRostered] = useState(true)

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      // Hide rostered filter
      if (hideRostered && p.isRostered) return false

      const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter
      const matchesTeam = teamFilter === 'ALL' || p.nfl_team === teamFilter
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesPosition && matchesTeam && matchesSearch
    })
  }, [players, positionFilter, teamFilter, searchQuery, hideRostered])

  const freeAgentCount = players.filter(p => !p.isRostered).length
  const positions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']

  return (
    <SalaryCapLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display font-semibold text-[29px] tracking-[-0.02em] text-fg">
            {hideRostered ? 'Free Agents' : 'All Players'}
          </h1>
          <p className="text-fg-muted text-[14px] mt-[5px]">
            {hideRostered
              ? `${freeAgentCount} players available for the draft`
              : `${players.length} total players · ${freeAgentCount} free agents`
            }
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-[38px] pr-[14px] py-[9px] bg-surface-well border border-hairline rounded-[8px] text-fg text-[13px] placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-field-500 transition"
            />
          </div>

          {/* Team filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-[12px] py-[9px] bg-surface-well border border-hairline rounded-[8px] text-fg text-[13px] focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-field-500 transition"
          >
            <option value="ALL">All Teams</option>
            {NFL_TEAMS.filter(t => t !== 'ALL').map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          {/* Position filter */}
          <div className="flex gap-[4px]">
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-[12px] py-[8px] rounded-[8px] text-[12px] font-semibold transition ${
                  positionFilter === pos
                    ? 'bg-field-500 text-[#04150c]'
                    : 'bg-surface-well border border-hairline text-fg-muted hover:text-fg hover:border-hairline-strong'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Hide rostered checkbox */}
        <label className="flex items-center gap-[10px] cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={hideRostered}
              onChange={(e) => setHideRostered(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-[18px] h-[18px] rounded-[5px] border-2 border-hairline-strong bg-surface-well peer-checked:bg-field-500 peer-checked:border-field-500 transition-colors" />
            <svg
              className="absolute top-[3px] left-[3px] w-[12px] h-[12px] text-[#04150c] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-[13px] text-fg-muted">
            Hide rostered players
          </span>
          {!hideRostered && (
            <span className="text-[11px] text-fg-subtle">
              (showing {players.length - freeAgentCount} rostered)
            </span>
          )}
        </label>

        {/* Players List */}
        <div className="rounded-panel border border-hairline bg-surface-panel overflow-hidden">
          {/* Column Headers */}
          <div className={`grid ${hideRostered ? 'grid-cols-[48px_42px_1fr]' : 'grid-cols-[48px_42px_1fr_140px]'} items-center gap-[12px] px-[16px] py-[10px] border-b border-hairline`}>
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle">Rank</div>
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle"></div>
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle">Player</div>
            {!hideRostered && (
              <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle text-right">Owner</div>
            )}
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-5 bg-surface-well rounded" />
                  <div className="w-[38px] h-[38px] bg-surface-well rounded-[10px]" />
                  <div className="h-5 bg-surface-well rounded w-40" />
                </div>
              ))}
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-16 text-fg-subtle">
              {searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL'
                ? 'No players match your filters'
                : 'No players available'}
            </div>
          ) : (
            <div>
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`grid ${hideRostered ? 'grid-cols-[48px_42px_1fr]' : 'grid-cols-[48px_42px_1fr_140px]'} items-center gap-[12px] px-[16px] py-[10px] border-b border-hairline last:border-none transition ${
                    player.isRostered
                      ? 'bg-surface-well/30'
                      : 'hover:bg-surface-well/50'
                  }`}
                >
                  {/* Rank */}
                  <div className={`font-data text-[14px] font-bold tabular-nums ${player.isRostered ? 'text-fg-subtle' : 'text-fg-muted'}`}>
                    {player.fantasy_rank ?? '—'}
                  </div>

                  {/* Avatar */}
                  <Avatar name={player.name} position={player.position} dimmed={player.isRostered} />

                  {/* Player Info */}
                  <div>
                    <div className="flex items-center">
                      <span className={`text-[14px] font-semibold ${player.isRostered ? 'text-fg-subtle' : 'text-fg'}`}>
                        {player.name}
                      </span>
                      {player.is_rookie && <RookieBadge />}
                    </div>
                    <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">
                      {player.nfl_team || 'Free Agent'}
                    </div>
                  </div>

                  {/* Owner (only shown when not hiding rostered) */}
                  {!hideRostered && (
                    <div className="text-right">
                      {player.isRostered ? (
                        <span className="font-data text-[11px] text-fg-subtle bg-hairline px-[8px] py-[3px] rounded-[4px]">
                          {player.ownerName}
                        </span>
                      ) : (
                        <span className="font-data text-[10px] text-field-500 uppercase tracking-[0.08em]">
                          Available
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Count footer */}
        {!loading && filteredPlayers.length > 0 && (
          <div className="text-center font-data text-[11px] text-fg-subtle">
            Showing {filteredPlayers.length} of {hideRostered ? freeAgentCount : players.length} {hideRostered ? 'free agents' : 'players'}
          </div>
        )}
      </div>
    </SalaryCapLayout>
  )
}
