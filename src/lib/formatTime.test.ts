import { describe, it, expect } from 'vitest'
import { formatDateTime, formatDeadline, formatDate, formatShortDateTime } from './formatTime'

describe('formatDateTime', () => {
  it('formats a valid date string', () => {
    const result = formatDateTime('2025-01-11T13:00:00Z')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/11/)
  })

  it('includes time information', () => {
    const result = formatDateTime('2025-01-11T13:00:00Z')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatDeadline', () => {
  it('formats a deadline with date and time', () => {
    const result = formatDeadline('2025-01-11T13:00:00Z')
    expect(result).toMatch(/Sat/)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/11/)
  })
})

describe('formatDate', () => {
  it('formats date without time', () => {
    const result = formatDate('2025-01-11T13:00:00Z')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/\d+/)
    expect(result).toMatch(/2025/)
  })
})

describe('formatShortDateTime', () => {
  it('returns short format with timezone', () => {
    const result = formatShortDateTime('2025-01-11T13:00:00Z')
    expect(result).toMatch(/\d/)
  })
})
