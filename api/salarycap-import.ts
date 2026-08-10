import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'
const LEAGUE_ID = '1257102944021520384'

// Owner mapping: Sleeper username -> Owner name (for Google Doc)
const OWNER_MAPPING: Record<string, { owner_name: string; sleeper_user_id: string }> = {
  'scomo21': { owner_name: 'Scott Moran', sleeper_user_id: '389314306698665984' },
  'timothymeyers': { owner_name: 'Tim Meyers', sleeper_user_id: '388839887010267136' },
  'jonnygoodwin': { owner_name: 'Johnny Goodwin', sleeper_user_id: '871604656969826304' },
  'rhossick': { owner_name: 'Ryan Hossick', sleeper_user_id: '376224561794056192' },
  'zachmoore12': { owner_name: 'Zach Moore', sleeper_user_id: '471409645974450176' },
  'tybulger': { owner_name: 'Tyler Bulger', sleeper_user_id: '389124111617490944' },
  'bwandell': { owner_name: 'Brad Wandell', sleeper_user_id: '471436421073203200' },
  'Sacksy': { owner_name: 'Josh Sacks', sleeper_user_id: '386394210728923136' },
  'brentfilbil': { owner_name: 'Brent Alexander', sleeper_user_id: '471414505356652544' },
  'ctw1105': { owner_name: 'Corey Whitehead & Rob Green', sleeper_user_id: '467368684453621760' },
  'scottnw36': { owner_name: 'Nick Scott', sleeper_user_id: '386546581727354880' },
  'jayhawks2442': { owner_name: 'Nick Meyer', sleeper_user_id: '471436275551825920' },
}

interface SleeperUser {
  user_id: string
  display_name: string
  avatar: string | null
  metadata?: { team_name?: string }
}

interface SleeperRoster {
  roster_id: number
  owner_id: string
  players: string[]
}

interface SleeperPlayer {
  player_id: string
  full_name: string
  first_name: string
  last_name: string
  position: string
  team: string | null
  active: boolean
}

// Normalize player names for matching
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Calculate fuzzy match score
function fuzzyMatchScore(name1: string, name2: string): number {
  const n1 = normalizePlayerName(name1)
  const n2 = normalizePlayerName(name2)

  if (n1 === n2) return 100
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

// Map Sleeper position to our positions
function mapPosition(position: string): string | null {
  const posMap: Record<string, string> = {
    QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', K: 'K', DEF: 'DEF', FB: 'RB'
  }
  return posMap[position] || null
}

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=representation' : 'return=minimal',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase error: ${response.status} - ${text}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

// Fetch Sleeper data
async function fetchSleeperData() {
  const [usersRes, rostersRes] = await Promise.all([
    fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/users`),
    fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/rosters`),
  ])

  if (!usersRes.ok || !rostersRes.ok) {
    throw new Error('Failed to fetch from Sleeper API')
  }

  const users: SleeperUser[] = await usersRes.json()
  const rosters: SleeperRoster[] = await rostersRes.json()

  // Get all unique player IDs
  const allPlayerIds = new Set<string>()
  for (const roster of rosters) {
    for (const playerId of roster.players || []) {
      allPlayerIds.add(playerId)
    }
  }

  // Fetch player details (this is a large file, but we need it)
  const playersRes = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
  if (!playersRes.ok) {
    throw new Error('Failed to fetch Sleeper players')
  }
  const allPlayers = await playersRes.json()

  // Filter to just the players we need
  const players: Map<string, SleeperPlayer> = new Map()
  for (const playerId of allPlayerIds) {
    const player = allPlayers[playerId]
    if (player) {
      players.set(playerId, {
        player_id: playerId,
        full_name: player.full_name || `${player.first_name} ${player.last_name}`,
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        position: player.position || 'UNK',
        team: player.team || null,
        active: player.active ?? true,
      })
    }
  }

  return { users, rosters, players }
}

// Action: Fetch from Sleeper and populate owners/players
async function handleFetchSleeper(res: VercelResponse) {
  try {
    const { users, rosters, players } = await fetchSleeperData()

    // Create a map of owner_id -> roster
    const rosterByOwner = new Map<string, SleeperRoster>()
    for (const roster of rosters) {
      rosterByOwner.set(roster.owner_id, roster)
    }

    // Upsert owners
    const ownersToInsert = users.map(user => {
      const mapping = Object.values(OWNER_MAPPING).find(m => m.sleeper_user_id === user.user_id)
      return {
        sleeper_user_id: user.user_id,
        sleeper_display_name: user.display_name,
        sleeper_avatar: user.avatar,
        team_name: user.metadata?.team_name || null,
        owner_name: mapping?.owner_name || user.display_name,
        is_active: true,
      }
    })

    // Delete existing owners and insert new ones
    await supabaseQuery('/salarycap_owners?id=not.is.null', { method: 'DELETE' })
    const insertedOwners = await supabaseQuery('/salarycap_owners', {
      method: 'POST',
      body: JSON.stringify(ownersToInsert),
    })

    // Create owner ID map
    const ownerIdMap = new Map<string, string>()
    for (const owner of insertedOwners) {
      ownerIdMap.set(owner.sleeper_user_id, owner.id)
    }

    // Upsert players (only the ones on rosters)
    const playersToInsert = Array.from(players.values())
      .filter(p => mapPosition(p.position))
      .map(p => ({
        sleeper_player_id: p.player_id,
        name: p.full_name,
        position: mapPosition(p.position),
        nfl_team: p.team,
        is_active: p.active,
      }))

    // Delete existing players and insert new ones
    await supabaseQuery('/salarycap_players?id=not.is.null', { method: 'DELETE' })
    const insertedPlayers = await supabaseQuery('/salarycap_players', {
      method: 'POST',
      body: JSON.stringify(playersToInsert),
    })

    // Create player ID map
    const playerIdMap = new Map<string, string>()
    for (const player of insertedPlayers) {
      playerIdMap.set(player.sleeper_player_id, player.id)
    }

    // Create rosters (which players belong to which owner)
    const rostersToInsert: { owner_id: string; player_id: string }[] = []
    for (const roster of rosters) {
      const ownerId = ownerIdMap.get(roster.owner_id)
      if (!ownerId) continue

      for (const sleeperId of roster.players || []) {
        const playerId = playerIdMap.get(sleeperId)
        if (playerId) {
          rostersToInsert.push({ owner_id: ownerId, player_id: playerId })
        }
      }
    }

    // Delete existing rosters and insert new ones
    await supabaseQuery('/salarycap_rosters?id=not.is.null', { method: 'DELETE' })
    if (rostersToInsert.length > 0) {
      await supabaseQuery('/salarycap_rosters', {
        method: 'POST',
        body: JSON.stringify(rostersToInsert),
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Sleeper data imported successfully',
      stats: {
        owners: insertedOwners.length,
        players: insertedPlayers.length,
        roster_assignments: rostersToInsert.length,
      },
    })
  } catch (error) {
    console.error('Fetch Sleeper error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Parse and import contracts from CSV
async function handleImportContracts(req: VercelRequest, res: VercelResponse) {
  try {
    const { contracts } = req.body as {
      contracts: Array<{
        player_name: string
        owner_name: string
        salary: number
        years_remaining: number
        years_total: number
        position?: string
      }>
    }

    if (!contracts || !Array.isArray(contracts)) {
      return res.status(400).json({ success: false, error: 'Missing contracts array' })
    }

    // Fetch current owners and players
    const [owners, players] = await Promise.all([
      supabaseQuery('/salarycap_owners?select=id,owner_name,sleeper_display_name'),
      supabaseQuery('/salarycap_players?select=id,name,sleeper_player_id,position'),
    ])

    // Build lookup maps
    const ownerByName = new Map<string, { id: string; name: string }>()
    for (const owner of owners) {
      ownerByName.set(normalizePlayerName(owner.owner_name), { id: owner.id, name: owner.owner_name })
      ownerByName.set(normalizePlayerName(owner.sleeper_display_name), { id: owner.id, name: owner.owner_name })
    }

    const playerByName = new Map<string, { id: string; name: string }>()
    for (const player of players) {
      playerByName.set(normalizePlayerName(player.name), { id: player.id, name: player.name })
    }

    // Process contracts
    const results: Array<{
      player_name: string
      owner_name: string
      status: 'matched' | 'player_not_found' | 'owner_not_found'
      matched_player?: string
      matched_owner?: string
      contract_id?: string
    }> = []

    const contractsToInsert: Array<{
      player_id: string
      owner_id: string
      salary: number
      years_total: number
      years_remaining: number
      acquisition_type: string
    }> = []

    for (const contract of contracts) {
      const normalizedPlayerName = normalizePlayerName(contract.player_name)
      const normalizedOwnerName = normalizePlayerName(contract.owner_name)

      // Find player (exact or fuzzy match)
      let matchedPlayer = playerByName.get(normalizedPlayerName)
      if (!matchedPlayer) {
        // Try fuzzy match
        let bestScore = 0
        for (const [name, player] of playerByName) {
          const score = fuzzyMatchScore(normalizedPlayerName, name)
          if (score > bestScore && score >= 80) {
            bestScore = score
            matchedPlayer = player
          }
        }
      }

      // Find owner
      let matchedOwner = ownerByName.get(normalizedOwnerName)
      if (!matchedOwner) {
        // Try fuzzy match on owner name
        let bestScore = 0
        for (const [name, owner] of ownerByName) {
          const score = fuzzyMatchScore(normalizedOwnerName, name)
          if (score > bestScore && score >= 70) {
            bestScore = score
            matchedOwner = owner
          }
        }
      }

      if (!matchedPlayer) {
        results.push({
          player_name: contract.player_name,
          owner_name: contract.owner_name,
          status: 'player_not_found',
        })
        continue
      }

      if (!matchedOwner) {
        results.push({
          player_name: contract.player_name,
          owner_name: contract.owner_name,
          status: 'owner_not_found',
          matched_player: matchedPlayer.name,
        })
        continue
      }

      contractsToInsert.push({
        player_id: matchedPlayer.id,
        owner_id: matchedOwner.id,
        salary: contract.salary,
        years_total: contract.years_total,
        years_remaining: contract.years_remaining,
        acquisition_type: 'auction',
      })

      results.push({
        player_name: contract.player_name,
        owner_name: contract.owner_name,
        status: 'matched',
        matched_player: matchedPlayer.name,
        matched_owner: matchedOwner.name,
      })
    }

    // Delete existing contracts and insert new ones
    if (contractsToInsert.length > 0) {
      await supabaseQuery('/salarycap_contracts?id=not.is.null', { method: 'DELETE' })
      await supabaseQuery('/salarycap_contracts', {
        method: 'POST',
        body: JSON.stringify(contractsToInsert),
      })
    }

    const matched = results.filter(r => r.status === 'matched').length
    const playerNotFound = results.filter(r => r.status === 'player_not_found').length
    const ownerNotFound = results.filter(r => r.status === 'owner_not_found').length

    return res.status(200).json({
      success: true,
      message: `Imported ${matched} contracts`,
      stats: {
        total: contracts.length,
        matched,
        player_not_found: playerNotFound,
        owner_not_found: ownerNotFound,
      },
      results,
    })
  } catch (error) {
    console.error('Import contracts error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Get current state
async function handleGetState(res: VercelResponse) {
  try {
    const [owners, players, contracts, rosters, deadCap, bonusCap] = await Promise.all([
      supabaseQuery('/salarycap_owners?select=*&order=owner_name'),
      supabaseQuery('/salarycap_players?select=*&order=name'),
      supabaseQuery('/salarycap_contracts?select=*,player:salarycap_players(name,position),owner:salarycap_owners(owner_name)'),
      supabaseQuery('/salarycap_rosters?select=*,player:salarycap_players(name,position),owner:salarycap_owners(owner_name)'),
      supabaseQuery('/salarycap_dead_cap?select=*,owner:salarycap_owners(owner_name)'),
      supabaseQuery('/salarycap_bonus_cap?select=*,owner:salarycap_owners(owner_name)'),
    ])

    return res.status(200).json({
      success: true,
      data: {
        owners: owners || [],
        players: players || [],
        contracts: contracts || [],
        rosters: rosters || [],
        deadCap: deadCap || [],
        bonusCap: bonusCap || [],
      },
      stats: {
        owners: owners?.length || 0,
        players: players?.length || 0,
        contracts: contracts?.length || 0,
        roster_assignments: rosters?.length || 0,
        dead_cap: deadCap?.length || 0,
        bonus_cap: bonusCap?.length || 0,
      },
    })
  } catch (error) {
    console.error('Get state error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Initialize settings
async function handleInitSettings(res: VercelResponse) {
  try {
    // Check if settings exist
    const existing = await supabaseQuery('/salarycap_settings?id=eq.1')

    if (existing && existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Settings already exist',
        settings: existing[0],
      })
    }

    // Create default settings
    const settings = await supabaseQuery('/salarycap_settings', {
      method: 'POST',
      body: JSON.stringify({
        id: 1,
        league_name: 'Bobby 3-Stix Memorial Salary Cap League',
        sleeper_league_id: LEAGUE_ID,
        salary_cap: 400,
        max_contract_years: 3,
        rookie_max_years: 5,
        dead_cap_percent: 40,
        fa_extension_base: 5,
        fa_extension_percent: 25,
        current_season: 2026,
        roster_size: 24,
      }),
    })

    return res.status(200).json({
      success: true,
      message: 'Settings initialized',
      settings: settings[0],
    })
  } catch (error) {
    console.error('Init settings error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const GOOGLE_SHEET_ID = '11X4WGUMkWj0mvMmNZVMBaI0EIHNsSHnauGstONDbRv4'
const TEAM_SHEETS = [
  'Scott Moran', 'Tim Meyers', 'Johnny Goodwin', 'Ryan Hossick',
  'Zach Moore', 'Tyler Bulger', 'Brad Wandell', 'Josh Sacks',
  'Brent Alexander', 'Corey & Rob', 'Nick Scott', 'Nick Meyer'
]
const CURRENT_SEASON = 2026

interface SheetContract {
  player_name: string
  position: string
  salary: number
  drafted_year: number
  contract_length: number
  was_franchise_tagged: boolean
  owner_name: string
}

interface SheetDeadCap {
  player_name: string
  position: string
  original_salary: number
  drafted_year: number
  contract_length: number
  owner_name: string
}

interface SheetBonusCap {
  corresponding_owner: string
  trade_year: number
  amount_2026: number
  amount_2027: number
  amount_2028: number
  amount_2029: number
  amount_2030: number
  owner_name: string // The team sheet this came from
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current.trim())
  return parts
}

// Fetch and parse a team sheet from Google Docs - returns contracts, dead cap, and bonus cap
async function fetchTeamSheetFull(ownerName: string): Promise<{
  contracts: SheetContract[]
  deadCap: SheetDeadCap[]
  bonusCap: SheetBonusCap[]
}> {
  const sheetName = encodeURIComponent(ownerName)
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`

  const response = await fetch(url)
  if (!response.ok) {
    console.error(`Failed to fetch sheet for ${ownerName}`)
    return { contracts: [], deadCap: [], bonusCap: [] }
  }

  const csvText = await response.text()
  const lines = csvText.split('\n')

  const contracts: SheetContract[] = []
  const deadCap: SheetDeadCap[] = []
  const bonusCap: SheetBonusCap[] = []

  let currentSection: 'contracts' | 'deadcap' | 'bonuscap' = 'contracts'

  const ownerNames = ['scott moran', 'tim meyers', 'johnny goodwin', 'ryan hossick',
    'zach moore', 'tyler bulger', 'brad wandell', 'josh sacks', 'brent alexander',
    'corey whitehead', 'rob green', 'nick scott', 'nick meyer', 'robbie green']

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i]
    if (!line.trim()) continue

    const parts = parseCSVLine(line)
    const firstCol = parts[0]?.replace(/^"|"$/g, '').trim().toLowerCase()

    // Detect section changes
    if (firstCol.includes('dead cap')) {
      currentSection = 'deadcap'
      continue
    }
    if (firstCol.includes('bonus cap')) {
      console.log(`Found bonus cap section in ${ownerName}`)
      currentSection = 'bonuscap'
      continue
    }

    // Skip headers and owner names (but NOT in bonuscap section - owner names are valid there as counterparties)
    if (currentSection !== 'bonuscap') {
      if (firstCol === 'player' || firstCol === 'description' || ownerNames.includes(firstCol)) continue
    }

    const col0 = parts[0]?.replace(/^"|"$/g, '').trim()
    const col1 = parts[1]?.replace(/^"|"$/g, '').trim()
    const col2 = parts[2]?.replace(/^"|"$/g, '').replace(/[$,]/g, '').trim()
    const col3 = parts[3]?.replace(/^"|"$/g, '').trim()
    const col4 = parts[4]?.replace(/^"|"$/g, '').trim()

    if (currentSection === 'contracts') {
      const playerName = col0
      const position = col1
      const salary = parseFloat(col2)
      const draftedYear = parseInt(col3, 10)
      const contractLength = parseInt(col4, 10)

      if (!playerName || isNaN(salary) || isNaN(draftedYear) || isNaN(contractLength)) continue

      const wasFranchiseTagged = playerName.includes('(Fr)')
      const cleanName = playerName.replace(/\s*\(Fr\)\s*/g, '').replace(/\s*\(trade\)\s*/g, '').trim()

      contracts.push({
        player_name: cleanName,
        position: position || 'UNK',
        salary,
        drafted_year: draftedYear,
        contract_length: contractLength,
        was_franchise_tagged: wasFranchiseTagged,
        owner_name: ownerName,
      })
    } else if (currentSection === 'deadcap') {
      const playerName = col0
      const position = col1
      const originalSalary = parseFloat(col2)
      const draftedYear = parseInt(col3, 10)
      const contractLength = parseInt(col4, 10)

      if (!playerName || isNaN(originalSalary) || isNaN(draftedYear) || isNaN(contractLength)) continue

      deadCap.push({
        player_name: playerName,
        position: position || 'UNK',
        original_salary: originalSalary,
        drafted_year: draftedYear,
        contract_length: contractLength,
        owner_name: ownerName,
      })
    } else if (currentSection === 'bonuscap') {
      // Skip header row and summary row
      if (firstCol === 'corresponding owner' || !col0) continue

      const correspondingOwner = col0
      const tradeYearStr = parts[3]?.replace(/^"|"$/g, '').trim()
      const tradeYear = parseInt(tradeYearStr, 10)

      // Parse amounts for each year (columns F through J = indices 5-9)
      const parseAmount = (val: string | undefined): number => {
        if (!val) return 0
        const cleaned = val.replace(/^"|"$/g, '').replace(/[$,\s]/g, '').trim()
        if (!cleaned || cleaned === '') return 0
        const num = parseFloat(cleaned)
        return isNaN(num) ? 0 : num
      }

      const amount2026 = parseAmount(parts[5])
      const amount2027 = parseAmount(parts[6])
      const amount2028 = parseAmount(parts[7])
      const amount2029 = parseAmount(parts[8])
      const amount2030 = parseAmount(parts[9])

      // Debug log raw values
      console.log(`${ownerName} bonus row: corr=${correspondingOwner}, raw5="${parts[5]}", amt2026=${amount2026}`)

      // Skip if no amounts
      if (amount2026 === 0 && amount2027 === 0 && amount2028 === 0 && amount2029 === 0 && amount2030 === 0) continue

      console.log(`Bonus cap entry: ${ownerName} -> ${correspondingOwner}: 2026=$${amount2026}`)
      bonusCap.push({
        corresponding_owner: correspondingOwner,
        trade_year: isNaN(tradeYear) ? 0 : tradeYear,
        amount_2026: amount2026,
        amount_2027: amount2027,
        amount_2028: amount2028,
        amount_2029: amount2029,
        amount_2030: amount2030,
        owner_name: ownerName,
      })
    }
  }

  return { contracts, deadCap, bonusCap }
}

// Legacy function for backwards compatibility
async function fetchTeamSheet(ownerName: string): Promise<SheetContract[]> {
  const { contracts } = await fetchTeamSheetFull(ownerName)
  return contracts
}

// Action: Sync contracts from Google Sheets
async function handleSyncContracts(res: VercelResponse) {
  try {
    // Fetch all rosters (players currently on teams per Sleeper)
    const [rosters, players, owners] = await Promise.all([
      supabaseQuery('/salarycap_rosters?select=id,owner_id,player_id,player:salarycap_players(id,name,position),owner:salarycap_owners(id,owner_name)'),
      supabaseQuery('/salarycap_players?select=id,name,position'),
      supabaseQuery('/salarycap_owners?select=id,owner_name'),
    ])

    // Fetch all team sheets from Google Docs (including dead cap and bonus cap)
    const allSheetContracts: SheetContract[] = []
    const allDeadCap: SheetDeadCap[] = []
    const allBonusCap: SheetBonusCap[] = []

    for (const teamName of TEAM_SHEETS) {
      const { contracts, deadCap, bonusCap } = await fetchTeamSheetFull(teamName)
      allSheetContracts.push(...contracts)
      allDeadCap.push(...deadCap)
      allBonusCap.push(...bonusCap)
    }

    // Build player name lookup from sheets
    const sheetContractByName = new Map<string, SheetContract>()
    for (const contract of allSheetContracts) {
      const normalizedName = normalizePlayerName(contract.player_name)
      sheetContractByName.set(normalizedName, contract)
    }

    // Build owner ID map with multiple name variations
    const ownerIdByName = new Map<string, string>()
    for (const owner of owners) {
      const name = owner.owner_name.toLowerCase()
      ownerIdByName.set(name, owner.id)

      // Handle common variations
      if (name.includes('corey') || name.includes('rob green')) {
        ownerIdByName.set('corey whitehead', owner.id)
        ownerIdByName.set('corey whitehead & rob green', owner.id)
        ownerIdByName.set('rob green', owner.id)
        ownerIdByName.set('corey/rob', owner.id)
        ownerIdByName.set('rob/corey', owner.id)
        ownerIdByName.set('corey & rob', owner.id)
        ownerIdByName.set('corey and rob', owner.id)
        ownerIdByName.set('robbie green', owner.id)
      }
      if (name.includes('tim')) {
        ownerIdByName.set('tim meyers', owner.id)
        ownerIdByName.set('tim meyer', owner.id) // Common typo
      }
      if (name.includes('johnny') || name.includes('jonny')) {
        ownerIdByName.set('johnny goodwin', owner.id)
        ownerIdByName.set('jonny goodwin', owner.id) // Alternate spelling
      }
    }

    // Process each rostered player
    const contractsToInsert: Array<{
      player_id: string
      owner_id: string
      salary: number
      years_total: number
      years_remaining: number
      acquisition_type: string
      acquisition_year: number
      is_franchise_tagged: boolean
      contract_status: string
      offseason_decision: string
      dead_cap_if_cut: number
    }> = []

    const freeAgentPickups: Array<{
      player_id: string
      owner_id: string
      offseason_decision: string
    }> = []

    const stats = {
      under_contract: 0,
      expired_contract: 0,
      free_agent_pickup: 0,
      not_matched: 0,
    }

    for (const roster of rosters) {
      const playerName = roster.player?.name
      const playerId = roster.player_id
      const ownerId = roster.owner_id

      if (!playerName || !playerId || !ownerId) continue

      // Try to find contract in Google Sheets
      const normalizedName = normalizePlayerName(playerName)
      let sheetContract = sheetContractByName.get(normalizedName)

      // Try fuzzy match if exact match fails
      if (!sheetContract) {
        let bestScore = 0
        for (const [name, contract] of sheetContractByName) {
          const score = fuzzyMatchScore(normalizedName, name)
          if (score > bestScore && score >= 85) {
            bestScore = score
            sheetContract = contract
          }
        }
      }

      if (sheetContract) {
        // Calculate contract status
        const lastYearUnderContract = sheetContract.drafted_year + sheetContract.contract_length - 1
        const yearsRemaining = Math.max(0, lastYearUnderContract - CURRENT_SEASON + 1)

        let contractStatus: string
        let offseasonDecision: string

        if (yearsRemaining > 0) {
          // Under contract for 2026
          contractStatus = 'active'
          offseasonDecision = 'pending' // Owner must decide: keep or cut
          stats.under_contract++
        } else {
          // Contract expired - franchise tag eligible (unless already tagged)
          contractStatus = 'expired'
          offseasonDecision = 'pending' // Owner must decide: franchise tag or release
          stats.expired_contract++
        }

        // Calculate dead cap if cut (40% of salary × years remaining, rounded up)
        const deadCapIfCut = yearsRemaining > 0 ? Math.ceil(sheetContract.salary * 0.4 * yearsRemaining) : 0

        contractsToInsert.push({
          player_id: playerId,
          owner_id: ownerId,
          salary: sheetContract.salary,
          years_total: sheetContract.contract_length,
          years_remaining: yearsRemaining,
          acquisition_type: 'auction',
          acquisition_year: sheetContract.drafted_year,
          is_franchise_tagged: sheetContract.was_franchise_tagged,
          contract_status: contractStatus,
          offseason_decision: offseasonDecision,
          dead_cap_if_cut: deadCapIfCut,
        })
      } else {
        // Player not found in any sheet = free agent pickup
        freeAgentPickups.push({
          player_id: playerId,
          owner_id: ownerId,
          offseason_decision: 'pending', // Owner must decide: $5 sign or release
        })
        stats.free_agent_pickup++
      }
    }

    // Clear existing data and insert new
    await supabaseQuery('/salarycap_contracts?id=not.is.null', { method: 'DELETE' })
    await supabaseQuery('/salarycap_free_agent_pickups?id=not.is.null', { method: 'DELETE' })

    if (contractsToInsert.length > 0) {
      await supabaseQuery('/salarycap_contracts', {
        method: 'POST',
        body: JSON.stringify(contractsToInsert),
      })
    }

    if (freeAgentPickups.length > 0) {
      await supabaseQuery('/salarycap_free_agent_pickups', {
        method: 'POST',
        body: JSON.stringify(freeAgentPickups),
      })
    }

    // Initialize offseason status for all owners
    const offseasonStatusToInsert = owners.map((owner: { id: string }) => ({
      owner_id: owner.id,
      season: CURRENT_SEASON,
      cuts_completed: false,
      franchise_tag_completed: false,
      free_agents_completed: false,
      all_completed: false,
    }))

    await supabaseQuery('/salarycap_offseason_status?id=not.is.null', { method: 'DELETE' })
    if (offseasonStatusToInsert.length > 0) {
      await supabaseQuery('/salarycap_offseason_status', {
        method: 'POST',
        body: JSON.stringify(offseasonStatusToInsert),
      })
    }

    // Process dead cap entries
    const deadCapToInsert: Array<{
      owner_id: string
      player_name: string
      amount: number
      years_remaining: number
      original_salary: number
      drafted_year: number
      cut_year: number
    }> = []

    for (const dc of allDeadCap) {
      const ownerId = ownerIdByName.get(dc.owner_name.toLowerCase())
      if (!ownerId) {
        console.log(`Dead cap: Could not find owner for ${dc.owner_name}`)
        continue
      }

      // Calculate years remaining: last year of original contract vs current season
      const lastYearOfContract = dc.drafted_year + dc.contract_length - 1
      const yearsRemaining = Math.max(0, lastYearOfContract - CURRENT_SEASON + 1)

      // Only include if still affects 2026
      if (yearsRemaining > 0) {
        // Dead cap per year = 40% of original salary, rounded up, minimum $1
        const deadCapPerYear = Math.max(1, Math.ceil(dc.original_salary * 0.4))

        // Cut year = last year of contract - years remaining + 1 (when they were actually cut)
        const cutYear = lastYearOfContract - yearsRemaining + 1

        deadCapToInsert.push({
          owner_id: ownerId,
          player_name: dc.player_name,
          amount: deadCapPerYear,
          years_remaining: yearsRemaining,
          original_salary: dc.original_salary,
          drafted_year: dc.drafted_year,
          cut_year: cutYear,
        })
      }
    }

    // Clear existing dead cap and insert new
    await supabaseQuery('/salarycap_dead_cap?id=not.is.null', { method: 'DELETE' })
    if (deadCapToInsert.length > 0) {
      await supabaseQuery('/salarycap_dead_cap', {
        method: 'POST',
        body: JSON.stringify(deadCapToInsert),
      })
    }

    // Process bonus cap entries - store full transaction records
    const bonusCapToInsert: Array<{
      owner_id: string
      corresponding_owner_id: string | null
      corresponding_owner_name: string
      trade_year: number
      amount_2026: number
      amount_2027: number
      amount_2028: number
      amount_2029: number
      amount_2030: number
    }> = []

    // Name aliases for matching corresponding owners
    const nameAliases: Record<string, string> = {
      'tim meyer': 'tim meyers',
      'corey and rob': 'corey whitehead',
      'corey & rob': 'corey whitehead',
      'corey/rob': 'corey whitehead',
      'rob/corey': 'corey whitehead',
      'robbie green': 'corey whitehead',
      'rob green': 'corey whitehead',
      'corey': 'corey whitehead',
      'corey whitehead & rob green': 'corey whitehead',
    }

    for (const bc of allBonusCap) {
      const ownerId = ownerIdByName.get(bc.owner_name.toLowerCase())
      if (!ownerId) {
        console.log(`Bonus cap: Could not find owner for ${bc.owner_name}`)
        continue
      }

      // Skip if all amounts are zero
      if (bc.amount_2026 === 0 && bc.amount_2027 === 0 && bc.amount_2028 === 0 &&
          bc.amount_2029 === 0 && bc.amount_2030 === 0) {
        continue
      }

      // Try to find the corresponding owner ID
      let correspondingOwnerName = bc.corresponding_owner.toLowerCase().trim()
      // Check aliases
      if (nameAliases[correspondingOwnerName]) {
        correspondingOwnerName = nameAliases[correspondingOwnerName]
      }
      const correspondingOwnerId = ownerIdByName.get(correspondingOwnerName) || null

      bonusCapToInsert.push({
        owner_id: ownerId,
        corresponding_owner_id: correspondingOwnerId,
        corresponding_owner_name: bc.corresponding_owner, // Keep original name for display
        trade_year: bc.trade_year,
        amount_2026: bc.amount_2026,
        amount_2027: bc.amount_2027,
        amount_2028: bc.amount_2028,
        amount_2029: bc.amount_2029,
        amount_2030: bc.amount_2030,
      })
    }

    // Clear existing bonus cap and insert new (if table exists)
    try {
      await supabaseQuery('/salarycap_bonus_cap?id=not.is.null', { method: 'DELETE' })
      if (bonusCapToInsert.length > 0) {
        await supabaseQuery('/salarycap_bonus_cap', {
          method: 'POST',
          body: JSON.stringify(bonusCapToInsert),
        })
      }
    } catch (e) {
      console.log('Bonus cap table may not exist yet, skipping')
    }

    // Debug: Show all bonus cap entries to be inserted
    const bonusCapDebug = bonusCapToInsert.map(bc => ({
      owner: owners.find((o: { id: string }) => o.id === bc.owner_id)?.owner_name,
      corresponding: bc.corresponding_owner_name,
      amount_2026: bc.amount_2026,
      amount_2027: bc.amount_2027,
      trade_year: bc.trade_year,
    }))

    return res.status(200).json({
      success: true,
      message: `Synced contracts: ${stats.under_contract} active, ${stats.expired_contract} expired, ${stats.free_agent_pickup} free agent pickups, ${deadCapToInsert.length} dead cap entries, ${bonusCapToInsert.length} bonus cap entries`,
      stats: {
        ...stats,
        dead_cap: deadCapToInsert.length,
        bonus_cap: bonusCapToInsert.length,
      },
      debug: {
        bonus_cap_entries: bonusCapDebug,
        total_parsed_from_sheets: allBonusCap.length,
        total_inserted: bonusCapToInsert.length,
      },
    })
  } catch (error) {
    console.error('Sync contracts error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Import all fantasy-relevant NFL players from Sleeper
async function handleImportAllPlayers(res: VercelResponse) {
  try {
    // Fetch all NFL players from Sleeper
    const playersRes = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
    if (!playersRes.ok) {
      throw new Error('Failed to fetch players from Sleeper')
    }
    const allPlayers = await playersRes.json()

    // Get existing players to avoid duplicates
    const existingPlayers = await supabaseQuery('/salarycap_players?select=sleeper_player_id')
    const existingIds = new Set(existingPlayers.map((p: { sleeper_player_id: string }) => p.sleeper_player_id))

    // Filter to fantasy-relevant positions and active players with search rank
    const relevantPositions = ['QB', 'RB', 'WR', 'TE']
    const playersToInsert: Array<{
      sleeper_player_id: string
      name: string
      position: string
      nfl_team: string | null
      fantasy_rank: number | null
      is_active: boolean
    }> = []

    for (const [playerId, player] of Object.entries(allPlayers)) {
      const p = player as {
        full_name?: string
        first_name?: string
        last_name?: string
        position?: string
        team?: string | null
        active?: boolean
        search_rank?: number
      }

      // Skip if already exists
      if (existingIds.has(playerId)) continue

      // Must have a valid position
      if (!p.position || !relevantPositions.includes(p.position)) continue

      // Must have a name
      const name = p.full_name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : null)
      if (!name) continue

      // Must have a search rank (fantasy relevance) - top 500 at each position
      if (!p.search_rank || p.search_rank > 500) continue

      playersToInsert.push({
        sleeper_player_id: playerId,
        name,
        position: p.position,
        nfl_team: p.team || null,
        fantasy_rank: p.search_rank || null,
        is_active: p.active ?? true,
      })
    }

    // Insert in batches to avoid timeout
    const batchSize = 100
    let inserted = 0
    for (let i = 0; i < playersToInsert.length; i += batchSize) {
      const batch = playersToInsert.slice(i, i + batchSize)
      await supabaseQuery('/salarycap_players', {
        method: 'POST',
        body: JSON.stringify(batch),
      })
      inserted += batch.length
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${inserted} new players`,
      stats: {
        total_found: playersToInsert.length,
        inserted,
        already_existed: existingIds.size,
      },
    })
  } catch (error) {
    console.error('Import all players error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Import players from FantasyPros CSV
async function handleImportFantasyPros(req: VercelRequest, res: VercelResponse) {
  try {
    const { csvData } = req.body as { csvData: string }

    if (!csvData) {
      return res.status(400).json({ success: false, error: 'Missing csvData in request body' })
    }

    // Parse CSV
    const lines = csvData.split('\n')
    const players: Array<{
      rank: number
      name: string
      team: string | null
      position: string
    }> = []

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i]
      if (!line.trim()) continue

      // Parse CSV line (handle quoted fields)
      const parts: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      parts.push(current.trim())

      // Columns: RK, TIERS, PLAYER NAME, TEAM, POS, ...
      const rankStr = parts[0]?.replace(/^"|"$/g, '').trim()
      const playerName = parts[2]?.replace(/^"|"$/g, '').trim()
      const team = parts[3]?.replace(/^"|"$/g, '').trim()
      const posWithRank = parts[4]?.replace(/^"|"$/g, '').trim() // e.g., "RB1", "WR23"

      // Skip ads/invalid rows
      if (rankStr === 'AD' || !rankStr || !playerName) continue

      const rank = parseInt(rankStr, 10)
      if (isNaN(rank)) continue

      // Extract base position (remove the position rank number)
      const posMatch = posWithRank?.match(/^(QB|RB|WR|TE|K|DST|DEF)/)
      const position = posMatch ? posMatch[1] : null

      // Skip kickers and defense
      if (!position || position === 'K' || position === 'DST' || position === 'DEF') continue

      players.push({
        rank,
        name: playerName,
        team: team === 'FA' ? null : team || null,
        position,
      })
    }

    // Fetch Sleeper players for ID matching (for avatars)
    const sleeperRes = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
    if (!sleeperRes.ok) {
      throw new Error('Failed to fetch Sleeper players for ID matching')
    }
    const sleeperPlayers = await sleeperRes.json()

    // Build Sleeper lookup by normalized name
    const sleeperByName = new Map<string, { id: string; team: string | null }>()
    for (const [playerId, player] of Object.entries(sleeperPlayers)) {
      const p = player as { full_name?: string; first_name?: string; last_name?: string; team?: string | null }
      const name = p.full_name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : null)
      if (name) {
        sleeperByName.set(normalizePlayerName(name), { id: playerId, team: p.team || null })
      }
    }

    // Get existing contracts to preserve player IDs for contracted players
    const existingPlayers = await supabaseQuery('/salarycap_players?select=id,name,sleeper_player_id')
    const existingContracts = await supabaseQuery('/salarycap_contracts?select=player_id')
    const contractedPlayerIds = new Set(existingContracts.map((c: { player_id: string }) => c.player_id))

    // Build a map of normalized name -> existing player for contracted players
    const contractedByName = new Map<string, { id: string; sleeper_player_id: string }>()
    for (const p of existingPlayers) {
      if (contractedPlayerIds.has(p.id)) {
        contractedByName.set(normalizePlayerName(p.name), { id: p.id, sleeper_player_id: p.sleeper_player_id })
      }
    }

    // Prepare players to insert
    const playersToInsert: Array<{
      sleeper_player_id: string
      name: string
      position: string
      nfl_team: string | null
      fantasy_rank: number
      is_active: boolean
    }> = []

    const playersToUpdate: Array<{
      id: string
      fantasy_rank: number
      nfl_team: string | null
    }> = []

    let matched = 0
    let unmatched = 0

    for (const player of players) {
      const normalizedName = normalizePlayerName(player.name)

      // Check if this player is already contracted (preserve their record)
      const existingContracted = contractedByName.get(normalizedName)
      if (existingContracted) {
        playersToUpdate.push({
          id: existingContracted.id,
          fantasy_rank: player.rank,
          nfl_team: player.team,
        })
        matched++
        continue
      }

      // Try to find Sleeper ID
      let sleeperId: string | null = null
      let sleeperMatch = sleeperByName.get(normalizedName)

      // Try fuzzy match if exact fails
      if (!sleeperMatch) {
        let bestScore = 0
        for (const [name, data] of sleeperByName) {
          const score = fuzzyMatchScore(normalizedName, name)
          if (score > bestScore && score >= 85) {
            bestScore = score
            sleeperMatch = data
          }
        }
      }

      if (sleeperMatch) {
        sleeperId = sleeperMatch.id
        matched++
      } else {
        // Generate a placeholder ID for players not in Sleeper
        sleeperId = `fp_${player.rank}`
        unmatched++
      }

      playersToInsert.push({
        sleeper_player_id: sleeperId,
        name: player.name,
        position: player.position,
        nfl_team: player.team,
        fantasy_rank: player.rank,
        is_active: true,
      })
    }

    // Delete non-contracted players (keep contracted ones)
    const nonContractedIds = existingPlayers
      .filter((p: { id: string }) => !contractedPlayerIds.has(p.id))
      .map((p: { id: string }) => p.id)

    if (nonContractedIds.length > 0) {
      // Delete in chunks to avoid URL length limits
      const chunkSize = 50
      for (let i = 0; i < nonContractedIds.length; i += chunkSize) {
        const chunk = nonContractedIds.slice(i, i + chunkSize)
        const idList = chunk.map((id: string) => `"${id}"`).join(',')
        await supabaseQuery(`/salarycap_players?id=in.(${idList})`, { method: 'DELETE' })
      }
    }

    // Update contracted players with new ranks
    for (const update of playersToUpdate) {
      await supabaseQuery(`/salarycap_players?id=eq.${update.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fantasy_rank: update.fantasy_rank,
          nfl_team: update.nfl_team,
        }),
      })
    }

    // Insert new players in batches
    const batchSize = 100
    let inserted = 0
    for (let i = 0; i < playersToInsert.length; i += batchSize) {
      const batch = playersToInsert.slice(i, i + batchSize)
      await supabaseQuery('/salarycap_players', {
        method: 'POST',
        body: JSON.stringify(batch),
      })
      inserted += batch.length
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${inserted} new players, updated ${playersToUpdate.length} contracted players`,
      stats: {
        total_from_csv: players.length,
        inserted,
        updated: playersToUpdate.length,
        sleeper_matched: matched,
        sleeper_unmatched: unmatched,
      },
    })
  } catch (error) {
    console.error('Import FantasyPros error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Update fantasy ranks for all players from Sleeper
async function handleUpdateRanks(res: VercelResponse) {
  try {
    // Fetch all NFL players from Sleeper
    const playersRes = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
    if (!playersRes.ok) {
      throw new Error('Failed to fetch players from Sleeper')
    }
    const allPlayers = await playersRes.json()

    // Get all existing players
    const existingPlayers = await supabaseQuery('/salarycap_players?select=id,sleeper_player_id')

    let updated = 0
    for (const player of existingPlayers) {
      const sleeperData = allPlayers[player.sleeper_player_id]
      if (sleeperData && sleeperData.search_rank) {
        await supabaseQuery(`/salarycap_players?id=eq.${player.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fantasy_rank: sleeperData.search_rank,
            nfl_team: sleeperData.team || null,
          }),
        })
        updated++
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ranks for ${updated} players`,
    })
  } catch (error) {
    console.error('Update ranks error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Action: Update rookie status for all players from Sleeper
async function handleUpdateRookies(res: VercelResponse) {
  try {
    // Fetch all NFL players from Sleeper
    const playersRes = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
    if (!playersRes.ok) {
      throw new Error('Failed to fetch players from Sleeper')
    }
    const allPlayers = await playersRes.json()

    // Get all existing players
    const existingPlayers = await supabaseQuery('/salarycap_players?select=id,sleeper_player_id')

    let rookies = 0
    let nonRookies = 0

    for (const player of existingPlayers) {
      const sleeperData = allPlayers[player.sleeper_player_id]
      // years_exp === 0 means rookie (or null/undefined for some rookies)
      // Players drafted in 2025 NFL draft are rookies for 2025 season
      const isRookie = sleeperData && (sleeperData.years_exp === 0 || sleeperData.years_exp === null)

      await supabaseQuery(`/salarycap_players?id=eq.${player.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_rookie: isRookie || false,
        }),
      })

      if (isRookie) {
        rookies++
      } else {
        nonRookies++
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated rookie status: ${rookies} rookies, ${nonRookies} non-rookies`,
      stats: { rookies, nonRookies },
    })
  } catch (error) {
    console.error('Update rookies error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ success: false, error: 'Missing environment variables' })
  }

  const action = req.query.action as string

  switch (action) {
    case 'fetch-sleeper':
      return handleFetchSleeper(res)
    case 'import-contracts':
      return handleImportContracts(req, res)
    case 'sync-contracts':
      return handleSyncContracts(res)
    case 'get-state':
      return handleGetState(res)
    case 'init-settings':
      return handleInitSettings(res)
    case 'import-all-players':
      return handleImportAllPlayers(res)
    case 'import-fantasypros':
      return handleImportFantasyPros(req, res)
    case 'update-ranks':
      return handleUpdateRanks(res)
    case 'update-rookies':
      return handleUpdateRookies(res)
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use: fetch-sleeper, import-contracts, sync-contracts, get-state, init-settings, import-all-players, import-fantasypros, update-ranks, update-rookies',
      })
  }
}
