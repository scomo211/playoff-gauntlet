import { describe, it, expect } from 'vitest'
import {
  entryNameSchema,
  signupSchema,
  loginSchema,
  validateField,
  validateForm,
} from './validation'

describe('entryNameSchema', () => {
  it('accepts valid entry names', () => {
    expect(entryNameSchema.safeParse('Team A').success).toBe(true)
    expect(entryNameSchema.safeParse('My Playoff Pick').success).toBe(true)
    expect(entryNameSchema.safeParse('ab').success).toBe(true)
  })

  it('rejects names shorter than 2 characters', () => {
    const result = entryNameSchema.safeParse('a')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 2')
    }
  })

  it('rejects names longer than 30 characters', () => {
    const result = entryNameSchema.safeParse('a'.repeat(31))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('30 characters')
    }
  })

  it('trims whitespace from names', () => {
    const result = entryNameSchema.safeParse('  Team A  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('Team A')
    }
  })
})

describe('signupSchema', () => {
  const validData = {
    displayName: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  }

  it('accepts valid signup data', () => {
    const result = signupSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects empty display name', () => {
    const result = signupSchema.safeParse({
      ...validData,
      displayName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = signupSchema.safeParse({
      ...validData,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('email')
    }
  })

  it('rejects short passwords', () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: '12345',
      confirmPassword: '12345',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('6 characters')
    }
  })

  it('rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      ...validData,
      confirmPassword: 'different',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('match')
    }
  })
})

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-valid',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'john@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('validateField helper', () => {
  it('returns null for valid input', () => {
    const result = validateField(entryNameSchema, 'Valid Name')
    expect(result).toBeNull()
  })

  it('returns error message for invalid input', () => {
    const result = validateField(entryNameSchema, 'a')
    expect(result).toContain('at least 2')
  })
})

describe('validateForm helper', () => {
  it('returns success true with data for valid form', () => {
    const result = validateForm(loginSchema, {
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('john@example.com')
    }
  })

  it('returns success false with errors for invalid form', () => {
    const result = validateForm(loginSchema, {
      email: 'not-valid',
      password: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors).toHaveProperty('email')
      expect(result.errors).toHaveProperty('password')
    }
  })
})
