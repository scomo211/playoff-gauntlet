interface PositionBadgeProps {
  position: string
  size?: 'sm' | 'md'
}

const positionColors: Record<string, string> = {
  QB: 'bg-red-500/20 text-red-400 border-red-500/30',
  RB: 'bg-green-500/20 text-green-400 border-green-500/30',
  WR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  TE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  K: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DEF: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function PositionBadge({ position, size = 'md' }: PositionBadgeProps) {
  const colorClass = positionColors[position] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <span className={`inline-block font-medium rounded border ${colorClass} ${sizeClass}`}>
      {position}
    </span>
  )
}
