import { Profile } from './database'

// ============================================
// Core Types
// ============================================

export type SalaryCapPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'

export type AcquisitionType =
  | 'auction'
  | 'draft'
  | 'trade'
  | 'fa_extension'
  | 'franchise_tag'
  | 'waiver'

export type TransactionType =
  | 'sign'
  | 'cut'
  | 'trade'
  | 'extend'
  | 'franchise_tag'
  | 'contract_expired'

export type ImportStatus = 'pending' | 'matched' | 'unmatched' | 'imported' | 'skipped'

// ============================================
// Database Types
// ============================================

export interface SalaryCapSettings {
  id: number
  league_name: string
  sleeper_league_id: string
  salary_cap: number
  max_contract_years: number
  rookie_max_years: number
  dead_cap_percent: number
  fa_extension_base: number
  fa_extension_percent: number
  current_season: number
  roster_size: number
  offseason_finalized: boolean
  updated_at: string
}

export interface SalaryCapOwner {
  id: string
  profile_id: string | null
  sleeper_user_id: string
  sleeper_display_name: string
  sleeper_avatar: string | null
  team_name: string | null
  owner_name: string
  is_active: boolean
  created_at: string
  // Joined
  profile?: Profile
}

export interface SalaryCapPlayer {
  id: string
  sleeper_player_id: string
  name: string
  position: SalaryCapPosition
  nfl_team: string | null
  fantasy_rank: number | null
  is_rookie: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SalaryCapContract {
  id: string
  player_id: string
  owner_id: string
  salary: number
  years_total: number
  years_remaining: number
  acquisition_type: AcquisitionType
  acquisition_year: number | null
  is_franchise_tagged: boolean
  contract_status: 'active' | 'expired' | 'free_agent_pickup'
  offseason_decision: string
  dead_cap_if_cut: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  player?: SalaryCapPlayer
  owner?: SalaryCapOwner
}

export interface SalaryCapRoster {
  id: string
  owner_id: string
  player_id: string
  created_at: string
  // Joined
  player?: SalaryCapPlayer
  owner?: SalaryCapOwner
}

export interface SalaryCapDeadCap {
  id: string
  owner_id: string
  player_name: string
  amount: number
  years_remaining: number
  original_salary: number
  cut_year: number
  drafted_year: number
  notes: string | null
  created_at: string
  // Joined
  owner?: SalaryCapOwner
}

export interface SalaryCapBonusCap {
  id: string
  owner_id: string
  corresponding_owner_id: string | null
  corresponding_owner_name: string
  trade_year: number
  amount_2026: number
  amount_2027: number
  amount_2028: number
  amount_2029: number
  amount_2030: number
  created_at: string
  // Joined
  corresponding_owner?: SalaryCapOwner
}

export interface SalaryCapTransaction {
  id: string
  transaction_type: TransactionType
  player_id: string | null
  player_name: string
  from_owner_id: string | null
  to_owner_id: string | null
  salary: number | null
  years: number | null
  dead_cap_amount: number | null
  notes: string | null
  transaction_date: string
  season: number | null
  created_at: string
  // Joined
  player?: SalaryCapPlayer
  from_owner?: SalaryCapOwner
  to_owner?: SalaryCapOwner
}

export interface SalaryCapImportStaging {
  id: string
  import_batch_id: string
  source: 'sleeper' | 'spreadsheet'
  player_name: string | null
  sleeper_player_id: string | null
  owner_name: string | null
  sleeper_user_id: string | null
  position: string | null
  salary: number | null
  years_remaining: number | null
  years_total: number | null
  status: ImportStatus
  match_confidence: number | null
  matched_player_id: string | null
  matched_owner_id: string | null
  notes: string | null
  created_at: string
}

export interface SalaryCapPositionAverage {
  id: string
  position: SalaryCapPosition
  season: number
  avg_top_5_salary: number
  updated_at: string
}

// ============================================
// Computed/View Types
// ============================================

export interface TeamCapSummary {
  owner: SalaryCapOwner
  contracts: SalaryCapContractWithPlayer[]
  deadCap: SalaryCapDeadCap[]
  bonusCap: SalaryCapBonusCap[]
  totalSalary: number
  totalDeadCap: number
  totalBonusCap: number
  capSpace: number
  playerCount: number
}

export interface SalaryCapContractWithPlayer extends SalaryCapContract {
  player: SalaryCapPlayer
}

export interface SalaryCapRosterWithContract extends SalaryCapRoster {
  player: SalaryCapPlayer
  contract?: SalaryCapContract
}

export interface FreeAgentInfo {
  player: SalaryCapPlayer
  previousSalary: number | null
  previousOwner: SalaryCapOwner | null
  extensionCost: number
}

// ============================================
// Import/Reconciliation Types
// ============================================

export interface SleeperUser {
  user_id: string
  display_name: string
  avatar: string | null
  metadata?: {
    team_name?: string
  }
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string
  players: string[] // Sleeper player IDs
  starters: string[]
}

export interface SleeperPlayer {
  player_id: string
  full_name: string
  first_name: string
  last_name: string
  position: string
  team: string | null
  active: boolean
}

export interface ReconciliationItem {
  id: string
  sleeperData: {
    player_id: string
    player_name: string
    position: string
    owner_id: string
    owner_name: string
  } | null
  spreadsheetData: {
    player_name: string
    owner_name: string
    salary: number
    years_remaining: number
    years_total: number
    position?: string
  } | null
  matchStatus: 'exact_match' | 'fuzzy_match' | 'sleeper_only' | 'spreadsheet_only'
  matchConfidence: number
  suggestedAction: 'import' | 'review' | 'skip'
  resolvedAction?: 'import' | 'skip'
  resolvedSalary?: number
  resolvedYears?: number
}

export interface ImportBatch {
  id: string
  created_at: string
  sleeper_count: number
  spreadsheet_count: number
  matched_count: number
  unmatched_count: number
  status: 'pending' | 'reconciling' | 'ready' | 'committed'
}

// ============================================
// Owner Mapping (Sleeper -> Google Doc)
// ============================================

export const OWNER_MAPPING: Record<string, { sleeper_username: string; owner_name: string; sleeper_user_id: string }> = {
  'scomo21': { sleeper_username: 'scomo21', owner_name: 'Scott Moran', sleeper_user_id: '389314306698665984' },
  'timothymeyers': { sleeper_username: 'timothymeyers', owner_name: 'Tim Meyers', sleeper_user_id: '388839887010267136' },
  'jonnygoodwin': { sleeper_username: 'jonnygoodwin', owner_name: 'Johnny Goodwin', sleeper_user_id: '871604656969826304' },
  'rhossick': { sleeper_username: 'rhossick', owner_name: 'Ryan Hossick', sleeper_user_id: '376224561794056192' },
  'zachmoore12': { sleeper_username: 'zachmoore12', owner_name: 'Zach Moore', sleeper_user_id: '471409645974450176' },
  'tybulger': { sleeper_username: 'tybulger', owner_name: 'Tyler Bulger', sleeper_user_id: '389124111617490944' },
  'bwandell': { sleeper_username: 'bwandell', owner_name: 'Brad Wandell', sleeper_user_id: '471436421073203200' },
  'Sacksy': { sleeper_username: 'Sacksy', owner_name: 'Josh Sacks', sleeper_user_id: '386394210728923136' },
  'brentfilbil': { sleeper_username: 'brentfilbil', owner_name: 'Brent Alexander', sleeper_user_id: '471414505356652544' },
  'ctw1105': { sleeper_username: 'ctw1105', owner_name: 'Corey Whitehead & Rob Green', sleeper_user_id: '467368684453621760' },
  'scottnw36': { sleeper_username: 'scottnw36', owner_name: 'Nick Scott', sleeper_user_id: '386546581727354880' },
  'jayhawks2442': { sleeper_username: 'jayhawks2442', owner_name: 'Nick Meyer', sleeper_user_id: '471436275551825920' },
}

// ============================================
// Franchise Tag Costs
// ============================================

export const FRANCHISE_TAG_COSTS: Record<string, number> = {
  QB: 40,
  RB: 99,
  WR: 74,
  TE: 22,
}

export function getFranchiseTagCost(position: string, previousSalary: number): number {
  const positionCost = FRANCHISE_TAG_COSTS[position] || 0
  return Math.max(positionCost, previousSalary)
}

// ============================================
// Helper Functions
// ============================================

export function calculateDeadCap(
  salary: number,
  yearsRemaining: number,
  deadCapPercent: number = 40
): number {
  return Math.ceil(salary * (deadCapPercent / 100) * yearsRemaining)
}

export function calculateFaExtensionCost(
  previousSalary: number | null,
  baseCost: number = 5,
  percent: number = 25
): number {
  if (!previousSalary) return baseCost
  return Math.max(baseCost, Math.round(previousSalary * (percent / 100)))
}

export function calculateCapSpace(
  salaryCap: number,
  totalSalary: number,
  totalDeadCap: number
): number {
  return salaryCap - totalSalary - totalDeadCap
}

export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // remove non-alpha chars
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '') // remove suffixes
    .replace(/\s+/g, ' ')
    .trim()
}

export function fuzzyMatchScore(name1: string, name2: string): number {
  const n1 = normalizePlayerName(name1)
  const n2 = normalizePlayerName(name2)

  if (n1 === n2) return 100

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 90

  // Simple Levenshtein-based similarity
  const maxLen = Math.max(n1.length, n2.length)
  if (maxLen === 0) return 100

  const distance = levenshteinDistance(n1, n2)
  return Math.round((1 - distance / maxLen) * 100)
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}
