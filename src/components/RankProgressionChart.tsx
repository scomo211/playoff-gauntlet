import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EntryProgression {
  id: string
  entry_name: string
  display_name: string
  total_points: number
  rankAfterWeek1: number
  rankAfterWeek2: number
  rankAfterWeek3: number
  rankAfterWeek4: number
}

interface TooltipData {
  x: number
  y: number
  entry_name: string
  rank: number
  week: number
}

const COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ef4444', // red
  '#84cc16', // lime
  '#f97316', // orange
  '#a855f7', // violet (for 9b tie)
]

// Payout amounts for top 10 (9a and 9b tie for 9th)
const PAYOUTS = [850, 400, 250, 175, 150, 125, 100, 75, 50, 50]

// Rank labels (9a and 9b for the tie)
const RANK_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9a', '9b']

export default function RankProgressionChart() {
  const [entries, setEntries] = useState<EntryProgression[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('entries')
        .select(`
          id,
          entry_name,
          profile:profiles(display_name),
          lineups(week_id, total_points)
        `)
        .eq('is_active', true)

      if (error || !data) {
        setLoading(false)
        return
      }

      // Calculate points after each week for all entries
      const allEntries = data.map(entry => {
        const lineups = entry.lineups as { week_id: number; total_points: number }[] || []
        const profile = entry.profile as { display_name: string } | { display_name: string }[] | null
        const displayName = Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name

        const w1 = lineups.find(l => l.week_id === 1)?.total_points || 0
        const w2 = lineups.find(l => l.week_id === 2)?.total_points || 0
        const w3 = lineups.find(l => l.week_id === 3)?.total_points || 0
        const w4 = lineups.find(l => l.week_id === 4)?.total_points || 0

        return {
          id: entry.id,
          entry_name: entry.entry_name,
          display_name: displayName || 'Unknown',
          pointsAfterWeek1: w1,
          pointsAfterWeek2: w1 + w2,
          pointsAfterWeek3: w1 + w2 + w3,
          pointsAfterWeek4: w1 + w2 + w3 + w4,
        }
      })

      // Calculate ranks after each week
      const rankAfterWeek = (week: 1 | 2 | 3 | 4) => {
        const key = `pointsAfterWeek${week}` as keyof typeof allEntries[0]
        const sorted = [...allEntries].sort((a, b) => (b[key] as number) - (a[key] as number))
        const ranks = new Map<string, number>()
        sorted.forEach((e, i) => ranks.set(e.id, i + 1))
        return ranks
      }

      const ranksW1 = rankAfterWeek(1)
      const ranksW2 = rankAfterWeek(2)
      const ranksW3 = rankAfterWeek(3)
      const ranksW4 = rankAfterWeek(4)

      // Get top 10 by final standings (includes 9a and 9b tie)
      const top10Ids = [...allEntries]
        .sort((a, b) => b.pointsAfterWeek4 - a.pointsAfterWeek4)
        .slice(0, 10)
        .map(e => e.id)

      const progressionData: EntryProgression[] = allEntries
        .filter(e => top10Ids.includes(e.id))
        .map(e => ({
          id: e.id,
          entry_name: e.entry_name,
          display_name: e.display_name,
          total_points: e.pointsAfterWeek4,
          rankAfterWeek1: ranksW1.get(e.id) || 0,
          rankAfterWeek2: ranksW2.get(e.id) || 0,
          rankAfterWeek3: ranksW3.get(e.id) || 0,
          rankAfterWeek4: ranksW4.get(e.id) || 0,
        }))
        .sort((a, b) => a.rankAfterWeek4 - b.rankAfterWeek4)

      setEntries(progressionData)
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="card-solid p-6">
        <h3 className="text-lg font-bold text-white mb-4">Journey to the Money</h3>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      </div>
    )
  }

  // Chart dimensions - 2/3 of container
  const chartWidth = 500
  const chartHeight = 300
  const padding = { top: 20, right: 30, bottom: 30, left: 40 }
  const graphWidth = chartWidth - padding.left - padding.right
  const graphHeight = chartHeight - padding.top - padding.bottom

  // Find max rank to show (at least show top 20 for context)
  const maxRank = Math.max(
    20,
    ...entries.flatMap(e => [e.rankAfterWeek1, e.rankAfterWeek2, e.rankAfterWeek3, e.rankAfterWeek4])
  )

  // Scale functions
  const xScale = (week: number) => padding.left + ((week - 1) / 3) * graphWidth
  const yScale = (rank: number) => padding.top + ((rank - 1) / (maxRank - 1)) * graphHeight

  // Generate path for each entry
  const getPath = (entry: EntryProgression) => {
    const points = [
      { x: xScale(1), y: yScale(entry.rankAfterWeek1) },
      { x: xScale(2), y: yScale(entry.rankAfterWeek2) },
      { x: xScale(3), y: yScale(entry.rankAfterWeek3) },
      { x: xScale(4), y: yScale(entry.rankAfterWeek4) },
    ]
    return `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
  }

  const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>, entry: EntryProgression, week: number, rank: number) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (rect) {
      const svgX = parseFloat(e.currentTarget.getAttribute('cx') || '0')
      const svgY = parseFloat(e.currentTarget.getAttribute('cy') || '0')
      // Convert SVG coordinates to pixel coordinates
      const scaleX = rect.width / chartWidth
      const scaleY = rect.height / chartHeight
      setTooltip({
        x: rect.left + svgX * scaleX,
        y: rect.top + svgY * scaleY - 10,
        entry_name: entry.entry_name,
        rank,
        week,
      })
    }
  }

  return (
    <div className="card-solid p-6">
      <h3 className="text-lg font-bold text-white mb-4">Journey to the Money</h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart on the left - 2/3 width */}
        <div className="lg:w-2/3 relative">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
            {/* Grid lines */}
            {[1, 5, 10, 15, 20].filter(r => r <= maxRank).map(rank => (
              <g key={rank}>
                <line
                  x1={padding.left}
                  y1={yScale(rank)}
                  x2={padding.left + graphWidth}
                  y2={yScale(rank)}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={rank === 1 ? "0" : "4,4"}
                />
                <text
                  x={padding.left - 8}
                  y={yScale(rank)}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {rank}
                </text>
              </g>
            ))}

            {/* Week labels */}
            {[1, 2, 3, 4].map(week => (
              <text
                key={week}
                x={xScale(week)}
                y={chartHeight - 8}
                fill="#94a3b8"
                fontSize="11"
                textAnchor="middle"
              >
                Wk {week}
              </text>
            ))}

            {/* Lines for each entry */}
            {entries.map((entry, i) => (
              <path
                key={entry.id}
                d={getPath(entry)}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Dots at each point */}
            {entries.map((entry, i) => (
              <g key={`dots-${entry.id}`}>
                {[
                  { week: 1, rank: entry.rankAfterWeek1 },
                  { week: 2, rank: entry.rankAfterWeek2 },
                  { week: 3, rank: entry.rankAfterWeek3 },
                  { week: 4, rank: entry.rankAfterWeek4 },
                ].map(({ week, rank }) => (
                  <circle
                    key={`${entry.id}-${week}`}
                    cx={xScale(week)}
                    cy={yScale(rank)}
                    r="5"
                    fill={COLORS[i % COLORS.length]}
                    className="cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(e, entry, week, rank)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </g>
            ))}
          </svg>
          <p className="text-[10px] text-slate-600 mt-1 text-center">Lower = better rank</p>
        </div>

        {/* Leaderboard on the right - 1/3 width */}
        <div className="lg:w-1/3 min-w-0">
          <div className="space-y-1.5">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50"
              >
                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />

                {/* Rank */}
                <span className="text-sm font-bold text-white w-6">{RANK_LABELS[i]}</span>

                {/* Names */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{entry.entry_name}</div>
                  <div className="text-xs text-slate-500 truncate">{entry.display_name}</div>
                </div>

                {/* Payout */}
                <div className="text-sm font-semibold text-gold-400 flex-shrink-0">
                  ${PAYOUTS[i]}
                </div>

                {/* Total Score */}
                <div className="text-sm font-medium text-slate-300 flex-shrink-0 w-16 text-right">
                  {entry.total_points.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-slate-900 border border-slate-700 rounded shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          Rank {tooltip.rank}
        </div>
      )}
    </div>
  )
}
