import { useCallback, useRef, useState } from 'react'

type SoundType = 'bid' | 'your-turn' | 'won' | 'outbid' | 'tick'

// Sound definitions using Web Audio API oscillators
const SOUND_CONFIGS: Record<SoundType, { frequency: number; duration: number; type: OscillatorType; gain: number; ramp?: number }> = {
  'bid': { frequency: 800, duration: 0.08, type: 'sine', gain: 0.15 },
  'your-turn': { frequency: 523, duration: 0.4, type: 'sine', gain: 0.25, ramp: 659 }, // C5 -> E5 chime
  'won': { frequency: 523, duration: 0.6, type: 'sine', gain: 0.3, ramp: 784 }, // C5 -> G5 celebration
  'outbid': { frequency: 300, duration: 0.25, type: 'square', gain: 0.12 },
  'tick': { frequency: 1000, duration: 0.05, type: 'sine', gain: 0.1 },
}

export function useAuctionSounds() {
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('auction-sounds-muted') === 'true'
  })
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const playSound = useCallback((sound: SoundType) => {
    if (muted) return

    try {
      const ctx = getAudioContext()
      const config = SOUND_CONFIGS[sound]

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime)

      // Apply frequency ramp for chime effects
      if (config.ramp) {
        oscillator.frequency.linearRampToValueAtTime(config.ramp, ctx.currentTime + config.duration * 0.5)
      }

      // Envelope: quick attack, gradual decay
      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(config.gain, ctx.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + config.duration)
    } catch {
      // Ignore audio errors (e.g., autoplay policy)
    }
  }, [muted, getAudioContext])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const newValue = !prev
      localStorage.setItem('auction-sounds-muted', String(newValue))
      return newValue
    })
  }, [])

  return { playSound, muted, toggleMute }
}
