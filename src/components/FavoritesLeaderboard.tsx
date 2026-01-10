import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../hooks/useFavorites'
import AnimatedScore from './AnimatedScore'

interface FavoritesLeaderboardProps {
  currentWeek?: number
}

export default function FavoritesLeaderboard({ currentWeek }: FavoritesLeaderboardProps) {
  const navigate = useNavigate()
  const { favoriteEntries, loading, toggleFavorite } = useFavorites()

  // Don't render if no favorites
  if (!loading && favoriteEntries.length === 0) {
    return null
  }

  return (
    <div className="card-solid overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">Your Favorites</h3>
          <span className="text-xs text-slate-500">({favoriteEntries.length})</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-700 border-t-field-500"></div>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {favoriteEntries.map((entry, index) => (
            <div
              key={entry.id}
              onClick={() => navigate(`/entry/${entry.id}/lineup?week=${currentWeek || 1}`)}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-slate-500 w-5">{index + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{entry.entry_name}</div>
                  <div className="text-xs text-slate-500 truncate">{entry.display_name}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AnimatedScore
                  value={entry.total_points}
                  className="text-sm font-bold text-white"
                />
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
