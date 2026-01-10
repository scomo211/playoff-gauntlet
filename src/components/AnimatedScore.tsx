import { useState, useEffect, useRef } from 'react'

interface AnimatedScoreProps {
  value: number
  decimals?: number
  className?: string
  duration?: number // animation duration in ms
}

export default function AnimatedScore({
  value,
  decimals = 1,
  className = '',
  duration = 800
}: AnimatedScoreProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const previousValue = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip animation on initial render or if value hasn't changed
    if (previousValue.current === value) return

    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()

    setIsAnimating(true)

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)

      const currentValue = startValue + (endValue - startValue) * eased
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        setIsAnimating(false)
        previousValue.current = endValue
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  // Update previous value ref when value changes (for initial render)
  useEffect(() => {
    if (previousValue.current !== value && !isAnimating) {
      previousValue.current = value
    }
  }, [value, isAnimating])

  return (
    <span
      className={`
        ${className}
        ${isAnimating ? 'animate-score-highlight' : ''}
        transition-colors duration-300
      `}
    >
      {displayValue.toFixed(decimals)}
    </span>
  )
}
