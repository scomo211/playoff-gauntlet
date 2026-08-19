import type { Position } from '../../lib/types';

const POS_TEXT: Record<Position, string> = {
  QB: 'text-pos-qb',
  RB: 'text-pos-rb',
  WR: 'text-pos-wr',
  TE: 'text-pos-te',
  K: 'text-pos-k',
  DEF: 'text-pos-def',
};

const SIZES = {
  sm: { box: 'h-[30px] w-[30px] rounded-[8px] text-[10.5px]', strip: 'text-[6px] py-px' },
  md: { box: 'h-[42px] w-[42px] rounded-well text-[12.5px]', strip: 'text-[7.5px] py-0.5' },
  lg: { box: 'h-[84px] w-[84px] rounded-[20px] text-[25px]', strip: 'text-[10px] py-1' },
} as const;

interface PlayerAvatarProps {
  name: string;
  position: Position;
  /** Headshot URL. Falls back to initials when absent. */
  photoUrl?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('');
}

/**
 * Neutral photo well with the position code on a dark strip.
 * Position color lives here as TEXT ONLY — never a solid fill.
 */
export function PlayerAvatar({
  name,
  position,
  photoUrl,
  size = 'md',
  className = '',
}: PlayerAvatarProps) {
  const s = SIZES[size];
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border
        border-hairline-strong bg-surface-well font-data font-bold text-[#4d5766] ${s.box} ${className}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
      <span
        className={`absolute inset-x-0 bottom-0 bg-[rgba(9,12,17,0.85)] text-center font-bold
          tracking-[0.1em] ${s.strip} ${POS_TEXT[position]}`}
      >
        {position}
      </span>
    </div>
  );
}

/** Gold R. Use anywhere a player is listed. */
export function RookieBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`ml-1.5 inline-block rounded-[4px] bg-gold-500/[0.16] px-1.5 py-px
        font-data text-[9px] font-bold text-gold-500 ${className}`}
    >
      R
    </span>
  );
}
