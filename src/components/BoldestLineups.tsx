import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { areLineupsLocked } from '../lib/kickoff'

interface BoldEntry {
  entry_id: string
  entry_name: string
  display_name: string
  bold_pick_count: number
}

interface BoldestLineupsProps {
  weekId: number
}

export default function BoldestLineups({ weekId }: BoldestLineupsProps) {
  const [boldEntries, setBoldEntries] = useState<BoldEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLineups, setTotalLineups] = useState(0)

  useEffect(() => {
    async function fetchBoldestLineups() {
      setLoading(true)

      // First get total submitted lineups for this week
      const { count: lineupCount } = await supabase
        .from('lineups')
        .select('*', { count: 'exact', head: true })
        .eq('week_id', weekId)
        .eq('is_submitted', true)

      setTotalLineups(lineupCount || 0)

      if (!lineupCount || lineupCount === 0) {
        setBoldEntries([])
        setLoading(false)
        return
      }

      // Get all lineup players for submitted lineups this week
      const { data: lineupPlayers, error } = await supabase
        .from('lineup_players')
        .select(`
          player_id,
          lineup:lineups!inner(
            id,
            week_id,
            is_submitted,
            entry:entries(id, entry_name, profile:profiles(display_name))
          )
        `)
        .eq('lineup.week_id', weekId)
        .eq('lineup.is_submitted', true)

      if (error) {
        console.error('Error fetching boldest lineups:', error)
        setLoading(false)
        return
      }

      // Count occurrences per player
      const playerCounts: Record<string, number> = {}

      // Track picks per entry
      const entryPicks: Record<string, {
        entry_id: string
        entry_name: string
        display_name: string
        player_ids: string[]
      }> = {}

      lineupPlayers?.forEach((lp) => {
        const playerId = lp.player_id
        playerCounts[playerId] = (playerCounts[playerId] || 0) + 1

        // Track entry picks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lineupData = lp.lineup as any
        const lineup = Array.isArray(lineupData) ? lineupData[0] : lineupData
        if (lineup?.entry) {
          const entryData = Array.isArray(lineup.entry) ? lineup.entry[0] : lineup.entry
          if (entryData) {
            const entryId = entryData.id
            if (!entryPicks[entryId]) {
              const profileData = entryData.profile
              const profile = Array.isArray(profileData) ? profileData[0] : profileData
              entryPicks[entryId] = {
                entry_id: entryId,
                entry_name: entryData.entry_name,
                display_name: profile?.display_name || 'Unknown',
                player_ids: []
              }
            }
            if (!entryPicks[entryId].player_ids.includes(playerId)) {
              entryPicks[entryId].player_ids.push(playerId)
            }
          }
        }
      })

      // Calculate bold picks for each entry
      // A "bold pick" is any player in 3 or fewer lineups total
      const entryBoldness: BoldEntry[] = Object.values(entryPicks).map(entry => {
        let boldPickCount = 0

        entry.player_ids.forEach(playerId => {
          const pickCount = playerCounts[playerId] || 0
          if (pickCount <= 3) {
            boldPickCount++
          }
        })

        return {
          entry_id: entry.entry_id,
          entry_name: entry.entry_name,
          display_name: entry.display_name,
          bold_pick_count: boldPickCount
        }
      })

      // Sort by bold pick count (highest first) and take top 3
      entryBoldness.sort((a, b) => b.bold_pick_count - a.bold_pick_count)
      setBoldEntries(entryBoldness.slice(0, 3))

      setLoading(false)
    }

    fetchBoldestLineups()
  }, [weekId])

  if (loading) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14c.55 0 1 .45 1 1v2c0 2.55-1.92 4.63-4.39 4.94.29.62.39 1.31.39 2.06v7c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-7c0-.75.1-1.44.39-2.06C5.92 10.63 4 8.55 4 6V4c0-.55.45-1 1-1zm2 2v1c0 1.66 1.34 3 3 3h4c1.66 0 3-1.34 3-3V5H7zm3 14h4v-5h-4v5z"/>
          </svg>
          Boldest Lineups
        </h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-gold-500"></div>
        </div>
      </div>
    )
  }

  if (totalLineups === 0 || boldEntries.length === 0 || boldEntries[0].bold_pick_count === 0) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14c.55 0 1 .45 1 1v2c0 2.55-1.92 4.63-4.39 4.94.29.62.39 1.31.39 2.06v7c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-7c0-.75.1-1.44.39-2.06C5.92 10.63 4 8.55 4 6V4c0-.55.45-1 1-1zm2 2v1c0 1.66 1.34 3 3 3h4c1.66 0 3-1.34 3-3V5H7zm3 14h4v-5h-4v5z"/>
          </svg>
          Boldest Lineups
        </h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No bold picks yet for Week {weekId}
        </p>
      </div>
    )
  }

  // Hide results until lineups are locked
  if (!areLineupsLocked()) {
    return (
      <div className="card-solid p-6 h-full">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14c.55 0 1 .45 1 1v2c0 2.55-1.92 4.63-4.39 4.94.29.62.39 1.31.39 2.06v7c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-7c0-.75.1-1.44.39-2.06C5.92 10.63 4 8.55 4 6V4c0-.55.45-1 1-1zm2 2v1c0 1.66 1.34 3 3 3h4c1.66 0 3-1.34 3-3V5H7zm3 14h4v-5h-4v5z"/>
          </svg>
          Boldest Lineups
        </h3>
        <div className="flex flex-col items-center justify-center py-12">
          <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-slate-400 text-sm text-center">
            Results revealed at kickoff
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-solid p-6 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14c.55 0 1 .45 1 1v2c0 2.55-1.92 4.63-4.39 4.94.29.62.39 1.31.39 2.06v7c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-7c0-.75.1-1.44.39-2.06C5.92 10.63 4 8.55 4 6V4c0-.55.45-1 1-1zm2 2v1c0 1.66 1.34 3 3 3h4c1.66 0 3-1.34 3-3V5H7zm3 14h4v-5h-4v5z"/>
          </svg>
          Boldest Lineups
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Entries with the most contrarian picks
      </p>

      {/* Podium Layout: Silver (left) - Gold (center, bigger) - Bronze (right) */}
      <div className="flex items-end justify-center gap-3 sm:gap-4">
        {/* Silver - 2nd place (left) */}
        {boldEntries[1] && (
          <div className="flex-1 max-w-[160px]">
            <div className="rounded-xl border p-3 sm:p-4 transition bg-gradient-to-b from-slate-400/20 to-slate-500/10 border-slate-400/40 hover:border-slate-300">
              <div className="flex flex-col items-center text-center">
                {/* Silver Trophy */}
                <div className="mb-2">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 17L7 22H17L12 17Z" fill="#9CA3AF"/>
                    <path d="M8 22H16V20H8V22Z" fill="#6B7280"/>
                    <path d="M5 2H19V4C19 7.31 16.31 10 13 10H11C7.69 10 5 7.31 5 4V2Z" fill="#D1D5DB"/>
                    <path d="M7 2H17V4C17 6.21 15.21 8 13 8H11C8.79 8 7 6.21 7 4V2Z" fill="#E5E7EB"/>
                    <path d="M10 10H14V17H10V10Z" fill="#9CA3AF"/>
                    <path d="M3 3H5V5C5 6.1 4.1 7 3 7V3Z" fill="#D1D5DB"/>
                    <path d="M19 3H21V7C19.9 7 19 6.1 19 5V3Z" fill="#D1D5DB"/>
                  </svg>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-300">
                  Silver
                </div>

                <div className="text-sm font-semibold text-white truncate max-w-full" title={boldEntries[1].entry_name}>
                  {boldEntries[1].entry_name}
                </div>
                <div className="text-xs text-slate-400 truncate max-w-full" title={boldEntries[1].display_name}>
                  {boldEntries[1].display_name}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-700/50 w-full">
                  <div className="text-xl font-bold text-slate-300">
                    {boldEntries[1].bold_pick_count}
                  </div>
                  <div className="text-xs text-slate-500">
                    bold {boldEntries[1].bold_pick_count === 1 ? 'pick' : 'picks'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gold - 1st place (center, biggest) */}
        {boldEntries[0] && (
          <div className="flex-1 max-w-[200px]">
            <div className="rounded-xl border p-4 sm:p-5 transition bg-gradient-to-b from-gold-500/20 to-gold-600/10 border-gold-500/40 hover:border-gold-400 transform sm:scale-105">
              <div className="flex flex-col items-center text-center">
                {/* Gold Trophy */}
                <div className="mb-3">
                  <svg className="w-14 h-14 sm:w-16 sm:h-16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 17L7 22H17L12 17Z" fill="#D97706"/>
                    <path d="M8 22H16V20H8V22Z" fill="#B45309"/>
                    <path d="M5 2H19V4C19 7.31 16.31 10 13 10H11C7.69 10 5 7.31 5 4V2Z" fill="#FBBF24"/>
                    <path d="M7 2H17V4C17 6.21 15.21 8 13 8H11C8.79 8 7 6.21 7 4V2Z" fill="#FCD34D"/>
                    <path d="M10 10H14V17H10V10Z" fill="#D97706"/>
                    <path d="M3 3H5V5C5 6.1 4.1 7 3 7V3Z" fill="#FBBF24"/>
                    <path d="M19 3H21V7C19.9 7 19 6.1 19 5V3Z" fill="#FBBF24"/>
                    <circle cx="12" cy="5" r="1.5" fill="#FEF3C7"/>
                  </svg>
                </div>

                <div className="text-sm font-bold uppercase tracking-wider mb-2 text-gold-400">
                  Gold
                </div>

                <div className="text-base font-semibold text-white truncate max-w-full" title={boldEntries[0].entry_name}>
                  {boldEntries[0].entry_name}
                </div>
                <div className="text-sm text-slate-400 truncate max-w-full" title={boldEntries[0].display_name}>
                  {boldEntries[0].display_name}
                </div>

                <div className="mt-3 pt-3 border-t border-gold-500/30 w-full">
                  <div className="text-3xl font-bold text-gold-400">
                    {boldEntries[0].bold_pick_count}
                  </div>
                  <div className="text-xs text-slate-500">
                    bold {boldEntries[0].bold_pick_count === 1 ? 'pick' : 'picks'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bronze - 3rd place (right) */}
        {boldEntries[2] && (
          <div className="flex-1 max-w-[140px]">
            <div className="rounded-xl border p-3 transition bg-gradient-to-b from-amber-700/20 to-amber-800/10 border-amber-700/40 hover:border-amber-600">
              <div className="flex flex-col items-center text-center">
                {/* Bronze Trophy */}
                <div className="mb-2">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="none">
                    <path d="M12 17L7 22H17L12 17Z" fill="#92400E"/>
                    <path d="M8 22H16V20H8V22Z" fill="#78350F"/>
                    <path d="M5 2H19V4C19 7.31 16.31 10 13 10H11C7.69 10 5 7.31 5 4V2Z" fill="#D97706"/>
                    <path d="M7 2H17V4C17 6.21 15.21 8 13 8H11C8.79 8 7 6.21 7 4V2Z" fill="#F59E0B"/>
                    <path d="M10 10H14V17H10V10Z" fill="#92400E"/>
                    <path d="M3 3H5V5C5 6.1 4.1 7 3 7V3Z" fill="#D97706"/>
                    <path d="M19 3H21V7C19.9 7 19 6.1 19 5V3Z" fill="#D97706"/>
                  </svg>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider mb-1 text-amber-600">
                  Bronze
                </div>

                <div className="text-sm font-semibold text-white truncate max-w-full" title={boldEntries[2].entry_name}>
                  {boldEntries[2].entry_name}
                </div>
                <div className="text-xs text-slate-400 truncate max-w-full" title={boldEntries[2].display_name}>
                  {boldEntries[2].display_name}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-700/50 w-full">
                  <div className="text-lg font-bold text-amber-600">
                    {boldEntries[2].bold_pick_count}
                  </div>
                  <div className="text-xs text-slate-500">
                    bold {boldEntries[2].bold_pick_count === 1 ? 'pick' : 'picks'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center mt-6">
        Bold pick = player rostered in 3 or fewer lineups
      </p>
    </div>
  )
}
