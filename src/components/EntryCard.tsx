import { Link } from 'react-router-dom'
import { Entry } from '../types/database'

interface EntryCardProps {
  entry: Entry
  onDelete: (entry: Entry) => void
  entriesLocked: boolean
}

export default function EntryCard({ entry, onDelete, entriesLocked }: EntryCardProps) {
  return (
    <div className="card-solid overflow-hidden hover:border-slate-700 transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              {entry.entry_name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Created {new Date(entry.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold bg-field-500/10 text-field-400 border border-field-500/20">
              {entry.total_points?.toFixed(1) || '0.0'} pts
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[1, 2, 3, 4].map((week) => (
            <div key={week} className="bg-slate-800/50 rounded-lg py-2">
              <div className="text-xs text-slate-500">Wk {week}</div>
              <div className="text-sm font-medium text-slate-300">--</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/30 px-5 py-3 flex items-center justify-between border-t border-slate-800">
        <Link
          to={`/entry/${entry.id}`}
          className="text-sm font-medium text-slate-400 hover:text-white transition"
        >
          View Details
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/entry/${entry.id}/lineup`}
            className="btn-primary py-1.5"
          >
            Set Lineup
          </Link>
          {!entriesLocked && (
            <button
              onClick={() => onDelete(entry)}
              className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
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
