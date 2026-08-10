import { useState } from 'react'
import { SalaryCapContractWithPlayer } from '../../types/salarycap'
import PositionBadge from './PositionBadge'

interface RosterTableProps {
  contracts: SalaryCapContractWithPlayer[]
  showActions?: boolean
  onCut?: (contractId: string) => void
}

type SortField = 'name' | 'position' | 'salary' | 'years'
type SortDirection = 'asc' | 'desc'

export default function RosterTable({ contracts, showActions = false, onCut }: RosterTableProps) {
  const [sortField, setSortField] = useState<SortField>('salary')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'salary' || field === 'years' ? 'desc' : 'asc')
    }
  }

  const sortedContracts = [...contracts].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'name':
        comparison = a.player.name.localeCompare(b.player.name)
        break
      case 'position':
        comparison = a.player.position.localeCompare(b.player.position)
        break
      case 'salary':
        comparison = a.salary - b.salary
        break
      case 'years':
        comparison = a.years_remaining - b.years_remaining
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const totalSalary = contracts.reduce((sum, c) => sum + c.salary, 0)

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            {sortDirection === 'asc' ? (
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            )}
          </svg>
        )}
      </div>
    </th>
  )

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No players under contract
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-800/50">
          <tr>
            <SortHeader field="name" label="Player" />
            <SortHeader field="position" label="Pos" />
            <SortHeader field="salary" label="Salary" />
            <SortHeader field="years" label="Years" />
            {showActions && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedContracts.map((contract) => (
            <tr key={contract.id} className="hover:bg-slate-800/30">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium text-white">{contract.player.name}</div>
                    {contract.player.nfl_team && (
                      <div className="text-xs text-slate-500">{contract.player.nfl_team}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <PositionBadge position={contract.player.position} />
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-emerald-400">${contract.salary}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`font-medium ${contract.years_remaining <= 1 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {contract.years_remaining} {contract.years_remaining === 1 ? 'yr' : 'yrs'}
                </span>
                {contract.is_franchise_tagged && (
                  <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                    FT
                  </span>
                )}
              </td>
              {showActions && (
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onCut?.(contract.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Cut
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-800/50 border-t border-slate-700">
          <tr>
            <td colSpan={2} className="px-4 py-3 text-sm font-medium text-slate-400">
              Total ({contracts.length} players)
            </td>
            <td className="px-4 py-3">
              <span className="font-bold text-emerald-400">${totalSalary}</span>
            </td>
            <td colSpan={showActions ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
