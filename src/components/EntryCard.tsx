import { Link } from 'react-router-dom'
import { Entry } from '../types/database'

interface EntryCardProps {
  entry: Entry
  onDelete: (entry: Entry) => void
  entriesLocked: boolean
}

export default function EntryCard({ entry, onDelete, entriesLocked }: EntryCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {entry.entry_name}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Created {new Date(entry.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {entry.total_points?.toFixed(1) || '0.0'} pts
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[1, 2, 3, 4].map((week) => (
            <div key={week} className="bg-gray-50 rounded-lg py-2">
              <div className="text-xs text-gray-500">Wk {week}</div>
              <div className="text-sm font-medium text-gray-900">--</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
        <Link
          to={`/entry/${entry.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
        >
          View Details
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/entry/${entry.id}/lineup`}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Set Lineup
          </Link>
          {!entriesLocked && (
            <button
              onClick={() => onDelete(entry)}
              className="inline-flex items-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete entry"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
