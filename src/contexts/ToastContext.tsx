import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { getPlayerHeadshotUrl } from '../lib/playerImages'

interface ToastNotification {
  id: string
  type: 'lineup_submitted' | 'touchdown' | 'success' | 'error'
  message: string
  subMessage?: string
  imageUrl?: string
  duration?: number
  pointsScored?: number
}

interface MiniToastNotification {
  id: string
  playerId: string
  playerName: string
  playDescription: string
  points: number
}

interface BigPlayEvent {
  player_id: string
  player_name: string
  play_type: 'pass' | 'rush' | 'rec'
  yards: number
  isTouchdown: boolean
  week_id: number
}

// Calculate fantasy points for a play based on league scoring
function calculatePlayPoints(playType: 'pass' | 'rush' | 'rec', yards: number, isTouchdown: boolean): number {
  const TD_POINTS = isTouchdown ? 6 : 0

  if (playType === 'pass') {
    // Passing: 0.04/yard + 6 TD
    return TD_POINTS + (yards * 0.04)
  } else if (playType === 'rush') {
    // Rushing: 0.1/yard + 6 TD
    return TD_POINTS + (yards * 0.1)
  } else {
    // Receiving: 0.1/yard + 0.5 (half PPR) + 6 TD
    return TD_POINTS + (yards * 0.1) + 0.5
  }
}

// Minimum points threshold to show a big play toast (center screen with confetti)
const BIG_PLAY_POINTS_THRESHOLD = 4

// Minimum points threshold to show a mini toast (bottom center, simple)
const MINI_PLAY_POINTS_THRESHOLD = 0.5

interface MiniPlayEvent {
  playerId: string
  playerName: string
  playDescription: string
  points: number
}

interface ToastContextType {
  showToast: (notification: Omit<ToastNotification, 'id'>) => void
  showBigPlayToast: (event: BigPlayEvent) => void
  showMiniToast: (event: MiniPlayEvent) => void
  testBigPlayToast: () => void
  testMiniToast: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { user } = useAuth()
  const [queue, setQueue] = useState<ToastNotification[]>([])
  const [currentToast, setCurrentToast] = useState<ToastNotification | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [userLineupPlayerIds, setUserLineupPlayerIds] = useState<Set<string>>(new Set())
  // Use refs instead of state to avoid re-triggering the useEffect
  const shownPlaysRef = useRef<Set<string>>(new Set())
  const lastCheckedStatsRef = useRef<Map<string, {
    pass_td: number; rush_td: number; rec_td: number;
    pass_yards: number; rush_yards: number; rec_yards: number
  }>>(new Map())

  // Mini toast state (separate from main toasts)
  const [miniToastQueue, setMiniToastQueue] = useState<MiniToastNotification[]>([])
  const [currentMiniToast, setCurrentMiniToast] = useState<MiniToastNotification | null>(null)
  const [isMiniVisible, setIsMiniVisible] = useState(false)

  // Fetch user's lineup player IDs across all their entries
  useEffect(() => {
    async function fetchUserLineupPlayers() {
      if (!user) {
        setUserLineupPlayerIds(new Set())
        return
      }

      try {
        // Get current week
        const { data: weekData } = await supabase
          .from('weeks')
          .select('id')
          .eq('is_current', true)
          .single()

        if (!weekData) return

        // Get all user's entries
        const { data: entries } = await supabase
          .from('entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (!entries || entries.length === 0) return

        // Get all lineup players for current week
        const entryIds = entries.map(e => e.id)
        const { data: lineups } = await supabase
          .from('lineups')
          .select('id')
          .in('entry_id', entryIds)
          .eq('week_id', weekData.id)
          .eq('is_submitted', true)

        if (!lineups || lineups.length === 0) return

        const lineupIds = lineups.map(l => l.id)
        const { data: lineupPlayers } = await supabase
          .from('lineup_players')
          .select('player_id')
          .in('lineup_id', lineupIds)

        if (lineupPlayers) {
          const playerIds = new Set(lineupPlayers.map(lp => lp.player_id))
          setUserLineupPlayerIds(playerIds)
        }
      } catch (err) {
        console.error('Failed to fetch lineup players:', err)
      }
    }

    fetchUserLineupPlayers()
    // Refresh every 5 minutes
    const interval = setInterval(fetchUserLineupPlayers, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Poll for big play updates (TDs and big yardage plays)
  useEffect(() => {
    if (userLineupPlayerIds.size === 0) return

    async function checkForBigPlays() {
      try {
        // Get current week
        const { data: weekData } = await supabase
          .from('weeks')
          .select('id')
          .eq('is_current', true)
          .single()

        if (!weekData) return

        // Get stats for players in user's lineups
        const playerIds = Array.from(userLineupPlayerIds)
        const { data: stats } = await supabase
          .from('player_weekly_stats')
          .select('player_id, pass_td, rush_td, rec_td, pass_yards, rush_yards, rec_yards')
          .eq('week_id', weekData.id)
          .in('player_id', playerIds)

        if (!stats) return

        // Get player names
        const { data: players } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds)

        const playerMap = new Map(players?.map(p => [p.id, p.name]) || [])

        // Check for new big plays
        for (const stat of stats) {
          const lastStats = lastCheckedStatsRef.current.get(stat.player_id)
          const playerName = playerMap.get(stat.player_id) || 'Unknown'

          if (lastStats) {
            // Check for new passing TDs
            if (stat.pass_td > lastStats.pass_td) {
              const newTDs = stat.pass_td - lastStats.pass_td
              for (let i = 0; i < newTDs; i++) {
                const playKey = `${stat.player_id}-pass-td-${stat.pass_td - i}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  const yards = Math.round(stat.pass_yards / stat.pass_td)
                  showBigPlayToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    play_type: 'pass',
                    yards,
                    isTouchdown: true,
                    week_id: weekData.id
                  })
                }
              }
            }

            // Check for new rushing TDs
            if (stat.rush_td > lastStats.rush_td) {
              const newTDs = stat.rush_td - lastStats.rush_td
              for (let i = 0; i < newTDs; i++) {
                const playKey = `${stat.player_id}-rush-td-${stat.rush_td - i}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  const yards = Math.round(stat.rush_yards / stat.rush_td)
                  showBigPlayToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    play_type: 'rush',
                    yards,
                    isTouchdown: true,
                    week_id: weekData.id
                  })
                }
              }
            }

            // Check for new receiving TDs
            if (stat.rec_td > lastStats.rec_td) {
              const newTDs = stat.rec_td - lastStats.rec_td
              for (let i = 0; i < newTDs; i++) {
                const playKey = `${stat.player_id}-rec-td-${stat.rec_td - i}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  const yards = Math.round(stat.rec_yards / stat.rec_td)
                  showBigPlayToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    play_type: 'rec',
                    yards,
                    isTouchdown: true,
                    week_id: weekData.id
                  })
                }
              }
            }

            // Check for big yardage plays (non-TD)
            // Only check if no new TDs on this play type to avoid duplicate notifications

            // Rushing play
            if (stat.rush_td === lastStats.rush_td) {
              const rushYardGain = (stat.rush_yards || 0) - (lastStats.rush_yards || 0)
              if (rushYardGain > 0) {
                const points = calculatePlayPoints('rush', rushYardGain, false)
                const playKey = `${stat.player_id}-rush-${stat.rush_yards}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  if (points >= BIG_PLAY_POINTS_THRESHOLD) {
                    // Big play - center screen toast with confetti
                    showBigPlayToast({
                      player_id: stat.player_id,
                      player_name: playerName,
                      play_type: 'rush',
                      yards: rushYardGain,
                      isTouchdown: false,
                      week_id: weekData.id
                    })
                  } else if (points >= MINI_PLAY_POINTS_THRESHOLD) {
                    // Smaller play - mini toast at bottom
                    showMiniToast({
                      playerId: stat.player_id,
                      playerName,
                      playDescription: `${rushYardGain} Yard Rush`,
                      points
                    })
                  }
                }
              }
            }

            // Receiving play
            if (stat.rec_td === lastStats.rec_td) {
              const recYardGain = (stat.rec_yards || 0) - (lastStats.rec_yards || 0)
              if (recYardGain > 0) {
                const points = calculatePlayPoints('rec', recYardGain, false)
                const playKey = `${stat.player_id}-rec-${stat.rec_yards}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  if (points >= BIG_PLAY_POINTS_THRESHOLD) {
                    // Big play - center screen toast with confetti
                    showBigPlayToast({
                      player_id: stat.player_id,
                      player_name: playerName,
                      play_type: 'rec',
                      yards: recYardGain,
                      isTouchdown: false,
                      week_id: weekData.id
                    })
                  } else if (points >= MINI_PLAY_POINTS_THRESHOLD) {
                    // Smaller play - mini toast at bottom
                    showMiniToast({
                      playerId: stat.player_id,
                      playerName,
                      playDescription: `${recYardGain} Yard Reception`,
                      points
                    })
                  }
                }
              }
            }

            // Passing play
            if (stat.pass_td === lastStats.pass_td) {
              const passYardGain = (stat.pass_yards || 0) - (lastStats.pass_yards || 0)
              if (passYardGain > 0) {
                const points = calculatePlayPoints('pass', passYardGain, false)
                const playKey = `${stat.player_id}-pass-${stat.pass_yards}-${weekData.id}`
                if (!shownPlaysRef.current.has(playKey)) {
                  shownPlaysRef.current.add(playKey)
                  if (points >= BIG_PLAY_POINTS_THRESHOLD) {
                    // Big play - center screen toast with confetti
                    showBigPlayToast({
                      player_id: stat.player_id,
                      player_name: playerName,
                      play_type: 'pass',
                      yards: passYardGain,
                      isTouchdown: false,
                      week_id: weekData.id
                    })
                  } else if (points >= MINI_PLAY_POINTS_THRESHOLD) {
                    // Smaller play - mini toast at bottom
                    showMiniToast({
                      playerId: stat.player_id,
                      playerName,
                      playDescription: `${passYardGain} Yard Pass`,
                      points
                    })
                  }
                }
              }
            }
          }

          // Update last checked stats
          lastCheckedStatsRef.current.set(stat.player_id, {
            pass_td: stat.pass_td || 0,
            rush_td: stat.rush_td || 0,
            rec_td: stat.rec_td || 0,
            pass_yards: stat.pass_yards || 0,
            rush_yards: stat.rush_yards || 0,
            rec_yards: stat.rec_yards || 0
          })
        }
      } catch (err) {
        console.error('Failed to check for big plays:', err)
      }
    }

    // Initial check
    checkForBigPlays()

    // Poll every 30 seconds during games
    const interval = setInterval(checkForBigPlays, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLineupPlayerIds])

  // Process queue - show next toast when current one is done
  useEffect(() => {
    if (!currentToast && queue.length > 0) {
      const [next, ...rest] = queue
      setCurrentToast(next)
      setQueue(rest)
      setIsVisible(true)
    }
  }, [currentToast, queue])

  // Process mini toast queue - show next mini toast when current one is done
  useEffect(() => {
    if (!currentMiniToast && miniToastQueue.length > 0) {
      const [next, ...rest] = miniToastQueue
      setCurrentMiniToast(next)
      setMiniToastQueue(rest)
      setIsMiniVisible(true)
    }
  }, [currentMiniToast, miniToastQueue])

  const showToast = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setQueue(prev => [...prev, { ...notification, id }])
  }, [])

  const showBigPlayToast = useCallback((event: BigPlayEvent) => {
    let playLabel: string
    if (event.isTouchdown) {
      playLabel = event.play_type === 'pass' ? 'Touchdown Pass' :
                  event.play_type === 'rush' ? 'Touchdown Rush' :
                  'Touchdown Reception'
    } else {
      playLabel = event.play_type === 'pass' ? 'Pass' :
                  event.play_type === 'rush' ? 'Rush' :
                  'Reception'
    }

    const points = calculatePlayPoints(event.play_type, event.yards, event.isTouchdown)

    showToast({
      type: 'touchdown', // Keep type as 'touchdown' for styling (big play)
      message: event.player_name,
      subMessage: `${event.yards}-Yard ${playLabel}`,
      imageUrl: getPlayerHeadshotUrl(event.player_id),
      pointsScored: points,
      duration: 4000
    })
  }, [showToast])

  const showMiniToast = useCallback((event: MiniPlayEvent) => {
    const id = `mini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setMiniToastQueue(prev => [...prev, {
      id,
      playerId: event.playerId,
      playerName: event.playerName,
      playDescription: event.playDescription,
      points: event.points
    }])
  }, [])

  // Test function for development
  const testMiniToast = useCallback(() => {
    showMiniToast({
      playerId: '4034',
      playerName: 'Christian McCaffrey',
      playDescription: '13 Yard Reception',
      points: 1.8
    })
    setTimeout(() => {
      showMiniToast({
        playerId: '4866',
        playerName: 'Saquon Barkley',
        playDescription: '8 Yard Rush',
        points: 0.8
      })
    }, 500)
    setTimeout(() => {
      showMiniToast({
        playerId: '3918',
        playerName: 'Josh Allen',
        playDescription: '24 Yard Pass',
        points: 1.0
      })
    }, 1000)
  }, [showMiniToast])

  // Test function for development
  const testBigPlayToast = useCallback(() => {
    // Drake Maye throws 67-yard TD pass
    showBigPlayToast({
      player_id: '11564',
      player_name: 'Drake Maye',
      play_type: 'pass',
      yards: 67,
      isTouchdown: true,
      week_id: 1
    })

    // Nico Collins catches 67-yard TD reception
    setTimeout(() => {
      showBigPlayToast({
        player_id: '7569',
        player_name: 'Nico Collins',
        play_type: 'rec',
        yards: 67,
        isTouchdown: true,
        week_id: 1
      })
    }, 100)

    // Saquon Barkley 42-yard rush (non-TD big play)
    setTimeout(() => {
      showBigPlayToast({
        player_id: '4866',
        player_name: 'Saquon Barkley',
        play_type: 'rush',
        yards: 42,
        isTouchdown: false,
        week_id: 1
      })
    }, 200)
  }, [showBigPlayToast])

  const handleToastClose = useCallback(() => {
    setIsVisible(false)
    // Wait for exit animation
    setTimeout(() => {
      setCurrentToast(null)
    }, 300)
  }, [])

  const handleMiniToastClose = useCallback(() => {
    setIsMiniVisible(false)
    // Wait for exit animation
    setTimeout(() => {
      setCurrentMiniToast(null)
    }, 300)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, showBigPlayToast, showMiniToast, testBigPlayToast, testMiniToast }}>
      {children}

      {/* Global Toast Display */}
      {currentToast && (
        <GlobalToast
          notification={currentToast}
          isVisible={isVisible}
          onClose={handleToastClose}
        />
      )}

      {/* Mini Toast Display (bottom center) */}
      {currentMiniToast && (
        <MiniToast
          notification={currentMiniToast}
          isVisible={isMiniVisible}
          onClose={handleMiniToastClose}
        />
      )}
    </ToastContext.Provider>
  )
}

// Confetti particle interface
interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  opacity: number
}

// Confetti animation component
function Confetti({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<ConfettiParticle[]>([])
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isActive || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to window size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Confetti colors - gold and field green theme
    const colors = ['#fbbf24', '#f59e0b', '#d97706', '#10b981', '#059669', '#34d399', '#ffffff']

    // Create particles emanating from center
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const particleCount = 80

    particlesRef.current = []
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5
      const speed = 8 + Math.random() * 12
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5, // Initial upward bias
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 1
      })
    }

    const gravity = 0.3
    const friction = 0.99

    function animate() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let activeParticles = 0
      for (const particle of particlesRef.current) {
        if (particle.opacity <= 0) continue
        activeParticles++

        // Apply physics
        particle.vy += gravity
        particle.vx *= friction
        particle.vy *= friction
        particle.x += particle.vx
        particle.y += particle.vy
        particle.rotation += particle.rotationSpeed

        // Fade out based on distance from center and time
        particle.opacity -= 0.012

        // Draw particle
        ctx.save()
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        ctx.globalAlpha = Math.max(0, particle.opacity)
        ctx.fillStyle = particle.color
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6)
        ctx.restore()
      }

      if (activeParticles > 0) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive])

  if (!isActive) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}

// Internal component for displaying toasts
interface GlobalToastProps {
  notification: ToastNotification
  isVisible: boolean
  onClose: () => void
}

function GlobalToast({ notification, isVisible, onClose }: GlobalToastProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
          // Trigger confetti for touchdown toasts
          if (notification.type === 'touchdown') {
            setShowConfetti(true)
          }
        })
      })

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setShowConfetti(false)
        setTimeout(onClose, 300)
      }, notification.duration || 3500)

      return () => clearTimeout(timer)
    }
  }, [isVisible, notification.duration, notification.type, onClose])

  const isTouchdown = notification.type === 'touchdown'

  return (
    <>
      {/* Confetti overlay for touchdowns */}
      {isTouchdown && <Confetti isActive={showConfetti} />}

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            isAnimating ? 'opacity-100' : 'opacity-0'
          }`}
        />

      {/* Toast Card */}
      <div
        className={`relative bg-slate-900 border ${isTouchdown ? 'border-field-500/50' : 'border-slate-700'} rounded-2xl shadow-2xl shadow-black/50 px-8 py-6 transform transition-all duration-300 ${
          isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Big Play Tag */}
          {isTouchdown && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-field-500/10 text-field-400 border border-field-500/20">
              Big Play
              <span className="text-sm">🎉</span>
            </span>
          )}

          {/* Icon/Image */}
          {notification.type === 'touchdown' && notification.imageUrl ? (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/10 border-2 border-gold-500/50 flex items-center justify-center overflow-hidden animate-bounce-once shadow-lg shadow-gold-500/20">
              <img
                src={notification.imageUrl}
                alt={notification.message}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/favicon.png'
                }}
              />
            </div>
          ) : notification.type === 'lineup_submitted' ? (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-field-500/20 to-field-600/10 border border-field-500/30 flex items-center justify-center animate-bounce-once">
              <img src="/favicon.png" alt="Playoff Gauntlet" className="w-10 h-10" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center animate-bounce-once">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Message */}
          <div className="text-center">
            <p className={`text-lg font-bold ${isTouchdown ? 'text-gold-400' : 'text-white'}`}>
              {notification.message}
            </p>
            {notification.subMessage && (
              <p className="text-sm text-slate-400 mt-1">
                {notification.subMessage}
              </p>
            )}
          </div>

          {/* Touchdown points display */}
          {isTouchdown && notification.pointsScored !== undefined && (
            <div className="text-2xl font-bold text-field-400">
              +{notification.pointsScored.toFixed(1)} Points
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  )
}

// Mini toast component for small play updates (bottom center)
interface MiniToastProps {
  notification: MiniToastNotification
  isVisible: boolean
  onClose: () => void
}

function MiniToast({ notification, isVisible, onClose }: MiniToastProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })

      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setTimeout(onClose, 300)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className={`
          bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-xl shadow-black/30
          pl-3 pr-5 py-2.5 flex items-center gap-4
          transform transition-all duration-300 ease-out
          ${isAnimating
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
          }
        `}
      >
        {/* Player headshot */}
        <img
          src={getPlayerHeadshotUrl(notification.playerId)}
          alt={notification.playerName}
          className="w-10 h-10 rounded-full bg-slate-700 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/favicon.png'
          }}
        />

        {/* Player name and play description */}
        <div className="flex flex-col">
          <span className="text-base font-medium text-white leading-tight">{notification.playerName}</span>
          <span className="text-sm text-slate-400 leading-tight">{notification.playDescription}</span>
        </div>

        {/* Points */}
        <div className={`text-2xl font-bold ${notification.points >= 0 ? 'text-field-400' : 'text-red-400'}`}>
          {notification.points >= 0 ? '+' : ''}{notification.points.toFixed(1)}
        </div>
      </div>
    </div>
  )
}
