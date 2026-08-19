import { capHealth, money } from '../../lib/cap';
import type { CapSummary } from '../../lib/types';
import { CapLedgerBar } from './CapLedgerBar';

const HEALTH_TEXT = {
  healthy: 'text-field-500',
  tight: 'text-amber',
  over: 'text-flag',
} as const;

interface CapWidgetProps {
  cap: CapSummary;
  /** Element ids to scroll to. Omit to render the lines as plain text. */
  bonusTargetId?: string;
  deadTargetId?: string;
  className?: string;
}

/**
 * Read-only cap panel. Sticky on My Team so the number stays visible
 * while decisions are made below it.
 *
 * Dead cap and bonus cap are summarized here and detailed in their own
 * page sections — never expanded inline. The lines jump you there.
 */
export function CapWidget({ cap, bonusTargetId, deadTargetId, className = '' }: CapWidgetProps) {
  const health = capHealth(cap.available);

  const jump = (id?: string) => {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`rounded-card border border-hairline bg-surface-panel p-[16px_18px] ${className}`}>
      <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">
        Available cap
      </div>
      <div className={`mt-1 font-data text-cap font-bold tabular-nums ${HEALTH_TEXT[health]}`}>
        {money(cap.available)}
      </div>

      <CapLedgerBar cap={cap} height={13} className="mt-3" />

      <div className="mt-3.5 border-t border-hairline pt-3">
        <Line label="Base cap" value={money(cap.baseCap)} />
        <Line
          label="Bonus cap"
          value={money(cap.bonusCap, cap.bonusCap > 0)}
          valueClass={cap.bonusCap >= 0 ? 'text-field-500' : 'text-flag'}
          onClick={bonusTargetId ? () => jump(bonusTargetId) : undefined}
        />
        <Line label="Salaries" value={`−${money(cap.salaries)}`} swatch="bg-salary" />
        <Line
          label="Dead cap"
          value={`−${money(cap.deadCap)}`}
          valueClass="text-flag"
          swatch="bg-flag"
          onClick={deadTargetId ? () => jump(deadTargetId) : undefined}
        />
        <div className="mt-1.5 flex items-center justify-between border-t border-hairline pt-2.5 font-data text-[11.5px] text-fg-muted">
          <span>Available</span>
          <span className="text-[13px] font-bold text-field-500 tabular-nums">
            {money(cap.available)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  valueClass = 'text-fg',
  swatch,
  onClick,
}: {
  label: string;
  value: string;
  valueClass?: string;
  swatch?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5">
        {swatch && <i className={`block h-2 w-2 rounded-[2px] ${swatch}`} />}
        {label}
        {onClick && <span className="text-[10px] text-fg-subtle">→</span>}
      </span>
      <span className={`font-bold tabular-nums ${valueClass}`}>{value}</span>
    </>
  );

  const base = 'flex w-full items-center justify-between py-1.5 font-data text-[11.5px] text-fg-muted';

  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} text-left hover:text-fg`}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
