import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../hooks/useFavorites'
import { useRankMovement, MovementIndicator } from '../hooks/useRankMovement'
import AnimatedScore from './AnimatedScore'
import AnimatedLeaderboardRow from './AnimatedLeaderboardRow'

interface FavoritesLeaderboardProps {
  currentWeek?: number
  payoutSpots?: number
  payoutAmounts?: number[]
}

export default function FavoritesLeaderboard({ currentWeek, payoutSpots = 4, payoutAmounts = [] }: FavoritesLeaderboardProps) {
  const navigate = useNavigate()
  const { favoriteEntries, loading, toggleFavorite } = useFavorites()
  const { biggestUpMovers, biggestDownMovers, getMovement } = useRankMovement()

  // Don't render if no favorites
  if (!loading && favoriteEntries.length === 0) {
    return null
  }

  return (
    <div className="card-solid overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Your Favorites</h3>
            <span className="text-xs text-slate-500">({favoriteEntries.length})</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-1.5 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="pl-1 pr-0 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Entry
                </th>
                <th className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Wk 1
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Wk 2
                </th>
                <th className="pl-1 pr-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-2 py-2 sm:py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {favoriteEntries.map((entry) => {
                const inTheMoney = entry.rank <= payoutSpots

                return (
                  <AnimatedLeaderboardRow
                    key={entry.id}
                    entryId={entry.id}
                    rank={entry.rank}
                    onClick={() => navigate(`/entry/${entry.id}/lineup?week=${currentWeek || 1}`)}
                    className={`cursor-pointer transition ${inTheMoney ? 'bg-field-500/5 hover:bg-field-500/10' : 'hover:bg-slate-800/50'}`}
                  >
                    <td className="px-1.5 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className={`text-sm font-semibold ${inTheMoney ? 'text-field-400' : 'text-white'}`}>
                          {entry.rank}
                        </span>
                        {inTheMoney && payoutAmounts[entry.rank - 1] !== undefined && (
                          <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20">
                            ${payoutAmounts[entry.rank - 1].toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pl-1 pr-0 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MovementIndicator
                          entryId={entry.id}
                          biggestUpMovers={biggestUpMovers}
                          biggestDownMovers={biggestDownMovers}
                          getMovement={getMovement}
                        />
                        <div className="text-sm font-medium text-white sm:truncate sm:max-w-none" title={entry.entry_name}>
                          <span className="sm:hidden">{entry.entry_name.length > 20 ? entry.entry_name.slice(0, 20) + '…' : entry.entry_name}</span>
                          <span className="hidden sm:inline">{entry.entry_name}</span>
                        </div>
                        {entry.isOwn && (
                          <span className="text-slate-500" title="Your entry">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      <div className="text-sm text-slate-400 truncate max-w-[80px] sm:max-w-none" title={entry.display_name}>{entry.display_name}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                      {entry.week1_points > 0 ? entry.week1_points.toFixed(1) : '--'}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-center text-sm text-slate-400">
                      {entry.week2_points > 0 ? entry.week2_points.toFixed(1) : '--'}
                    </td>
                    <td className="pl-1 pr-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-right">
                      <AnimatedScore
                        value={entry.total_points}
                        className={`text-sm font-bold inline-block px-1 py-0.5 rounded ${inTheMoney ? 'text-field-400' : 'text-white'}`}
                      />
                    </td>
                    <td className="px-2 py-2 sm:py-3 whitespace-nowrap text-center">
                      {!entry.isOwn && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(entry.id)
                          }}
                          className="p-1 rounded hover:bg-slate-700/50 transition"
                          title="Remove from favorites"
                        >
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </AnimatedLeaderboardRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
