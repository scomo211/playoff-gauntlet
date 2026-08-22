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
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  // Start/stop bot loop
  useEffect(() => {
    if (enabled && auctionId && isTest && isActive) {
      setIsRunning(true)
      // Random interval between 2-4 seconds for natural feel
      const runTick = () => {
        tick()
        const nextDelay = 2000 + Math.random() * 2000 // 2-4 seconds
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
    manualTick: tick,
  }
}
