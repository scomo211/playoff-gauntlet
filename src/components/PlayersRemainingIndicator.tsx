interface PlayersRemainingIndicatorProps {
  playersPlayed: number
  totalPlayers: number
  className?: string
}

export default function PlayersRemainingIndicator({
  playersPlayed,
  totalPlayers,
  className = ''
}: PlayersRemainingIndicatorProps) {
  const remaining = totalPlayers - playersPlayed
  const allDone = remaining === 0 && totalPlayers > 0

  // Calculate percentage for circular progress
  const percentage = totalPlayers > 0 ? (playersPlayed / totalPlayers) * 100 : 0

  // SVG circle parameters
  const size = 24
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Show green checkmark when all players have started
  if (allDone) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* Circular progress */}
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-field-500 transition-all duration-500"
        />
      </svg>
    </div>
  )
}
