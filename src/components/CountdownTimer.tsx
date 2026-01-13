import { useState, useEffect } from 'react'

// Divisional Round 2026 - First game kickoff (Saturday, January 17, 2026 at 4:30 PM ET)
// Bills @ Broncos
const KICKOFF_DATE = new Date('2026-01-17T16:30:00-05:00')

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calculateTimeLeft(): TimeLeft | null {
  const now = new Date()
  const difference = KICKOFF_DATE.getTime() - now.getTime()

  if (difference <= 0) {
    return null
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  }
}

interface CountdownTimerProps {
  variant?: 'landing' | 'dashboard'
}

export default function CountdownTimer({ variant = 'landing' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Don't show if kickoff has passed
  if (!timeLeft) {
    return null
  }

  if (variant === 'dashboard') {
    return (
      <div className="mb-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-gold-500/20 via-gold-600/10 to-amber-500/20 border border-gold-500/30 shadow-lg shadow-gold-500/10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4">
          <div className="text-xs sm:text-sm font-semibold text-gold-400 uppercase tracking-wider whitespace-nowrap">
            Countdown to Kickoff
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg sm:text-2xl font-bold text-white">{timeLeft.days}</span>
              <span className="text-[10px] sm:text-xs text-gold-400/70">d</span>
            </div>
            <span className="text-gold-500/50 text-sm sm:text-base">:</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg sm:text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-[10px] sm:text-xs text-gold-400/70">h</span>
            </div>
            <span className="text-gold-500/50 text-sm sm:text-base">:</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg sm:text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-[10px] sm:text-xs text-gold-400/70">m</span>
            </div>
            <span className="text-gold-500/50 text-sm sm:text-base">:</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg sm:text-2xl font-bold text-gold-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
              <span className="text-[10px] sm:text-xs text-gold-400/70">s</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Landing page variant
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
          Countdown to Kickoff
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-white">{timeLeft.days}</div>
            <div className="text-sm text-slate-500 mt-1">days</div>
          </div>
          <span className="text-slate-600 text-3xl sm:text-4xl">:</span>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className="text-sm text-slate-500 mt-1">hours</div>
          </div>
          <span className="text-slate-600 text-3xl sm:text-4xl">:</span>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className="text-sm text-slate-500 mt-1">minutes</div>
          </div>
          <span className="text-slate-600 text-3xl sm:text-4xl">:</span>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-field-400">{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className="text-sm text-slate-500 mt-1">seconds</div>
          </div>
        </div>
      </div>
    </div>
  )
}
