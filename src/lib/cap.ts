import type { CapHealth, CapSummary, Contract, Pickup, TagCandidate } from './salarycap-types';

/** League constants — Bobby 3-Stix Memorial. */
export const BASE_CAP = 400;
export const ROSTER_MAX = 24;
export const DEAD_CAP_RATE = 0.4;
export const PICKUP_PRICE = 5;
/** Available cap below this shows amber. */
export const TIGHT_CAP_THRESHOLD = 50;
/** Contract dot track: 2026–2030. */
export const CONTRACT_START_YEAR = 2026;
export const CONTRACT_SLOTS = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dead cap incurred by cutting a player: 40% × salary × years remaining. */
export function deadCapIfCut(salary: number, yearsRemaining: number): number {
  return round2(DEAD_CAP_RATE * salary * yearsRemaining);
}

/**
 * Net cap change from cutting. Positive frees money; negative means the
 * dead cap hit exceeds the salary saved and cutting actively costs you.
 */
export function netCapFromCut(salary: number, yearsRemaining: number): number {
  return round2(salary - deadCapIfCut(salary, yearsRemaining));
}

/** Available = base + bonus − salaries − dead cap. */
export function availableCap(input: {
  baseCap?: number;
  bonusCap: number;
  salaries: number;
  deadCap: number;
}): number {
  const { baseCap = BASE_CAP, bonusCap, salaries, deadCap } = input;
  return round2(baseCap + bonusCap - salaries - deadCap);
}

export function capHealth(available: number): CapHealth {
  if (available < 0) return 'over';
  if (available < TIGHT_CAP_THRESHOLD) return 'tight';
  return 'healthy';
}

/**
 * Max legal bid: you must leave $1 for every remaining empty slot after this one.
 * e.g. $217 left with 18 empty slots → 217 − 17 = $200.
 */
export function maxBid(capRemaining: number, emptySlots: number): number {
  return round2(capRemaining - Math.max(0, emptySlots - 1));
}

/**
 * Recompute the full cap summary from a set of pending decisions.
 * Drives the live "what if I cut this player" behavior on My Team.
 */
export function summarizeCap(input: {
  contracts: Contract[];
  tagged?: TagCandidate | null;
  pickups?: Pickup[];
  bonusCap: number;
  carriedDeadCap: number;
  baseCap?: number;
}): CapSummary {
  const {
    contracts,
    tagged = null,
    pickups = [],
    bonusCap,
    carriedDeadCap,
    baseCap = BASE_CAP,
  } = input;

  let salaries = 0;
  let deadCap = carriedDeadCap;

  for (const c of contracts) {
    if (c.decision === 'cut') {
      deadCap += deadCapIfCut(c.salary, c.yearsRemaining);
    } else {
      salaries += c.salary;
    }
  }

  if (tagged) salaries += tagged.tagCost;
  for (const p of pickups) {
    if (p.decision !== 'release') salaries += p.price;
  }

  salaries = round2(salaries);
  deadCap = round2(deadCap);

  return {
    baseCap,
    bonusCap,
    salaries,
    deadCap,
    available: availableCap({ baseCap, bonusCap, salaries, deadCap }),
  };
}

/** Signed currency string: −$18, +$12, $213. */
export function money(n: number, signed = false): string {
  const abs = Math.abs(n);
  const body = `$${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
  if (n < 0) return `−${body}`;
  return signed ? `+${body}` : body;
}
