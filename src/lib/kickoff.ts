// Wild Card Weekend 2026 - First game kickoff (Saturday, January 10, 2026 at 4:30 PM ET)
export const KICKOFF_DATE = new Date('2026-01-10T16:30:00-05:00')

export function areLineupsLocked(): boolean {
  return new Date() >= KICKOFF_DATE
}
