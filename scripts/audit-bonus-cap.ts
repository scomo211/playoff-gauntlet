/**
 * Audit script for Bonus Cap entries
 * Fetches all team sheets from Google Docs and cross-references bonus cap entries
 * to ensure every entry has a corresponding counterpart on the other owner's sheet.
 */

const GOOGLE_SHEET_ID = '11X4WGUMkWj0mvMmNZVMBaI0EIHNsSHnauGstONDbRv4'
const TEAM_SHEETS = [
  'Scott Moran', 'Tim Meyers', 'Johnny Goodwin', 'Ryan Hossick',
  'Zach Moore', 'Tyler Bulger', 'Brad Wandell', 'Josh Sacks',
  'Brent Alexander', 'Corey Whitehead', 'Nick Scott', 'Nick Meyer'
]

interface BonusCapEntry {
  ownerSheet: string           // Which team sheet this came from
  correspondingOwner: string   // The other party in the trade
  tradeYear: number | null     // Year the trade was made
  total: number                // Total amount (can ignore, it's sum of years)
  amount2026: number
  amount2027: number
  amount2028: number
  amount2029: number
  amount2030: number
  rawLine: string              // For debugging
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

// Parse a dollar amount (handles $, commas, negatives, parentheses)
function parseAmount(val: string | undefined): number {
  if (!val) return 0
  let cleaned = val.replace(/^"|"$/g, '').replace(/[$,\s]/g, '').trim()
  if (!cleaned || cleaned === '') return 0

  // Handle parentheses for negative: ($10) -> -10
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Map of known name variations to canonical names
const NAME_ALIASES: Record<string, string> = {
  // Tim Meyers variations
  'tim meyer': 'tim meyers',
  'tim meyers': 'tim meyers',

  // Nick Meyer variations
  'nick meyer': 'nick meyer',

  // Johnny Goodwin variations
  'jonny goodwin': 'johnny goodwin',
  'johnny goodwin': 'johnny goodwin',

  // Corey Whitehead & Rob Green variations (same team)
  'corey whitehead': 'corey whitehead',
  'rob green': 'corey whitehead',
  'robbie green': 'corey whitehead',
  'corey whitehead and rob green': 'corey whitehead',
  'corey whitehead & rob green': 'corey whitehead',
  'robcorey': 'corey whitehead',
  'coreyrob': 'corey whitehead',
  'rob corey': 'corey whitehead',
  'corey rob': 'corey whitehead',
}

// Normalize owner names for matching
function normalizeOwnerName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '')  // Remove all spaces for matching
    .trim()

  // Check for aliases (try with and without spaces)
  if (NAME_ALIASES[normalized]) {
    return NAME_ALIASES[normalized]
  }

  // Try with spaces preserved
  const withSpaces = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return NAME_ALIASES[withSpaces] || withSpaces
}

async function fetchTeamBonusCap(ownerName: string): Promise<BonusCapEntry[]> {
  const sheetName = encodeURIComponent(ownerName)
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`

  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    console.error(`Failed to fetch sheet for ${ownerName}: ${response.status}`)
    return []
  }

  const csvText = await response.text()
  const lines = csvText.split('\n')

  const entries: BonusCapEntry[] = []
  let inBonusCapSection = false
  let headerFound = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const parts = parseCSVLine(line)
    const firstCol = parts[0]?.replace(/^"|"$/g, '').trim().toLowerCase()

    // Detect bonus cap section start (just "Bonus Cap" in column A)
    if (firstCol === 'bonus cap') {
      inBonusCapSection = true
      headerFound = false
      continue
    }

    // Skip the header row within bonus cap section
    if (inBonusCapSection && firstCol.startsWith('corresponding')) {
      headerFound = true
      continue
    }

    // Process bonus cap rows
    if (inBonusCapSection && headerFound) {
      const correspondingOwner = parts[0]?.replace(/^"|"$/g, '').trim()

      // Skip empty rows or summary rows
      if (!correspondingOwner || correspondingOwner.toLowerCase() === 'total' || correspondingOwner === '') {
        continue
      }

      // Skip if it's just a number or a dollar amount (total/summary row)
      if (/^-?\$?[\d.,]+$/.test(correspondingOwner)) {
        continue
      }

      // Parse trade year (column D, index 3)
      const tradeYearStr = parts[3]?.replace(/^"|"$/g, '').trim()
      const tradeYear = parseInt(tradeYearStr, 10)

      // Parse total (column E, index 4)
      const total = parseAmount(parts[4])

      // Parse amounts for each year (columns F through J = indices 5-9)
      const amount2026 = parseAmount(parts[5])
      const amount2027 = parseAmount(parts[6])
      const amount2028 = parseAmount(parts[7])
      const amount2029 = parseAmount(parts[8])
      const amount2030 = parseAmount(parts[9])

      // Skip entries with no future impact (all 2026+ amounts are 0)
      if (amount2026 === 0 && amount2027 === 0 && amount2028 === 0 && amount2029 === 0 && amount2030 === 0) {
        continue
      }

      entries.push({
        ownerSheet: ownerName,
        correspondingOwner,
        tradeYear: isNaN(tradeYear) ? null : tradeYear,
        total,
        amount2026,
        amount2027,
        amount2028,
        amount2029,
        amount2030,
        rawLine: line,
      })
    }
  }

  return entries
}

async function main() {
  console.log('='.repeat(80))
  console.log('BONUS CAP AUDIT REPORT')
  console.log('='.repeat(80))
  console.log('')

  // Fetch all team sheets
  const allEntries: BonusCapEntry[] = []

  for (const team of TEAM_SHEETS) {
    console.log(`Fetching ${team}...`)
    const entries = await fetchTeamBonusCap(team)
    console.log(`  Found ${entries.length} bonus cap entries with 2026+ impact`)
    allEntries.push(...entries)
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('ALL BONUS CAP ENTRIES (2026+ impact only)')
  console.log('='.repeat(80))

  // Group by owner sheet
  const byOwner = new Map<string, BonusCapEntry[]>()
  for (const entry of allEntries) {
    const existing = byOwner.get(entry.ownerSheet) || []
    existing.push(entry)
    byOwner.set(entry.ownerSheet, existing)
  }

  for (const [owner, entries] of byOwner) {
    console.log('')
    console.log(`\n${owner}:`)
    for (const e of entries) {
      const years = []
      if (e.amount2026 !== 0) years.push(`2026: $${e.amount2026}`)
      if (e.amount2027 !== 0) years.push(`2027: $${e.amount2027}`)
      if (e.amount2028 !== 0) years.push(`2028: $${e.amount2028}`)
      if (e.amount2029 !== 0) years.push(`2029: $${e.amount2029}`)
      if (e.amount2030 !== 0) years.push(`2030: $${e.amount2030}`)
      console.log(`  → ${e.correspondingOwner} (trade year: ${e.tradeYear || '?'}): ${years.join(', ')}`)
    }
  }

  // Cross-reference audit
  console.log('')
  console.log('='.repeat(80))
  console.log('CROSS-REFERENCE AUDIT')
  console.log('='.repeat(80))

  const issues: string[] = []
  const matched: string[] = []

  for (const entry of allEntries) {
    // Find corresponding entry on the other owner's sheet
    const normalizedCorresponding = normalizeOwnerName(entry.correspondingOwner)

    // Find the other owner's entries
    const otherOwnerEntries = allEntries.filter(e =>
      normalizeOwnerName(e.ownerSheet) === normalizedCorresponding
    )

    // Look for a matching entry that references back to this owner
    const normalizedThisOwner = normalizeOwnerName(entry.ownerSheet)
    const matchingEntry = otherOwnerEntries.find(e =>
      normalizeOwnerName(e.correspondingOwner) === normalizedThisOwner &&
      e.tradeYear === entry.tradeYear
    )

    if (!matchingEntry) {
      issues.push(`MISSING: ${entry.ownerSheet} has entry for ${entry.correspondingOwner} (trade year ${entry.tradeYear}), but no corresponding entry found on ${entry.correspondingOwner}'s sheet`)
    } else {
      // Verify amounts match (should be opposite signs)
      const amountMismatches: string[] = []

      if (entry.amount2026 !== -matchingEntry.amount2026) {
        amountMismatches.push(`2026: ${entry.ownerSheet} has $${entry.amount2026}, ${matchingEntry.ownerSheet} has $${matchingEntry.amount2026} (expected $${-entry.amount2026})`)
      }
      if (entry.amount2027 !== -matchingEntry.amount2027) {
        amountMismatches.push(`2027: ${entry.ownerSheet} has $${entry.amount2027}, ${matchingEntry.ownerSheet} has $${matchingEntry.amount2027} (expected $${-entry.amount2027})`)
      }
      if (entry.amount2028 !== -matchingEntry.amount2028) {
        amountMismatches.push(`2028: ${entry.ownerSheet} has $${entry.amount2028}, ${matchingEntry.ownerSheet} has $${matchingEntry.amount2028} (expected $${-entry.amount2028})`)
      }
      if (entry.amount2029 !== -matchingEntry.amount2029) {
        amountMismatches.push(`2029: ${entry.ownerSheet} has $${entry.amount2029}, ${matchingEntry.ownerSheet} has $${matchingEntry.amount2029} (expected $${-entry.amount2029})`)
      }
      if (entry.amount2030 !== -matchingEntry.amount2030) {
        amountMismatches.push(`2030: ${entry.ownerSheet} has $${entry.amount2030}, ${matchingEntry.ownerSheet} has $${matchingEntry.amount2030} (expected $${-entry.amount2030})`)
      }

      if (amountMismatches.length > 0) {
        issues.push(`MISMATCH: ${entry.ownerSheet} ↔ ${entry.correspondingOwner} (trade year ${entry.tradeYear}):\n    ${amountMismatches.join('\n    ')}`)
      } else {
        matched.push(`OK: ${entry.ownerSheet} ↔ ${entry.correspondingOwner} (trade year ${entry.tradeYear})`)
      }
    }
  }

  // Remove duplicates from matched (since each pair is checked twice)
  const uniqueMatched = [...new Set(matched)]

  console.log('')
  console.log(`Found ${uniqueMatched.length / 2} matched pairs (verified both directions)`)
  console.log(`Found ${issues.length} issues`)

  if (issues.length > 0) {
    console.log('')
    console.log('ISSUES:')
    for (const issue of issues) {
      console.log(`  ❌ ${issue}`)
    }
  }

  // Summary by owner - net bonus cap for 2026
  console.log('')
  console.log('='.repeat(80))
  console.log('NET BONUS CAP BY OWNER (2026)')
  console.log('='.repeat(80))

  const netByOwner = new Map<string, number>()
  for (const entry of allEntries) {
    const current = netByOwner.get(entry.ownerSheet) || 0
    netByOwner.set(entry.ownerSheet, current + entry.amount2026)
  }

  for (const team of TEAM_SHEETS) {
    const net = netByOwner.get(team) || 0
    const sign = net >= 0 ? '+' : ''
    console.log(`  ${team}: ${sign}$${net}`)
  }

  // Verify zero-sum
  let totalNet = 0
  for (const [, net] of netByOwner) {
    totalNet += net
  }
  console.log('')
  console.log(`  TOTAL (should be $0): $${totalNet}`)

  if (totalNet !== 0) {
    console.log('  ⚠️  WARNING: Net bonus cap does not sum to zero!')
  }
}

main().catch(console.error)
