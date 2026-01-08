import { useState, useEffect } from 'react'

interface ToastProps {
  isVisible: boolean
  message: string
  onClose: () => void
  duration?: number
  icon?: 'success' | 'error' | 'logo'
}

export default function Toast({
  isVisible,
  message,
  onClose,
  duration = 3500,
  icon = 'logo'
}: ToastProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Small delay to trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsAnimating(false)
        // Wait for exit animation to complete
        setTimeout(() => {
          setShouldRender(false)
          onClose()
        }, 300)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!shouldRender) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Toast Card */}
      <div
        className={`relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 px-8 py-6 transform transition-all duration-300 ${
          isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Icon */}
          {icon === 'logo' && (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-field-500/20 to-field-600/10 border border-field-500/30 flex items-center justify-center animate-bounce-once">
              <img
                src="/favicon.png"
                alt="Playoff Gauntlet"
                className="w-10 h-10"
              />
            </div>
          )}
          {icon === 'success' && (
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center animate-bounce-once">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {icon === 'error' && (
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center animate-bounce-once">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Message */}
          <p className="text-lg font-semibold text-white text-center">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
