import { useState, useEffect } from 'react'

// Deadline: Sunday, August 16th, 2026 at 8 PM Eastern
const DEADLINE = new Date('2026-08-17T00:00:00Z') // 8 PM ET = midnight UTC

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(): TimeLeft {
  const now = new Date()
  const difference = DEADLINE.getTime() - now.getTime()

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  }
}

// Check if deadline has passed (date-based only)
export function isDeadlinePassed(): boolean {
  return new Date() >= DEADLINE
}

interface DeadlineBannerProps {
  isLocked?: boolean // Admin has locked rosters via finalize
}

export default function DeadlineBanner({ isLocked = false }: DeadlineBannerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const deadlinePassed = timeLeft.total <= 0

  // Show locked state if admin locked OR deadline passed
  if (isLocked) {
    return (
      <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-4 py-2 mb-6">
        <div className="flex items-center justify-center gap-2">
          <span className="text-emerald-400 font-medium">Rosters are locked</span>
        </div>
      </div>
    )
  }

  if (deadlinePassed) {
    return (
      <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-2 mb-6">
        <div className="flex items-center justify-center gap-2">
          <span className="text-amber-400 font-medium">Deadline passed - Waiting for commissioner to finalize</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-2 mb-6">
      <div className="flex items-center justify-center gap-3">
        <span className="text-amber-400 font-medium">Rosters lock in</span>
        <div className="flex items-center gap-1">
          <div className="bg-slate-800 rounded px-2 py-0.5 min-w-[2rem] text-center">
            <span className="text-white font-bold">{timeLeft.days}</span>
          </div>
          <span className="text-slate-400 text-xs">d</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="bg-slate-800 rounded px-2 py-0.5 min-w-[2rem] text-center">
            <span className="text-white font-bold">{timeLeft.hours.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-slate-400 text-xs">h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="bg-slate-800 rounded px-2 py-0.5 min-w-[2rem] text-center">
            <span className="text-white font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-slate-400 text-xs">m</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="bg-slate-800 rounded px-2 py-0.5 min-w-[2rem] text-center">
            <span className="text-white font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-slate-400 text-xs">s</span>
        </div>
      </div>
    </div>
  )
}
