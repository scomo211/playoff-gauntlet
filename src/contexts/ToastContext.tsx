import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
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
}

interface TouchdownEvent {
  player_id: string
  player_name: string
  td_type: 'pass' | 'rush' | 'rec'
  yards: number
  week_id: number
}

interface ToastContextType {
  showToast: (notification: Omit<ToastNotification, 'id'>) => void
  showTouchdownToast: (event: TouchdownEvent) => void
  testTouchdownToast: () => void
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
  const [shownTouchdowns, setShownTouchdowns] = useState<Set<string>>(new Set())
  const [userLineupPlayerIds, setUserLineupPlayerIds] = useState<Set<string>>(new Set())
  const [lastCheckedStats, setLastCheckedStats] = useState<Map<string, { pass_td: number; rush_td: number; rec_td: number }>>(new Map())

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

  // Poll for touchdown updates
  useEffect(() => {
    if (userLineupPlayerIds.size === 0) return

    async function checkForTouchdowns() {
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

        // Check for new touchdowns
        for (const stat of stats) {
          const lastStats = lastCheckedStats.get(stat.player_id)
          const playerName = playerMap.get(stat.player_id) || 'Unknown'

          if (lastStats) {
            // Check for new passing TDs
            if (stat.pass_td > lastStats.pass_td) {
              const newTDs = stat.pass_td - lastStats.pass_td
              for (let i = 0; i < newTDs; i++) {
                const tdKey = `${stat.player_id}-pass-${stat.pass_td - i}-${weekData.id}`
                if (!shownTouchdowns.has(tdKey)) {
                  showTouchdownToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    td_type: 'pass',
                    yards: Math.round(stat.pass_yards / stat.pass_td), // Approximate
                    week_id: weekData.id
                  })
                  setShownTouchdowns(prev => new Set([...prev, tdKey]))
                }
              }
            }

            // Check for new rushing TDs
            if (stat.rush_td > lastStats.rush_td) {
              const newTDs = stat.rush_td - lastStats.rush_td
              for (let i = 0; i < newTDs; i++) {
                const tdKey = `${stat.player_id}-rush-${stat.rush_td - i}-${weekData.id}`
                if (!shownTouchdowns.has(tdKey)) {
                  showTouchdownToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    td_type: 'rush',
                    yards: Math.round(stat.rush_yards / stat.rush_td), // Approximate
                    week_id: weekData.id
                  })
                  setShownTouchdowns(prev => new Set([...prev, tdKey]))
                }
              }
            }

            // Check for new receiving TDs
            if (stat.rec_td > lastStats.rec_td) {
              const newTDs = stat.rec_td - lastStats.rec_td
              for (let i = 0; i < newTDs; i++) {
                const tdKey = `${stat.player_id}-rec-${stat.rec_td - i}-${weekData.id}`
                if (!shownTouchdowns.has(tdKey)) {
                  showTouchdownToast({
                    player_id: stat.player_id,
                    player_name: playerName,
                    td_type: 'rec',
                    yards: Math.round(stat.rec_yards / stat.rec_td), // Approximate
                    week_id: weekData.id
                  })
                  setShownTouchdowns(prev => new Set([...prev, tdKey]))
                }
              }
            }
          }

          // Update last checked stats
          setLastCheckedStats(prev => new Map(prev).set(stat.player_id, {
            pass_td: stat.pass_td || 0,
            rush_td: stat.rush_td || 0,
            rec_td: stat.rec_td || 0
          }))
        }
      } catch (err) {
        console.error('Failed to check for touchdowns:', err)
      }
    }

    // Initial check
    checkForTouchdowns()

    // Poll every 30 seconds during games
    const interval = setInterval(checkForTouchdowns, 30000)
    return () => clearInterval(interval)
  }, [userLineupPlayerIds, lastCheckedStats, shownTouchdowns])

  // Process queue - show next toast when current one is done
  useEffect(() => {
    if (!currentToast && queue.length > 0) {
      const [next, ...rest] = queue
      setCurrentToast(next)
      setQueue(rest)
      setIsVisible(true)
    }
  }, [currentToast, queue])

  const showToast = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setQueue(prev => [...prev, { ...notification, id }])
  }, [])

  const showTouchdownToast = useCallback((event: TouchdownEvent) => {
    const tdTypeLabel = event.td_type === 'pass' ? 'Touchdown Pass' :
                        event.td_type === 'rush' ? 'Touchdown Run' :
                        'Touchdown Reception'

    showToast({
      type: 'touchdown',
      message: event.player_name,
      subMessage: `${event.yards} Yard ${tdTypeLabel}`,
      imageUrl: getPlayerHeadshotUrl(event.player_id),
      duration: 4000
    })
  }, [showToast])

  // Test function for development
  const testTouchdownToast = useCallback(() => {
    // Drake Maye throws 67-yard TD pass
    showTouchdownToast({
      player_id: '11564',
      player_name: 'Drake Maye',
      td_type: 'pass',
      yards: 67,
      week_id: 1
    })

    // Nico Collins catches 67-yard TD reception
    setTimeout(() => {
      showTouchdownToast({
        player_id: '7569',
        player_name: 'Nico Collins',
        td_type: 'rec',
        yards: 67,
        week_id: 1
      })
    }, 100)
  }, [showTouchdownToast])

  const handleToastClose = useCallback(() => {
    setIsVisible(false)
    // Wait for exit animation
    setTimeout(() => {
      setCurrentToast(null)
    }, 300)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, showTouchdownToast, testTouchdownToast }}>
      {children}

      {/* Global Toast Display */}
      {currentToast && (
        <GlobalToast
          notification={currentToast}
          isVisible={isVisible}
          onClose={handleToastClose}
        />
      )}
    </ToastContext.Provider>
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

  useEffect(() => {
    if (isVisible) {
      // Trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setTimeout(onClose, 300)
      }, notification.duration || 3500)

      return () => clearTimeout(timer)
    }
  }, [isVisible, notification.duration, onClose])

  const isTouchdown = notification.type === 'touchdown'

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
        className={`relative bg-slate-900 border ${isTouchdown ? 'border-gold-500/30' : 'border-slate-700'} rounded-2xl shadow-2xl shadow-black/50 px-8 py-6 transform transition-all duration-300 ${
          isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
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

          {/* Touchdown celebration icon */}
          {isTouchdown && (
            <div className="text-2xl">🏈</div>
          )}
        </div>
      </div>
    </div>
  )
}
