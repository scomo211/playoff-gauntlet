interface RookieBadgeProps {
  className?: string
}

export default function RookieBadge({ className = '' }: RookieBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-400 border border-amber-500/30 ${className}`}
    >
      R
    </span>
  )
}
