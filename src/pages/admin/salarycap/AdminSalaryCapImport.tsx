import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../../components/AdminLayout'

interface ImportStats {
  owners?: number
  players?: number
  contracts?: number
  roster_assignments?: number
  total?: number
  matched?: number
  player_not_found?: number
  owner_not_found?: number
  under_contract?: number
  expired_contract?: number
  free_agent_pickup?: number
}

interface ImportResult {
  player_name: string
  owner_name: string
  status: 'matched' | 'player_not_found' | 'owner_not_found'
  matched_player?: string
  matched_owner?: string
}

export default function AdminSalaryCapImport() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [csvText, setCsvText] = useState('')

  const apiBase = import.meta.env.VITE_API_URL || ''

  const handleInitSettings = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=init-settings`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to init settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleFetchSleeper = async () => {
    setLoading(true)
    setMessage(null)
    setStats(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=fetch-sleeper`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setStats(data.stats)
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to fetch Sleeper data' })
    } finally {
      setLoading(false)
    }
  }

  const handleImportContracts = async () => {
    if (!csvText.trim()) {
      setMessage({ type: 'error', text: 'Please paste CSV data first' })
      return
    }

    setLoading(true)
    setMessage(null)
    setImportResults([])

    try {
      // Parse CSV
      const lines = csvText.trim().split('\n')
      const contracts: Array<{
        player_name: string
        owner_name: string
        salary: number
        years_remaining: number
        years_total: number
      }> = []

      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim()
        if (!line) continue

        // Parse CSV line (handle quoted fields)
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))

        if (parts.length >= 4) {
          const [player_name, owner_name, salaryStr, yearsStr, yearsTotalStr] = parts
          const salary = parseFloat(salaryStr.replace(/[$,]/g, ''))
          const years_remaining = parseInt(yearsStr, 10)
          const years_total = yearsTotalStr ? parseInt(yearsTotalStr, 10) : years_remaining

          if (player_name && owner_name && !isNaN(salary) && !isNaN(years_remaining)) {
            contracts.push({
              player_name,
              owner_name,
              salary,
              years_remaining,
              years_total,
            })
          }
        }
      }

      if (contracts.length === 0) {
        setMessage({ type: 'error', text: 'No valid contracts found in CSV' })
        setLoading(false)
        return
      }

      const response = await fetch(`${apiBase}/api/salarycap-import?action=import-contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts }),
      })
      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setStats(data.stats)
        setImportResults(data.results || [])
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to import contracts' })
    } finally {
      setLoading(false)
    }
  }

  const handleGetState = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=get-state`)
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
        setMessage({ type: 'success', text: 'Current state loaded' })
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to get state' })
    } finally {
      setLoading(false)
    }
  }

  const handleSyncContracts = async () => {
    setLoading(true)
    setMessage(null)
    setStats(null)
    try {
      const response = await fetch(`${apiBase}/api/salarycap-import?action=sync-contracts`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setStats(data.stats)
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to sync contracts' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/salarycap" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
              ← Back to Salary Cap
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Salary Cap Import</h1>
            <p className="text-gray-600 mt-1">Import data from Sleeper and contracts from CSV</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/salarycap/auction"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
            >
              Auction Admin
            </Link>
            <Link
              to="/admin/salarycap/offseason"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            >
              Offseason Tracking
            </Link>
            <button
              onClick={handleGetState}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
            >
              Refresh State
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Current Stats */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Current State</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.owners !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-gray-900">{stats.owners}</div>
                  <div className="text-sm text-gray-500">Owners</div>
                </div>
              )}
              {stats.players !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-gray-900">{stats.players}</div>
                  <div className="text-sm text-gray-500">Players</div>
                </div>
              )}
              {stats.contracts !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-green-600">{stats.contracts}</div>
                  <div className="text-sm text-gray-500">Contracts</div>
                </div>
              )}
              {stats.roster_assignments !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-gray-900">{stats.roster_assignments}</div>
                  <div className="text-sm text-gray-500">Roster Slots</div>
                </div>
              )}
              {stats.matched !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-green-600">{stats.matched}</div>
                  <div className="text-sm text-gray-500">Matched</div>
                </div>
              )}
              {stats.player_not_found !== undefined && stats.player_not_found > 0 && (
                <div>
                  <div className="text-3xl font-bold text-amber-600">{stats.player_not_found}</div>
                  <div className="text-sm text-gray-500">Players Not Found</div>
                </div>
              )}
              {stats.owner_not_found !== undefined && stats.owner_not_found > 0 && (
                <div>
                  <div className="text-3xl font-bold text-red-600">{stats.owner_not_found}</div>
                  <div className="text-sm text-gray-500">Owners Not Found</div>
                </div>
              )}
              {stats.under_contract !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-blue-600">{stats.under_contract}</div>
                  <div className="text-sm text-gray-500">Under Contract</div>
                </div>
              )}
              {stats.expired_contract !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-amber-600">{stats.expired_contract}</div>
                  <div className="text-sm text-gray-500">Expired (Tag Eligible)</div>
                </div>
              )}
              {stats.free_agent_pickup !== undefined && (
                <div>
                  <div className="text-3xl font-bold text-purple-600">{stats.free_agent_pickup}</div>
                  <div className="text-sm text-gray-500">Free Agent Pickups</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Initialize Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Step 1: Initialize Settings</h2>
              <p className="text-gray-600 text-sm mt-1">Create default league settings if they don't exist</p>
            </div>
            <button
              onClick={handleInitSettings}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Loading...' : 'Init Settings'}
            </button>
          </div>
        </div>

        {/* Step 2: Fetch Sleeper */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Step 2: Fetch Sleeper Data</h2>
              <p className="text-gray-600 text-sm mt-1">
                Import owners, players, and rosters from Sleeper. This will replace existing data.
              </p>
            </div>
            <button
              onClick={handleFetchSleeper}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Fetching...' : 'Fetch from Sleeper'}
            </button>
          </div>
        </div>

        {/* Step 3: Sync Contracts from Google Sheets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Step 3: Sync Contracts from Google Sheets</h2>
              <p className="text-gray-600 text-sm mt-1">
                Automatically fetch contract data from all team sheets and categorize players into:
              </p>
              <ul className="text-gray-600 text-sm mt-2 list-disc list-inside">
                <li><span className="text-blue-600 font-medium">Under Contract</span> - Active contracts for 2026+</li>
                <li><span className="text-amber-600 font-medium">Expired</span> - Contract ended, franchise tag eligible</li>
                <li><span className="text-purple-600 font-medium">Free Agent Pickup</span> - Mid-season additions, $5 option</li>
              </ul>
            </div>
            <button
              onClick={handleSyncContracts}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Syncing...' : 'Sync from Sheets'}
            </button>
          </div>
        </div>

        {/* Step 4: Manual Import Contracts (alternative) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Step 4: Manual Import (Alternative)</h2>
            <p className="text-gray-600 text-sm mt-1">
              Or paste CSV with columns: player_name, owner_name, salary, years_remaining, years_total
            </p>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`player_name,owner_name,salary,years_remaining,years_total
Patrick Mahomes,Scott Moran,45,2,3
Ja'Marr Chase,Tim Meyers,40,1,3`}
            className="w-full h-48 bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-900 font-mono text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={handleImportContracts}
            disabled={loading || !csvText.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Importing...' : 'Import Contracts'}
          </button>
        </div>

        {/* Import Results */}
        {importResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Import Results</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matched To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {importResults.map((result, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">{result.player_name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{result.owner_name}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          result.status === 'matched'
                            ? 'bg-green-100 text-green-800'
                            : result.status === 'player_not_found'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {result.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {result.matched_player && <span>{result.matched_player}</span>}
                        {result.matched_owner && <span className="text-gray-400"> → {result.matched_owner}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
