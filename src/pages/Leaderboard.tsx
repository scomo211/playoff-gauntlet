import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

interface LeaderboardEntry {
  id: string
  entry_name: string
  display_name: string
  total_points: number
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [payoutSpots, setPayoutSpots] = useState(4)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select(`
            id,
            entry_name,
            profile:profiles(display_name),
            lineups(total_points)
          `)
          .eq('is_active', true)

        if (error) throw error

        // Calculate total points and format data
        const formatted = data.map(entry => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profile = entry.profile as any
          const displayName = Array.isArray(profile)
            ? profile[0]?.display_name
            : profile?.display_name
          return {
            id: entry.id,
            entry_name: entry.entry_name,
            display_name: displayName || 'Unknown',
            total_points: entry.lineups?.reduce((sum: number, l: { total_points: number }) => sum + (l.total_points || 0), 0) || 0
          }
        })

        // Sort by total points descending
        formatted.sort((a, b) => b.total_points - a.total_points)
        setEntries(formatted)

        // Calculate payout spots
        const count = formatted.length
        if (count >= 100) setPayoutSpots(10)
        else if (count >= 90) setPayoutSpots(9)
        else if (count >= 80) setPayoutSpots(8)
        else if (count >= 70) setPayoutSpots(7)
        else if (count >= 60) setPayoutSpots(6)
        else if (count >= 50) setPayoutSpots(5)
        else setPayoutSpots(4)

      } catch (err) {
        console.error('Failed to fetch leaderboard:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="mt-1 text-slate-400">
          {entries.length} entries competing for top {payoutSpots} payout spots
        </p>
      </div>

      <div className="card-solid overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
          </div>
        ) : entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Entry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Wk 1
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Wk 2
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Wk 3
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Wk 4
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {entries.map((entry, index) => {
                  const rank = index + 1
                  const inTheMoney = rank <= payoutSpots

                  return (
                    <tr
                      key={entry.id}
                      className={inTheMoney ? 'bg-field-500/5' : 'hover:bg-slate-800/30'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                            {rank}
                          </span>
                          {inTheMoney && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                              $
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{entry.entry_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-400">{entry.display_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-500">--</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-bold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                          {entry.total_points.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No entries yet. Be the first to join!
          </div>
        )}
      </div>

      <div className="mt-6 card p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gold-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-slate-300">
            <p className="font-medium">In the Money</p>
            <p className="mt-1 text-slate-400">
              Highlighted rows are currently in payout position. Top {payoutSpots} entries win prizes.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
