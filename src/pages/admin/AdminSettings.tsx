import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { useAdminLeagueSettings } from '../../hooks/useAdmin'

export default function AdminSettings() {
  const { settings, loading, updateSettings, setCurrentWeek } = useAdminLeagueSettings()
  const [saving, setSaving] = useState(false)

  const handleToggleLineupsLocked = async () => {
    if (!settings) return
    const newStatus = !settings.entries_locked
    if (!confirm(`Are you sure you want to ${newStatus ? 'lock' : 'unlock'} all lineups? ${newStatus ? 'No one (including admins) will be able to modify lineups outside of the admin panel.' : ''}`)) return

    setSaving(true)
    await updateSettings({ entries_locked: newStatus })
    setSaving(false)
  }

  const handleSetCurrentWeek = async (weekId: number) => {
    if (!confirm(`Set current week to Week ${weekId}?`)) return

    setSaving(true)
    await setCurrentWeek(weekId)
    setSaving(false)
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">League Settings</h1>
        <p className="mt-1 text-gray-600">Configure league-wide settings</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Lineup Lock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Lock Lineups</h3>
              <p className="text-sm text-gray-600 mt-1">
                When locked, no one can add, remove, or replace players in any lineup.
                <br />
                <span className="text-gray-500">Admins can still edit lineups from the admin panel.</span>
              </p>
            </div>
            <button
              onClick={handleToggleLineupsLocked}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings?.entries_locked ? 'bg-red-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings?.entries_locked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              settings?.entries_locked
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {settings?.entries_locked ? 'Lineups Locked' : 'Lineups Open'}
            </span>
          </div>
        </div>

        {/* Current Week */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Week</h3>
          <p className="text-sm text-gray-600 mb-4">
            Set the active week for lineup submission and scoring
          </p>

          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(week => (
              <button
                key={week}
                onClick={() => handleSetCurrentWeek(week)}
                disabled={saving}
                className={`py-4 rounded-xl text-center font-medium transition ${
                  settings?.current_week_id === week
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="text-lg">Week {week}</div>
                <div className="text-xs mt-1 opacity-75">
                  {week === 1 && 'Wild Card'}
                  {week === 2 && 'Divisional'}
                  {week === 3 && 'Conference'}
                  {week === 4 && 'Super Bowl'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="font-medium text-gray-900">Recalculate All Scores</div>
                <div className="text-sm text-gray-500">
                  Recalculate fantasy points for all lineups based on current stats
                </div>
              </div>
              <button
                onClick={() => alert('Score recalculation not yet implemented')}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                Recalculate
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-gray-900">Reset All Lineups</div>
                <div className="text-sm text-gray-500">
                  Clear all lineup data for the current week (cannot be undone)
                </div>
              </div>
              <button
                onClick={() => alert('This action is disabled for safety')}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Weekly Workflow</p>
              <ol className="mt-2 list-decimal list-inside space-y-1">
                <li>Before kickoff: Ensure entries are locked</li>
                <li>After games: Eliminate losing teams</li>
                <li>After all games: Update player stats and recalculate scores</li>
                <li>Before next week: Set current week to next round</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
