export interface Profile {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  created_at: string
}

export interface Team {
  id: string
  name: string
  city: string
  conference: 'AFC' | 'NFC'
  is_alive: boolean
  eliminated_week: number | null
  created_at: string
}

export interface Week {
  id: number
  name: string
  roster_size: number
  lockout_time: string
  opens_at: string | null
  is_current: boolean
  is_complete: boolean
}

export interface RosterRequirement {
  week_id: number
  position: Position
  slots_required: number
}

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'

export interface Player {
  id: string
  name: string
  position: Position
  team_id: string | null
  is_active: boolean
  headshot_url: string | null
  created_at: string
  // Joined fields
  team?: Team
}

export interface Entry {
  id: string
  user_id: string
  entry_name: string
  is_active: boolean
  payment_received: boolean
  created_at: string
  // Joined fields
  profile?: Profile
  total_points?: number
}

export interface Lineup {
  id: string
  entry_id: string
  week_id: number
  is_submitted: boolean
  submitted_at: string | null
  total_points: number
  created_at: string
  // Joined fields
  lineup_players?: LineupPlayer[]
  week?: Week
}

export interface LineupPlayer {
  id: string
  lineup_id: string
  player_id: string
  position_slot: string
  points_scored: number
  // Joined fields
  player?: Player
}

export interface UsedPlayer {
  entry_id: string
  player_id: string
  week_used: number
  // Joined fields
  player?: Player
}

export interface PlayerWeeklyStats {
  player_id: string
  week_id: number
  pass_yards: number
  pass_td: number
  interceptions: number
  rush_yards: number
  rush_td: number
  receptions: number
  rec_yards: number
  rec_td: number
  fumbles_lost: number
  two_pt_conv: number
  punt_ret_td: number
  kick_ret_td: number
  fg_made_yards: number
  xp_made: number
  xp_missed: number
  def_fumble_rec: number
  def_int: number
  def_sacks: number
  def_safety: number
  def_pts_allowed: number
  total_points: number
}

export interface LeagueSettings {
  id: number
  entries_locked: boolean
  entry_fee: number
  current_week_id: number | null
  updated_at: string
}

// Leaderboard entry with calculated fields
export interface LeaderboardEntry {
  id: string
  entry_name: string
  user_id: string
  display_name: string
  week1_points: number
  week2_points: number
  week3_points: number
  week4_points: number
  total_points: number
  rank: number
}

// Position slot mappings
export const POSITION_SLOTS: Record<number, Record<Position, string[]>> = {
  // Weeks 1-3
  1: {
    QB: ['QB1', 'QB2'],
    RB: ['RB1', 'RB2', 'RB3'],
    WR: ['WR1', 'WR2', 'WR3', 'WR4'],
    TE: ['TE1', 'TE2'],
    K: ['K1', 'K2'],
    DEF: ['DEF1', 'DEF2'],
  },
  2: {
    QB: ['QB1', 'QB2'],
    RB: ['RB1', 'RB2', 'RB3'],
    WR: ['WR1', 'WR2', 'WR3', 'WR4'],
    TE: ['TE1', 'TE2'],
    K: ['K1', 'K2'],
    DEF: ['DEF1', 'DEF2'],
  },
  3: {
    QB: ['QB1', 'QB2'],
    RB: ['RB1', 'RB2', 'RB3'],
    WR: ['WR1', 'WR2', 'WR3', 'WR4'],
    TE: ['TE1', 'TE2'],
    K: ['K1', 'K2'],
    DEF: ['DEF1', 'DEF2'],
  },
  // Week 4 (Super Bowl)
  4: {
    QB: ['QB1'],
    RB: ['RB1', 'RB2'],
    WR: ['WR1', 'WR2'],
    TE: ['TE1'],
    K: ['K1'],
    DEF: ['DEF1'],
  },
}

// Helper to get all position slots for a week
export function getPositionSlotsForWeek(weekId: number): string[] {
  const slots = POSITION_SLOTS[weekId] || POSITION_SLOTS[1]
  return Object.values(slots).flat()
}

// Helper to get position from slot name
export function getPositionFromSlot(slot: string): Position {
  return slot.replace(/[0-9]/g, '') as Position
}
