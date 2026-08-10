import { useEffect, useRef, useState } from 'react';
import { money } from '../../lib/cap';
import type { Player } from '../../lib/salarycap-types';
import { PlayerAvatar, RookieBadge } from './PlayerAvatar';

export type AuctionState = 'live' | 'once' | 'twice' | 'sold';

interface Bid {
  bidder: string;
  amount: number;
  isYou?: boolean;
}

interface AuctionStageProps {
  player: Player;
  marketValue?: number;
  currentBid: number;
  highBidder: string;
  youAreHighBidder?: boolean;
  /** Most recent bids, newest first. Only the first three render. */
  recentBids: Bid[];
  secondsLeft: number;
  totalSeconds: number;
  state: AuctionState;
  maxBid: number;
  capLeft: number;
  rosterCount: number;
  rosterMax: number;
  onBid: (amount: number) => void;
}

/**
 * The auction hero. Bid and clock are the whole point of this component —
 * everything else is a whisper around them. Layout is horizontal on
 * purpose: a vertical stack wasted most of the viewport.
 */
export function AuctionStage({
  player,
  marketValue,
  currentBid,
  highBidder,
  youAreHighBidder,
  recentBids,
  secondsLeft,
  totalSeconds,
  state,
  maxBid,
  capLeft,
  rosterCount,
  rosterMax,
  onBid,
}: AuctionStageProps) {
  const [custom, setCustom] = useState(String(currentBid + 5));
  const bidRef = useRef<HTMLDivElement>(null);
  const prevBid = useRef(currentBid);

  // Bump the number whenever it changes.
  useEffect(() => {
    if (currentBid !== prevBid.current && bidRef.current) {
      const el = bidRef.current;
      el.classList.remove('motion-safe:animate-bid-bump');
      void el.offsetWidth;
      el.classList.add('motion-safe:animate-bid-bump');
      prevBid.current = currentBid;
    }
  }, [currentBid]);

  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const tone =
    state === 'twice' ? 'crit' : state === 'once' ? 'warn' : state === 'sold' ? 'sold' : 'live';

  const barColor =
    tone === 'crit' ? 'bg-flag motion-safe:animate-pulse'
    : tone === 'warn' ? 'bg-amber'
    : 'bg-field-500';
  const clockColor =
    tone === 'crit' ? 'text-flag motion-safe:animate-pulse'
    : tone === 'warn' ? 'text-amber'
    : tone === 'sold' ? 'text-gold-500'
    : 'text-field-500';

  const clockText =
    state === 'sold' ? 'SOLD'
    : `0:${String(secondsLeft).padStart(2, '0')}${state === 'once' ? ' ONCE' : state === 'twice' ? ' TWICE' : ''}`;

  return (
    <div className="rounded-hero border border-hairline bg-surface-panel p-[20px_22px]">
      <div className="grid grid-cols-[84px_1fr_auto] items-center gap-[18px] max-[600px]:grid-cols-[60px_1fr] max-[600px]:gap-y-3">
        <PlayerAvatar
          name={player.name}
          position={player.position}
          photoUrl={player.photoUrl}
          sleeperId={player.sleeperId}
          size="lg"
        />

        <div>
          <div className="font-display text-[22px] font-semibold -tracking-[0.01em]">
            {player.name}
            {player.isRookie && <RookieBadge />}
          </div>
          <div className="mt-1 font-data text-[11.5px] text-fg-subtle">
            {player.nflTeam}
            {marketValue ? ` · market ${money(marketValue)}` : ''}
          </div>
          <div className="mt-2 font-data text-[10.5px] text-fg-subtle">
            {recentBids.slice(0, 3).map((b, i) => (
              <span key={i}>
                {i > 0 && ' ← '}
                <span className={i === 0 ? 'text-fg-muted font-bold' : b.isYou ? 'text-gold-500' : ''}>
                  {b.bidder} {money(b.amount)}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-right max-[600px]:col-span-full max-[600px]:text-left">
          <div ref={bidRef} className="font-data text-bid font-bold tabular-nums">
            {money(currentBid)}
          </div>
          <div className="mt-1 text-xs text-fg-muted">
            {state === 'sold' ? (
              <b className="text-gold-500">Sold to {highBidder} · {money(currentBid)}</b>
            ) : youAreHighBidder ? (
              <b className="text-gold-500">You lead</b>
            ) : (
              `${highBidder} leads`
            )}
          </div>
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-[1fr_auto] items-center gap-3.5">
        <div className="h-[7px] overflow-hidden rounded-full bg-hairline">
          <span
            className={`block h-full rounded-full transition-[width] duration-1000 ease-linear ${barColor}`}
            style={{ width: `${state === 'sold' ? 0 : pct}%` }}
          />
        </div>
        <div className={`min-w-[118px] text-right font-data text-[19px] font-bold tabular-nums ${clockColor}`}>
          {clockText}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onBid(currentBid + 1)}
          disabled={state === 'sold' || currentBid + 1 > maxBid}
          className="min-w-[180px] flex-1 rounded-card bg-field-500 p-[17px] font-data text-[17px]
            font-bold text-[#04150c] transition-colors hover:bg-field-600
            disabled:pointer-events-none disabled:opacity-40
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-500"
        >
          Bid {money(currentBid + 1)}
        </button>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom bid"
          className="w-[76px] rounded-card border border-hairline-strong bg-surface-well px-1 py-4
            text-center font-data text-base font-bold text-fg"
        />
        <button
          type="button"
          onClick={() => {
            const v = parseInt(custom, 10);
            if (v > currentBid && v <= maxBid) onBid(v);
          }}
          disabled={state === 'sold'}
          className="rounded-card border border-hairline-strong px-4 py-4 font-data text-[12.5px]
            font-semibold text-fg-muted disabled:opacity-40"
        >
          Place
        </button>
      </div>

      {/* Always visible. Max bid must never be more than a glance away. */}
      <div className="mt-3 flex flex-wrap gap-4 font-data text-[11px] text-fg-subtle">
        <span>Max bid <b className="font-bold text-gold-500 tabular-nums">{money(maxBid)}</b></span>
        <span>Cap left <b className="font-bold text-fg-muted tabular-nums">{money(capLeft)}</b></span>
        <span>Roster <b className="font-bold text-fg-muted tabular-nums">{rosterCount}/{rosterMax}</b></span>
        <span>Slots open <b className="font-bold text-fg-muted tabular-nums">{rosterMax - rosterCount}</b></span>
      </div>
    </div>
  );
}
