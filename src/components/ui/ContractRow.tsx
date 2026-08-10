import { deadCapIfCut, money, netCapFromCut, CONTRACT_START_YEAR } from '../../lib/cap';
import type { Contract, ContractDecision } from '../../lib/salarycap-types';
import { ContractDots, ContractYearLabels } from './ContractDots';
import { PlayerAvatar, RookieBadge } from './PlayerAvatar';

/**
 * Shared grid so ContractDots line up under ContractYearLabels.
 * Any row-based list on My Team should use this same template.
 */
export const ROW_GRID =
  'grid grid-cols-[42px_1fr_112px_54px_126px] items-center gap-[13px] ' +
  'max-[700px]:grid-cols-[38px_1fr_62px] max-[700px]:gap-3';

/** Header that aligns the year labels above the dots column. */
export function ContractRowHeader() {
  return (
    <div className={`${ROW_GRID} pb-0.5 pt-2 max-[700px]:hidden`}>
      <div />
      <div />
      <ContractYearLabels />
      <div />
      <div />
    </div>
  );
}

interface ContractRowProps {
  contract: Contract;
  onDecide: (decision: ContractDecision) => void;
}

export function ContractRow({ contract, onDecide }: ContractRowProps) {
  const { player, salary, yearsRemaining, signedYear } = contract;
  const isCut = contract.decision === 'cut';
  const dead = deadCapIfCut(salary, yearsRemaining);
  const net = netCapFromCut(salary, yearsRemaining);

  return (
    <div className={`${ROW_GRID} border-b border-hairline py-3 last:border-none`}>
      <PlayerAvatar
        name={player.name}
        position={player.position}
        photoUrl={player.photoUrl}
        sleeperId={player.sleeperId}
      />

      <div>
        <div className={`text-sm font-semibold ${isCut ? 'text-fg-subtle line-through' : 'text-fg'}`}>
          {player.name}
          {player.isRookie && <RookieBadge />}
        </div>
        <div className="mt-0.5 font-data text-[10.5px] text-fg-subtle">
          {player.nflTeam}
          {signedYear ? ` · signed ${signedYear}` : ''}
        </div>
      </div>

      <ContractDots yearsRemaining={yearsRemaining} dimmed={isCut} className="max-[700px]:col-start-2 max-[700px]:mt-1.5" />

      <div className={`text-right font-data text-[17px] font-bold tabular-nums ${isCut ? 'text-fg-subtle' : 'text-fg'}`}>
        {money(salary)}
      </div>

      <div className="flex justify-end gap-1.5 max-[700px]:col-span-full max-[700px]:mt-2 max-[700px]:justify-start">
        <DecisionButton active={!isCut} tone="keep" onClick={() => onDecide('keep')}>
          Keep
        </DecisionButton>
        <DecisionButton active={isCut} tone="cut" onClick={() => onDecide('cut')}>
          Cut
        </DecisionButton>
      </div>

      {/* Impact math appears only on the row being cut — never at rest. */}
      {isCut && (
        <div className="col-start-2 col-end-[-1] pt-2 font-data text-[11px] text-fg-muted max-[700px]:col-span-full max-[700px]:col-start-1">
          Frees <b className={net < 0 ? 'text-flag' : 'text-field-500'}>{money(salary)}</b>
          {' · '}
          <span className="text-flag">
            {money(dead)} dead cap through {CONTRACT_START_YEAR + yearsRemaining - 1}
          </span>
          {' · net '}
          <b className={net < 0 ? 'text-flag' : 'text-field-500'}>
            {net < 0 ? money(net) : `+${money(net)}`}
          </b>
        </div>
      )}
    </div>
  );
}

function DecisionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: 'keep' | 'cut';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const on =
    tone === 'keep'
      ? 'border-field-500 bg-field-500 text-[#04150c]'
      : 'border-flag bg-flag text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[7px] border px-3 py-1.5 text-[11.5px] font-semibold transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-500
        ${active ? on : 'border-hairline-strong text-fg-subtle hover:border-fg-subtle hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
