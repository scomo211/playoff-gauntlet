import { useState, useMemo } from 'react'
import SalaryCapLayout from '../../components/salarycap/SalaryCapLayout'
import { useSalaryCapFreeAgents } from '../../hooks/useSalaryCap'

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

// Avatar component matching SalaryCapOffseason style
function Avatar({ name, position }: { name: string; position: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <div className="w-[38px] h-[38px] rounded-[10px] bg-surface-well border border-hairline-strong flex items-center justify-center font-data font-bold text-[11px] text-[#4d5766] flex-none relative overflow-hidden">
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

export default function SalaryCapFreeAgents() {
  const { freeAgents, loading } = useSalaryCapFreeAgents()
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [teamFilter, setTeamFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFreeAgents = useMemo(() => {
    return freeAgents.filter((fa) => {
      const matchesPosition = positionFilter === 'ALL' || fa.player.position === positionFilter
      const matchesTeam = teamFilter === 'ALL' || fa.player.nfl_team === teamFilter
      const matchesSearch = fa.player.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesPosition && matchesTeam && matchesSearch
    })
  }, [freeAgents, positionFilter, teamFilter, searchQuery])

  const positions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']

  return (
    <SalaryCapLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display font-semibold text-[29px] tracking-[-0.02em] text-fg">
            Free Agents
          </h1>
          <p className="text-fg-muted text-[14px] mt-[5px]">
            {freeAgents.length} players available for the draft
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

        {/* Free Agents List */}
        <div className="rounded-panel border border-hairline bg-surface-panel overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-[48px_42px_1fr] items-center gap-[12px] px-[16px] py-[10px] border-b border-hairline">
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle">Rank</div>
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle"></div>
            <div className="font-data text-[10px] uppercase tracking-[0.14em] text-fg-subtle">Player</div>
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
          ) : filteredFreeAgents.length === 0 ? (
            <div className="text-center py-16 text-fg-subtle">
              {searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL'
                ? 'No free agents match your filters'
                : 'No free agents available'}
            </div>
          ) : (
            <div>
              {filteredFreeAgents.map((fa) => (
                <div
                  key={fa.player.id}
                  className="grid grid-cols-[48px_42px_1fr] items-center gap-[12px] px-[16px] py-[10px] border-b border-hairline last:border-none hover:bg-surface-well/50 transition"
                >
                  {/* Rank */}
                  <div className="font-data text-[14px] font-bold tabular-nums text-fg-muted">
                    {fa.player.fantasy_rank ?? '—'}
                  </div>

                  {/* Avatar */}
                  <Avatar name={fa.player.name} position={fa.player.position} />

                  {/* Player Info */}
                  <div>
                    <div className="flex items-center">
                      <span className="text-[14px] font-semibold text-fg">{fa.player.name}</span>
                      {fa.player.is_rookie && <RookieBadge />}
                    </div>
                    <div className="font-data text-[10.5px] text-fg-subtle mt-[2px]">
                      {fa.player.nfl_team || 'Free Agent'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Count footer */}
        {!loading && filteredFreeAgents.length > 0 && (
          <div className="text-center font-data text-[11px] text-fg-subtle">
            Showing {filteredFreeAgents.length} of {freeAgents.length} free agents
          </div>
        )}
      </div>
    </SalaryCapLayout>
  )
}
