import { useEffect, useState } from 'react';

const DAY = 86_400_000;

interface CountdownProps {
  variant?: 'countdown';
  label: string;
  /** When the thing locks. */
  target: Date;
  /** Sub-line, e.g. "Aug 10, 2026 · 11:59 PM ET". */
  when?: string;
  /** Window used to fill the progress rule. Default 30 days. */
  windowDays?: number;
}

interface ProgressProps {
  variant: 'progress';
  label: string;
  when?: string;
  current: number;
  total: number;
  /** Unit shown after the number, e.g. "of 288 filled". */
  unit?: string;
}

type TickerProps = (CountdownProps | ProgressProps) & { className?: string };

/**
 * Deadline ticker. Neutral by default; amber under 3 days; red and
 * blinking under 24 hours. The thin rule along the bottom edge shows how
 * much of the window has burned.
 *
 * Use the `progress` variant anywhere a countdown would compete with
 * another clock (the auction page already has a bid timer).
 */
export function Ticker(props: TickerProps) {
  const { label, when, className = '' } = props;
  const isProgress = props.variant === 'progress';

  const [msLeft, setMsLeft] = useState(() =>
    isProgress ? 0 : Math.max(0, (props as CountdownProps).target.getTime() - Date.now())
  );

  useEffect(() => {
    if (isProgress) return;
    const target = (props as CountdownProps).target.getTime();
    const id = setInterval(() => setMsLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [isProgress, props]);

  let state: '' | 'warn' | 'crit' = '';
  let pct = 0;

  if (isProgress) {
    const p = props as ProgressProps;
    pct = p.total > 0 ? (p.current / p.total) * 100 : 0;
  } else {
    const windowMs = ((props as CountdownProps).windowDays ?? 30) * DAY;
    pct = Math.min(99, 100 - (msLeft / windowMs) * 100);
    if (msLeft < DAY) state = 'crit';
    else if (msLeft < 3 * DAY) state = 'warn';
  }

  const ruleColor =
    state === 'crit' ? 'bg-flag' : state === 'warn' ? 'bg-amber' : 'bg-field-500';
  const numColor =
    state === 'crit' ? 'text-flag motion-safe:animate-pulse' : state === 'warn' ? 'text-amber' : 'text-fg';

  return (
    <div
      className={`relative flex flex-wrap items-center justify-between gap-4 overflow-hidden
        rounded-card border border-hairline bg-surface-panel p-[15px_18px] ${className}`}
    >
      <div>
        <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">
          {label}
        </div>
        {when && <div className="mt-1 text-[12.5px] text-fg-muted">{when}</div>}
      </div>

      <div className={`flex items-baseline gap-2.5 font-data text-[26px] font-bold tabular-nums ${numColor}`}>
        {isProgress ? (
          <>
            <span>{(props as ProgressProps).current}</span>
            <Unit>{(props as ProgressProps).unit ?? `of ${(props as ProgressProps).total}`}</Unit>
          </>
        ) : (
          <Digits ms={msLeft} />
        )}
      </div>

      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 transition-[width] duration-500 ${ruleColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Digits({ ms }: { ms: number }) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <>
      {d > 0 && (
        <span>
          {d}
          <Unit>d</Unit>
        </span>
      )}
      <span>
        {pad(h)}
        <Unit>h</Unit>
      </span>
      <span>
        {pad(m)}
        <Unit>m</Unit>
      </span>
      <span>
        {pad(sec)}
        <Unit>s</Unit>
      </span>
    </>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="ml-0.5 text-[11px] font-semibold text-fg-subtle">{children}</span>;
}
