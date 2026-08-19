import { CONTRACT_SLOTS, CONTRACT_START_YEAR } from '../../lib/cap';

interface ContractDotsProps {
  /** Seasons still owed. 0 = expiring (shows a dashed amber ring on the first slot). */
  yearsRemaining: number;
  slots?: number;
  /** 'tag' renders gold — a franchise tag is always exactly one year. */
  variant?: 'contract' | 'tag';
  /** Gray everything out — used when a player is being cut or released. */
  dimmed?: boolean;
  className?: string;
}

/**
 * Contract length as season-anchored dots rather than text.
 * Because every row shares the same slots, the roster reads as a
 * contract timeline you can scan vertically: "everyone's off the
 * books after '27." Never replace this with "2 yrs left".
 */
export function ContractDots({
  yearsRemaining,
  slots = CONTRACT_SLOTS,
  variant = 'contract',
  dimmed = false,
  className = '',
}: ContractDotsProps) {
  const filled = dimmed
    ? 'bg-hairline-strong border-hairline-strong'
    : variant === 'tag'
      ? 'bg-gold-500 border-gold-500'
      : 'bg-field-500 border-field-500';

  return (
    <div className={`flex gap-[9px] ${className}`} role="img"
      aria-label={
        yearsRemaining === 0
          ? 'Contract expiring'
          : `Under contract through ${CONTRACT_START_YEAR + yearsRemaining - 1}`
      }
    >
      {Array.from({ length: slots }).map((_, i) => {
        const isFilled = i < yearsRemaining;
        const isExpiringMarker = i === 0 && yearsRemaining === 0;
        return (
          <span
            key={i}
            className={`block h-[11px] w-[11px] rounded-full border ${
              isFilled
                ? filled
                : isExpiringMarker
                  ? 'border-dashed border-amber bg-[#242c37]'
                  : 'border-[#2c3542] bg-[#242c37]'
            }`}
          />
        );
      })}
    </div>
  );
}

/**
 * Year labels for the column header. Must sit in the same grid column
 * as ContractDots so the dots align under their seasons.
 */
export function ContractYearLabels({ slots = CONTRACT_SLOTS }: { slots?: number }) {
  return (
    <div className="flex gap-[9px]">
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          className="w-[11px] text-center font-data text-[9px] text-fg-subtle"
        >
          {`'${String(CONTRACT_START_YEAR + i).slice(2)}`}
        </span>
      ))}
    </div>
  );
}
