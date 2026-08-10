interface CapMeterProps {
  totalSalary: number
  salaryCap: number
  deadCap?: number
  variant?: 'compact' | 'full'
}

export default function CapMeter({ totalSalary, salaryCap, deadCap = 0, variant = 'compact' }: CapMeterProps) {
  const totalUsed = totalSalary + deadCap
  const percentage = Math.min((totalUsed / salaryCap) * 100, 100)
  const capSpace = salaryCap - totalUsed

  const getColor = () => {
    if (percentage > 100) return 'bg-red-500'
    if (percentage > 95) return 'bg-red-500'
    if (percentage > 90) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getTextColor = () => {
    if (percentage > 100) return 'text-red-400'
    if (percentage > 95) return 'text-red-400'
    if (percentage > 90) return 'text-amber-400'
    return 'text-emerald-400'
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${getTextColor()}`}>
          ${totalUsed.toFixed(0)}/${salaryCap}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">Cap Usage</span>
        <span className={`text-lg font-bold ${getTextColor()}`}>
          ${capSpace.toFixed(0)} space
        </span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-3">
        <div className="h-full flex">
          <div
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${(totalSalary / salaryCap) * 100}%` }}
          />
          {deadCap > 0 && (
            <div
              className="bg-red-500/70 transition-all duration-300"
              style={{ width: `${(deadCap / salaryCap) * 100}%` }}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-slate-500">Salary</div>
          <div className="font-medium text-emerald-400">${totalSalary.toFixed(0)}</div>
        </div>
        <div>
          <div className="text-slate-500">Dead Cap</div>
          <div className="font-medium text-red-400">${deadCap.toFixed(0)}</div>
        </div>
        <div>
          <div className="text-slate-500">Cap</div>
          <div className="font-medium text-slate-300">${salaryCap}</div>
        </div>
      </div>
    </div>
  )
}
