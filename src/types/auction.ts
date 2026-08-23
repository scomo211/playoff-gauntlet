import { SalaryCapOwner, SalaryCapPlayer } from './salarycap'

// ============================================
// Auction Status Types
// ============================================

export type AuctionStatus = 'pending' | 'active' | 'paused' | 'completed'
export type AuctionItemStatus = 'active' | 'sold' | 'passed'

// ============================================
// Database Types
// ============================================

export interface Auction {
  id: string
  status: AuctionStatus
  nomination_order: string[] // Array of owner_ids
  current_nominator_index: number
  total_nominations: number
  timer_duration: number // seconds
  timer_reset_threshold: number // reset if under this
  timer_reset_to: number // reset to this value
  is_test?: boolean // Test mode flag for practice auctions
  bot_owner_ids?: string[] // Array of owner_ids that are bots
  created_at: string
  updated_at: string
}

export interface AuctionItem {
  id: string
  auction_id: string
  player_id: string
  nominated_by: string
  opening_bid: number
  current_bid: number
  current_high_bidder: string | null
  timer_end_at: string // ISO timestamp
  celebration_end_at?: string | null // ISO timestamp - when celebration period ends after sale
  status: AuctionItemStatus
  created_at: string
  // Joined
  player?: SalaryCapPlayer
  nominator?: SalaryCapOwner
  high_bidder?: SalaryCapOwner
}

export interface AuctionBid {
  id: string
  auction_item_id: string
  owner_id: string
  amount: number
  created_at: string
  // Joined
  owner?: SalaryCapOwner
}

export interface AuctionResult {
  id: string
  auction_id: string
  player_id: string
  winner_id: string
  winning_bid: number
  contract_years: number | null // NULL until assigned post-draft
  nomination_number: number
  created_at: string
  // Joined
  player?: SalaryCapPlayer
  winner?: SalaryCapOwner
}

// ============================================
// Computed/View Types
// ============================================

export interface PreDraftContract {
  id: string
  player_id: string
  salary: number
  years_remaining: number
  is_franchise_tagged: boolean
  // Supabase join returns object, type loosely to avoid issues
  player?: SalaryCapPlayer | Record<string, unknown>
}

export interface PreDraftFreeAgent {
  id: string
  player_id: string
  // Supabase join returns object, type loosely to avoid issues
  player?: SalaryCapPlayer | Record<string, unknown>
}

export interface OwnerAuctionState {
  owner: SalaryCapOwner
  totalSpent: number
  remainingCap: number
  playersWon: number
  rosterSlotsFilled: number
  rosterSlotsRemaining: number
  maxBid: number // remainingCap - (rosterSlotsRemaining - 1)
  draftedPlayers: AuctionResult[]
  // Pre-draft roster state
  existingContracts?: PreDraftContract[]
  signedFreeAgents?: PreDraftFreeAgent[]
  deadCap?: number
  bonusCap?: number
}

export interface AuctionState {
  auction: Auction | null
  currentItem: AuctionItem | null
  recentBids: AuctionBid[]
  recentResults: AuctionResult[]
  ownerStates: OwnerAuctionState[]
  myOwnerState: OwnerAuctionState | null
  isMyTurn: boolean
  currentNominator: SalaryCapOwner | null
}

// ============================================
// API Request/Response Types
// ============================================

export interface StartAuctionRequest {
  nomination_order?: string[] // Optional preset order, otherwise randomized
}

export interface NominatePlayerRequest {
  player_id: string
  opening_bid: number
}

export interface PlaceBidRequest {
  auction_item_id: string
  amount: number
}

export interface BidResponse {
  success: boolean
  error?: string
  new_bid?: number
  new_high_bidder?: string
  timer_end_at?: string
}

export interface CloseItemResponse {
  success: boolean
  result?: AuctionResult
  next_nominator_id?: string
  error?: string
}

export interface AssignContractRequest {
  result_id: string
  contract_years: number
}

// ============================================
// Timer Configuration
// ============================================

export const EARLY_DRAFT_CONFIG = {
  threshold: 50, // First 50 nominations
  timer_duration: 30,
  timer_reset_threshold: 10,
  timer_reset_to: 10,
}

export const LATE_DRAFT_CONFIG = {
  timer_duration: 20,
  timer_reset_threshold: 5,
  timer_reset_to: 5,
}

// ============================================
// Helper Functions
// ============================================

export function calculateMaxBid(remainingCap: number, rosterSlotsRemaining: number): number {
  // Must leave $1 for each remaining slot after this bid
  if (rosterSlotsRemaining <= 1) {
    return remainingCap
  }
  return Math.max(1, remainingCap - (rosterSlotsRemaining - 1))
}

export function getTimerConfig(nominationCount: number) {
  if (nominationCount < EARLY_DRAFT_CONFIG.threshold) {
    return {
      duration: EARLY_DRAFT_CONFIG.timer_duration,
      resetThreshold: EARLY_DRAFT_CONFIG.timer_reset_threshold,
      resetTo: EARLY_DRAFT_CONFIG.timer_reset_to,
    }
  }
  return {
    duration: LATE_DRAFT_CONFIG.timer_duration,
    resetThreshold: LATE_DRAFT_CONFIG.timer_reset_threshold,
    resetTo: LATE_DRAFT_CONFIG.timer_reset_to,
  }
}

export function calculateSecondsRemaining(timerEndAt: string): number {
  const endTime = new Date(timerEndAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((endTime - now) / 1000))
}

export function shouldResetTimer(
  secondsRemaining: number,
  resetThreshold: number
): boolean {
  return secondsRemaining < resetThreshold && secondsRemaining > 0
}
