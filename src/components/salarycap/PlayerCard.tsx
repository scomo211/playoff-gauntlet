import { useEffect, useRef } from 'react'
import {
  useSleeperPlayer,
  formatHeight,
  formatWeight,
  formatExperience,
  getTeamFullName,
} from '../../hooks/useSleeperPlayer'

const SLEEPER_CDN = 'https://sleepercdn.com/content/nfl/players'

interface PlayerCardProps {
  sleeperId: string
  playerName: string
  position: string
  onClose: () => void
}

// Position colors for the badge
const POS_COLORS: Record<string, string> = {
  QB: 'bg-pos-qb/20 text-pos-qb border-pos-qb/30',
  RB: 'bg-pos-rb/20 text-pos-rb border-pos-rb/30',
  WR: 'bg-pos-wr/20 text-pos-wr border-pos-wr/30',
  TE: 'bg-pos-te/20 text-pos-te border-pos-te/30',
  K: 'bg-pos-k/20 text-pos-k border-pos-k/30',
  DEF: 'bg-pos-def/20 text-pos-def border-pos-def/30',
}

export default function PlayerCard({ sleeperId, playerName, position, onClose }: PlayerCardProps) {
  const { player, loading, error } = useSleeperPlayer(sleeperId)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const posColor = POS_COLORS[position] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative w-full max-w-[340px] mx-4 bg-surface-panel border border-hairline rounded-[16px] shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition text-fg-subtle hover:text-fg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Photo header */}
        <div className="relative h-[180px] bg-gradient-to-b from-surface-well to-surface-panel">
          <img
            src={`${SLEEPER_CDN}/${sleeperId}.jpg`}
            alt={playerName}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-panel to-transparent" />
        </div>

        {/* Player info */}
        <div className="px-5 pb-5 -mt-10 relative">
          {/* Name and position */}
          <div className="mb-4">
            <h2 className="text-[22px] font-display font-bold text-fg tracking-tight">
              {player?.full_name || playerName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${posColor}`}>
                {position}
              </span>
              <span className="text-[14px] text-fg-muted">
                {player?.team ? getTeamFullName(player.team) : 'Free Agent'}
              </span>
              {player?.number && (
                <span className="text-[14px] text-fg-subtle">#{player.number}</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between animate-pulse">
                  <div className="h-4 w-20 bg-surface-well rounded" />
                  <div className="h-4 w-24 bg-surface-well rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-fg-subtle text-sm">
              Unable to load player details
            </div>
          ) : player ? (
            <>
              {/* Stats grid */}
              <div className="space-y-2">
                <StatRow label="Height" value={formatHeight(player.height)} />
                <StatRow label="Weight" value={formatWeight(player.weight)} />
                <StatRow label="Age" value={player.age?.toString() || '—'} />
                <StatRow label="College" value={player.college || '—'} />
                <StatRow label="Experience" value={formatExperience(player.years_exp)} />
              </div>

              {/* Injury status */}
              {player.injury_status && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-[13px] font-medium text-red-400">
                      {player.injury_status}
                      {player.injury_body_part && ` - ${player.injury_body_part}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Depth chart info */}
              {player.depth_chart_order && player.depth_chart_order <= 3 && (
                <div className="mt-3 text-[12px] text-fg-subtle text-center">
                  {player.depth_chart_position} #{player.depth_chart_order} on depth chart
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-hairline last:border-0">
      <span className="text-[13px] text-fg-subtle">{label}</span>
      <span className="text-[13px] font-medium text-fg">{value}</span>
    </div>
  )
}
