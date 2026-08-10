import { BASE_CAP } from '../../lib/cap';
import type { CapSummary } from '../../lib/salarycap-types';

interface CapLedgerBarProps {
  cap: CapSummary;
  /** Bar height in px. Rows use 13, hero panels use 14–16. */
  height?: number;
  className?: string;
}

/**
 * THE comparison device of this app.
 *
 * Every bar spans the same total (baseCap + bonusCap) with segments in a
 * fixed order: salaries → dead cap → available. Because the scale never
 * changes, twelve of these stacked on the dashboard can be compared by eye.
 *
 * Bonus cap handling:
 * - Positive bonus cap: added to available (green segment)
 * - Negative bonus cap: treated as dead cap (red segment)
 *
 * Do NOT rescale to fit a container, reorder segments, or add segments.
 */
export function CapLedgerBar({ cap, height = 13, className = '' }: CapLedgerBarProps) {
  // Positive bonus cap expands the total, negative bonus is treated as dead cap
  const positiveBonusCap = Math.max(0, cap.bonusCap || 0);
  const negativeBonusCap = Math.abs(Math.min(0, cap.bonusCap || 0));

  const total = (cap.baseCap || BASE_CAP) + positiveBonusCap;
  const pct = (n: number) => `${Math.max(0, (n / total) * 100)}%`;
  const isOver = cap.available < 0;

  // Negative bonus cap shows as part of the dead cap segment
  const effectiveDeadCap = cap.deadCap + negativeBonusCap;

  return (
    <div
      className={`flex overflow-hidden rounded-[5px] bg-[#1b222c] ${
        isOver ? 'shadow-[inset_0_0_0_1px_rgba(240,86,46,0.65)]' : ''
      } ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Salaries ${cap.salaries}, dead cap ${effectiveDeadCap}, available ${cap.available}`}
    >
      <span className="block h-full bg-salary transition-[width] duration-200" style={{ width: pct(cap.salaries) }} />
      <span className="block h-full bg-flag transition-[width] duration-200" style={{ width: pct(effectiveDeadCap) }} />
      <span className="block h-full bg-field-500 transition-[width] duration-200" style={{ width: pct(cap.available) }} />
    </div>
  );
}

/** Legend for pages that show many bars at once (the dashboard). */
export function CapLedgerLegend({ className = '' }: { className?: string }) {
  const items = [
    ['bg-salary', 'Salaries'],
    ['bg-flag', 'Dead cap'],
    ['bg-field-500', 'Available'],
  ] as const;
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      {items.map(([bg, label]) => (
        <div key={label} className="flex items-center gap-1.5 font-data text-[10.5px] text-fg-subtle">
          <i className={`block h-[9px] w-[9px] rounded-[3px] ${bg}`} />
          {label}
        </div>
      ))}
    </div>
  );
}
