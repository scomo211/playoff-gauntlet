export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type CapHealth = 'healthy' | 'tight' | 'over';

/** Keep/cut decision on a player under contract. */
export type ContractDecision = 'keep' | 'cut';

/** Sign/release decision on a prior-season free agent pickup. */
export type PickupDecision = 'sign' | 'release';

export interface Player {
  id: string;
  name: string;
  position: Position;
  nflTeam: string;
  /** Headshot URL. Falls back to initials in the photo well when absent. */
  photoUrl?: string;
  /** Sleeper player ID for fetching photos from Sleeper CDN */
  sleeperId?: string;
  isRookie?: boolean;
}

export interface Contract {
  player: Player;
  salary: number;
  /** Seasons still owed after the current decision point. 0 = expiring. */
  yearsRemaining: number;
  signedYear?: number;
  decision?: ContractDecision;
}

export interface TagCandidate {
  player: Player;
  /** Cost to franchise tag for one year. */
  tagCost: number;
  lastSalary: number;
}

export interface Pickup {
  player: Player;
  /** Flat league price to retain, currently $5. */
  price: number;
  decision?: PickupDecision;
}

export interface DeadCapEntry {
  playerName: string;
  position: Position;
  cutYear: number;
  perYear: number;
  throughYear: number;
  remaining: number;
}

export interface BonusCapEntry {
  counterparty: string;
  note?: string;
  tradedOn: string;
  /** Positive = added to your cap, negative = owed away. */
  perYear: number;
  throughYear: number;
  currentYearAmount: number;
}

export interface CapSummary {
  baseCap: number;
  bonusCap: number;
  salaries: number;
  deadCap: number;
  available: number;
}

export interface OwnerTeam {
  id: string;
  teamName: string;
  ownerName: string;
  initials: string;
  cap: CapSummary;
  rosterCount: number;
  rosterMax: number;
  lastSeasonFinish?: string;
  isYou?: boolean;
}

export interface AuctionSale {
  player: Player;
  price: number;
  wonBy: string;
  wonByYou?: boolean;
}
