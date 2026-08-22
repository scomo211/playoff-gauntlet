import { useEffect, useRef, useState, useCallback } from 'react'

interface BotTickResult {
  success: boolean
  action?: string
  reason?: string
  player?: string
  amount?: number
  bot_id?: string
  error?: string
}

interface UseAuctionBotsOptions {
  auctionId: string | null
  isTest: boolean
  isActive: boolean
  enabled: boolean
}

export function useAuctionBots({ auctionId, isTest, isActive, enabled }: UseAuctionBotsOptions) {
  const [lastAction, setLastAction] = useState<BotTickResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [tickCount, setTickCount] = useState(0)
  const [hasActiveItem, setHasActiveItem] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasActiveItemRef = useRef(hasActiveItem)

  // Keep ref in sync with state
  useEffect(() => {
    hasActiveItemRef.current = hasActiveItem
  }, [hasActiveItem])

  const tick = useCallback(async () => {
    if (!auctionId || !isTest || !isActive) return

    try {
      const response = await fetch('/api/auction-bot-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auction_id: auctionId }),
      })

      const result: BotTickResult = await response.json()
      setLastAction(result)
      setTickCount(c => c + 1)

      // Track whether there's an active item to adjust tick speed
      if (result.action === 'nominated' || result.action === 'bid') {
        setHasActiveItem(true)
      } else if (result.action === 'waiting' && result.reason?.includes('nominate')) {
        setHasActiveItem(false)
      }

      // Log significant actions
      if (result.action === 'nominated') {
        console.log(`[Bot] Nominated ${result.player} at $${result.amount || 1}`)
      } else if (result.action === 'bid') {
        console.log(`[Bot] Bid $${result.amount} on ${result.player}`)
      }
    } catch (error) {
      console.error('[Bot] Tick error:', error)
    }
  }, [auctionId, isTest, isActive])

  // Start/stop bot loop with adaptive timing
  useEffect(() => {
    if (enabled && auctionId && isTest && isActive) {
      setIsRunning(true)

      const runTick = () => {
        tick()
        // Fast tick (1s) when waiting for nomination, slower (3-5s) during bidding
        const nextDelay = hasActiveItemRef.current
          ? 3000 + Math.random() * 2000  // 3-5 seconds during bidding
          : 1000                          // 1 second when waiting for nomination
        intervalRef.current = setTimeout(runTick, nextDelay)
      }
      runTick()
    } else {
      setIsRunning(false)
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, auctionId, isTest, isActive, tick])

  return {
    isRunning,
    lastAction,
    tickCount,
    hasActiveItem,
    manualTick: tick,
  }
}
